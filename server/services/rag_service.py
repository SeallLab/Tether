"""
RAG Service with Conversation History
Handles the retrieval-augmented generation with chat history management
"""

import os
import pickle
from typing import List, Dict, Any, Optional
from uuid import uuid4

from langchain_core.documents import Document
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.tools import tool
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.chat_models import init_chat_model
from langgraph.graph import MessagesState, StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from .conversation_repository import ConversationRepository


class RAGService:
    """RAG Service with conversation history"""
    
    def __init__(self, vector_store_path: str = "vector_store", google_api_key: str = None, db_path: str = "conversations.db"):
        # Set up API key
        if google_api_key:
            os.environ["GOOGLE_API_KEY"] = google_api_key
        elif not os.environ.get("GOOGLE_API_KEY"):
            raise ValueError("Google API key must be provided")
        
        # Initialize components
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        self.llm = init_chat_model("gemini-2.0-flash", model_provider="google_genai")
        self.conversation_repo = ConversationRepository(db_path)
        self.db_path = db_path
        self._current_activity_context = None
        
        # Load vector store
        self.load_vector_store(vector_store_path)
        
        # Initialize RAG graph (without persistence for now)
        self._setup_rag_graph()
    
    def load_vector_store(self, file_path: str):
        """Load the vector store from disk"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Vector store directory not found: {file_path}")
        
        print(f"Loading vector store from {file_path}...")
        self.vector_store = FAISS.load_local(file_path, self.embeddings, allow_dangerous_deserialization=True)
        print("Vector store loaded!")
    
    def _create_retrieve_tool(self):
        """Create the retrieve tool for the RAG pipeline"""
        @tool(response_format="content_and_artifact")
        def retrieve(query: str):
            """Retrieve information related to a query."""
            retrieved_docs = self.vector_store.similarity_search(query, k=2)
            serialized = "\n\n".join(
                (f"Source: {doc.metadata}\n" f"Content: {doc.page_content}")
                for doc in retrieved_docs
            )
            return serialized, retrieved_docs
        
        return retrieve
    
    def _create_adhd_focused_prompt(self, docs_content: str, activity_context: List[Dict] = None) -> str:
        """Create an ADHD-focused system prompt with optional activity context"""
        activity_summary = ""
        
        if activity_context and len(activity_context) > 0:
            activity_summary = self._analyze_activity_context(activity_context)
        
        base_prompt = f"""You are Tether, an AI assistant specifically designed to help people with ADHD stay focused and productive.

CORE PRINCIPLES:
- Keep responses concise (2-3 sentences max)
- Be encouraging and understanding, never judgmental
- Focus on actionable, specific advice
- Break down complex tasks into smaller steps
- Acknowledge ADHD challenges (executive dysfunction, hyperfocus, time blindness)
- Use positive, motivating language

RESPONSE APPROACH - PRIORITIZE EMOTIONAL SUPPORT:
When users express feeling overwhelmed, stressed, or struggling emotionally, use a TWO-STEP approach:

STEP 1: Address their emotional state and ADHD experience first
- Validate their feelings ("Feeling overwhelmed is totally valid, especially with ADHD")
- Offer immediate emotional regulation techniques (deep breathing, grounding, etc.)
- Remind them this feeling is temporary and manageable
- Suggest ADHD-specific coping strategies

STEP 2: Then help with the actual task
- Break down the technical/practical task into small, manageable steps
- Focus on just the very first step to reduce overwhelm
- Remind them they can tackle one piece at a time

RESPONSE GUIDELINES:
- If they're struggling with focus: Suggest specific techniques (Pomodoro, body doubling, etc.)
- If they're overwhelmed: FIRST validate emotions, THEN help break tasks into smaller pieces
- If they're procrastinating: Offer gentle accountability and starting strategies
- If they're hyperfocusing: Remind them about breaks and self-care
- If they're planning: Help prioritize and create realistic timelines
- Always validate their experience and offer hope

IMPORTANT: You have access to the user's recent activity history and patterns. When they ask about what they were doing (yesterday, today, recently), use this information to provide specific answers.

AVAILABLE CONTEXT:
{docs_content}

{activity_summary}

Use the retrieved context and activity history when relevant. When asked about past activities, refer to the USER'S RECENT ACTIVITY HISTORY section above. Respond as Tether in a warm, understanding, and concise way."""
        
        return base_prompt
    
    def _analyze_activity_context(self, activity_logs: List[Dict]) -> str:
        """Analyze activity logs to provide insights for the LLM"""
        if not activity_logs:
            return ""
        
        # Group activities by day
        from datetime import datetime, timedelta
        import time
        
        # Convert timestamps and group by day
        activities_by_day = {}
        app_switches = []
        idle_periods = []
        
        for log in activity_logs:
            timestamp = log.get('timestamp', 0)
            if timestamp:
                # Convert timestamp to date
                dt = datetime.fromtimestamp(timestamp / 1000)  # Convert from milliseconds
                day_key = dt.strftime('%Y-%m-%d')
                
                if day_key not in activities_by_day:
                    activities_by_day[day_key] = {
                        'window_changes': [],
                        'idle_periods': [],
                        'apps_used': set()
                    }
                
                if log.get('type') == 'window_change':
                    data = log.get('data', {})
                    app_name = data.get('application_name', 'Unknown')
                    window_title = data.get('window_title', '')
                    
                    activities_by_day[day_key]['window_changes'].append({
                        'time': dt.strftime('%H:%M'),
                        'app': app_name,
                        'window': window_title
                    })
                    activities_by_day[day_key]['apps_used'].add(app_name)
                    
                    app_switches.append({
                        'app': app_name,
                        'time': timestamp
                    })
                    
                elif log.get('type') == 'idle':
                    data = log.get('data', {})
                    idle_duration = data.get('idle_duration', 0)
                    was_idle = data.get('was_idle', False)
                    if was_idle and idle_duration > 60:  # More than 1 minute idle
                        activities_by_day[day_key]['idle_periods'].append({
                            'time': dt.strftime('%H:%M'),
                            'duration': idle_duration
                        })
                        idle_periods.append(idle_duration)
        
        # Generate day summaries
        day_summaries = []
        today = datetime.now().strftime('%Y-%m-%d')
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        for day, activities in sorted(activities_by_day.items(), reverse=True):
            if day == today:
                day_label = "Today"
            elif day == yesterday:
                day_label = "Yesterday"
            else:
                day_label = day
            
            apps_used = list(activities['apps_used'])
            window_changes = activities['window_changes']
            
            if apps_used:
                # Get most used apps for the day
                app_counts = {}
                for change in window_changes:
                    app = change['app']
                    app_counts[app] = app_counts.get(app, 0) + 1
                
                top_apps = sorted(app_counts.items(), key=lambda x: x[1], reverse=True)[:3]
                app_summary = ", ".join([f"{app} ({count} times)" for app, count in top_apps])
                
                day_summaries.append(f"{day_label} ({day}): Used {app_summary}")
                
                # Add specific activities if it's yesterday and user is asking about it
                if len(window_changes) > 0:
                    first_activity = window_changes[0]['time']
                    last_activity = window_changes[-1]['time']
                    day_summaries.append(f"  - Active from {first_activity} to {last_activity}")
                    
                    # Show some specific windows/tasks
                    interesting_windows = [w for w in window_changes if w['window'] and 'No Window' not in w['window']][:5]
                    if interesting_windows:
                        window_titles = [f"{w['time']}: {w['window']}" for w in interesting_windows]
                        day_summaries.append(f"  - Key activities: {'; '.join(window_titles[:3])}")
        
        # Generate pattern insights
        insights = []
        
        # App switching analysis
        if len(app_switches) > 10:  # Many app switches
            unique_apps = len(set(switch['app'] for switch in app_switches))
            insights.append(f"High task switching detected: {len(app_switches)} app changes across {unique_apps} applications in recent days.")
        
        # Identify most used applications overall
        if app_switches:
            app_counts = {}
            for switch in app_switches:
                app = switch['app']
                app_counts[app] = app_counts.get(app, 0) + 1
            
            most_used = max(app_counts.items(), key=lambda x: x[1])
            if most_used[1] > 5:  # Used more than 5 times
                insights.append(f"Most frequently used application: {most_used[0]} ({most_used[1]} interactions).")
        
        # Idle time analysis
        if idle_periods:
            total_idle = sum(idle_periods)
            avg_idle = total_idle / len(idle_periods)
            if avg_idle > 300:  # Average idle > 5 minutes
                insights.append(f"Extended idle periods detected (avg {avg_idle/60:.1f} minutes).")
        
        # Task consistency analysis
        if app_switches:
            # Calculate time spent in different applications
            app_durations = {}
            current_time = None
            current_app = None
            
            for switch in sorted(app_switches, key=lambda x: x['time']):
                if current_app and current_time:
                    duration = switch['time'] - current_time
                    if duration > 0 and duration < 3600000:  # Less than 1 hour (in ms)
                        app_durations[current_app] = app_durations.get(current_app, 0) + duration
                
                current_app = switch['app']
                current_time = switch['time']
            
            # Identify potential focus sessions
            focus_apps = {app: duration for app, duration in app_durations.items() 
                         if duration > 600000}  # More than 10 minutes
            
            if focus_apps:
                longest_focus = max(focus_apps.items(), key=lambda x: x[1])
                focus_minutes = longest_focus[1] / 60000  # Convert to minutes
                insights.append(f"Good focus session detected: {focus_minutes:.1f} minutes in {longest_focus[0]}.")
        
        # Context-aware suggestions
        if len(app_switches) > 20:  # Very high task switching
            insights.append("Consider using a focus technique like Pomodoro or time-blocking to reduce context switching.")
        elif len(app_switches) < 3:  # Very low activity
            insights.append("Low activity detected. If you're stuck, try the 2-minute rule or breaking tasks into smaller steps.")
        
        # Combine summaries and insights
        result_parts = []
        
        if day_summaries:
            result_parts.append("USER'S RECENT ACTIVITY HISTORY:")
            result_parts.extend([f"- {summary}" for summary in day_summaries])
            result_parts.append("")  # Empty line for separation
        
        if insights:
            result_parts.append("ACTIVITY PATTERNS & INSIGHTS:")
            result_parts.extend([f"- {insight}" for insight in insights])
            result_parts.append("")  # Empty line for separation
        
        if result_parts:
            return "\n" + "\n".join(result_parts)
        
        return ""
    
    def _setup_rag_graph(self):
        """Set up the RAG graph without persistence"""
        
        # Create retrieve tool
        retrieve_tool = self._create_retrieve_tool()
        
        # Build the graph
        graph_builder = StateGraph(MessagesState)
        
        def query_or_respond(state: MessagesState):
            """Generate tool call for retrieval or respond with activity context awareness."""
            # Add activity context to system message if available
            messages = state["messages"]
            activity_context = getattr(self, '_current_activity_context', None)
            
            # Create an enhanced system message with activity context
            if activity_context:
                activity_summary = self._analyze_activity_context(activity_context)
                enhanced_system_prompt = f"""You are Tether, an AI assistant specifically designed to help people with ADHD stay focused and productive.

CORE PRINCIPLES:
- Keep responses concise (2-3 sentences max)
- Be encouraging and understanding, never judgmental
- Focus on actionable, specific advice
- Break down complex tasks into smaller steps
- Acknowledge ADHD challenges (executive dysfunction, hyperfocus, time blindness)
- Use positive, motivating language

RESPONSE APPROACH - PRIORITIZE EMOTIONAL SUPPORT:
When users express feeling overwhelmed, stressed, or struggling emotionally, use a TWO-STEP approach:

STEP 1: Address their emotional state and ADHD experience first
- Validate their feelings ("Feeling overwhelmed is totally valid, especially with ADHD")
- Offer immediate emotional regulation techniques (deep breathing, grounding, etc.)
- Remind them this feeling is temporary and manageable
- Suggest ADHD-specific coping strategies

STEP 2: Then help with the actual task
- Break down the technical/practical task into small, manageable steps
- Focus on just the very first step to reduce overwhelm
- Remind them they can tackle one piece at a time

DECISION MAKING:
- For questions about personal history, activities, or "what was I doing", use the USER'S ACTIVITY HISTORY below - DO NOT use the retrieve tool
- For questions about ADHD strategies, techniques, or research, use the retrieve tool to get relevant information
- For general conversation or support, you can respond directly or use retrieval if helpful

{activity_summary}

IMPORTANT: You have access to the user's recent activity history above. When they ask about what they were doing (yesterday, today, recently), use this information directly - don't search for it."""
                
                # Replace or add system message
                enhanced_messages = []
                system_added = False
                for msg in messages:
                    if msg.type == "system":
                        enhanced_messages.append(SystemMessage(content=enhanced_system_prompt))
                        system_added = True
                    else:
                        enhanced_messages.append(msg)
                
                if not system_added:
                    enhanced_messages = [SystemMessage(content=enhanced_system_prompt)] + enhanced_messages
                
                messages = enhanced_messages
            
            llm_with_tools = self.llm.bind_tools([retrieve_tool])
            response = llm_with_tools.invoke(messages)
            return {"messages": [response]}
        
        def generate(state: MessagesState):
            """Generate answer using retrieved content."""
            # Get generated ToolMessages
            recent_tool_messages = []
            for message in reversed(state["messages"]):
                if message.type == "tool":
                    recent_tool_messages.append(message)
                else:
                    break
            tool_messages = recent_tool_messages[::-1]
            
            # Format into prompt with RAG content
            docs_content = "\n\n".join(doc.content for doc in tool_messages)
            
            # Create focused prompt for RAG responses
            system_message_content = f"""You are Tether, an AI assistant specifically designed to help people with ADHD stay focused and productive.

CORE PRINCIPLES:
- Keep responses concise (2-3 sentences max)
- Be encouraging and understanding, never judgmental
- Focus on actionable, specific advice
- Break down complex tasks into smaller steps
- Acknowledge ADHD challenges (executive dysfunction, hyperfocus, time blindness)
- Use positive, motivating language

RESPONSE APPROACH - PRIORITIZE EMOTIONAL SUPPORT:
When users express feeling overwhelmed, stressed, or struggling emotionally, use a TWO-STEP approach:

STEP 1: Address their emotional state and ADHD experience first
- Validate their feelings ("Feeling overwhelmed is totally valid, especially with ADHD")
- Offer immediate emotional regulation techniques (deep breathing, grounding, etc.)
- Remind them this feeling is temporary and manageable
- Suggest ADHD-specific coping strategies

STEP 2: Then help with the actual task
- Break down the technical/practical task into small, manageable steps
- Focus on just the very first step to reduce overwhelm
- Remind them they can tackle one piece at a time

RETRIEVED RESEARCH CONTEXT:
{docs_content}

Use the retrieved research context to provide evidence-based ADHD support and strategies. Always prioritize emotional support when users express overwhelm. Respond as Tether in a warm, understanding, and concise way."""
            
            conversation_messages = [
                message
                for message in state["messages"]
                if message.type in ("human", "system")
                or (message.type == "ai" and not message.tool_calls)
            ]
            prompt = [SystemMessage(system_message_content)] + conversation_messages
            
            # Generate response
            response = self.llm.invoke(prompt)
            return {"messages": [response]}
        
        # Add nodes
        tools = ToolNode([retrieve_tool])
        graph_builder.add_node(query_or_respond)
        graph_builder.add_node(tools)
        graph_builder.add_node(generate)
        
        # Add edges
        graph_builder.set_entry_point("query_or_respond")
        graph_builder.add_conditional_edges(
            "query_or_respond",
            tools_condition,
            {END: END, "tools": "tools"},
        )
        graph_builder.add_edge("tools", "generate")
        graph_builder.add_edge("generate", END)
        
        # Compile without persistence (we'll handle persistence manually)
        self.graph = graph_builder.compile()
    
    def create_session(self) -> str:
        """Create a new conversation session"""
        return self.conversation_repo.create_session()
    
    def generate_response(self, message: str, session_id: str, activity_context: List[Dict] = None) -> Dict[str, Any]:
        """Generate a response for the given message and session with optional activity context"""
        try:
            # Get conversation history from our database
            history = self.get_conversation_history(session_id)
            
            # Convert history to LangChain messages
            messages = []
            for msg in history:
                if msg["type"] == "human":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["type"] == "ai":
                    messages.append(AIMessage(content=msg["content"]))
            
            # Add the new user message
            user_message = HumanMessage(content=message)
            messages.append(user_message)
            
            # Store user message in database
            user_msg_id = self.conversation_repo.add_message_simple(session_id, "user", message)
            
            # Store activity context for this request
            self._current_activity_context = activity_context
            
            # Run the graph
            result = None
            for step in self.graph.stream(
                {"messages": messages},
                stream_mode="values"
            ):
                result = step
            
            if result and result["messages"]:
                # Get the last AI message
                last_message = result["messages"][-1]
                if hasattr(last_message, 'content'):
                    response_text = last_message.content
                else:
                    response_text = str(last_message)
                
                # Store assistant response in database
                assistant_msg_id = self.conversation_repo.add_message_simple(session_id, "assistant", response_text)
                
                return {
                    "success": True,
                    "response": response_text,
                    "session_id": session_id,
                    "message_id": assistant_msg_id
                }
            else:
                return {
                    "success": False,
                    "error": "No response generated",
                    "session_id": session_id
                }
                
        except Exception as e:
            print(f"Error generating response: {e}")
            return {
                "success": False,
                "error": str(e),
                "session_id": session_id
            }
    
    def get_conversation_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a session"""
        try:
            return self.conversation_repo.get_message_history(session_id)
        except Exception as e:
            print(f"Error getting conversation history: {e}")
            return []
    
    def clear_session(self, session_id: str):
        """Clear a conversation session"""
        self.conversation_repo.clear_session(session_id)
    
    def list_sessions(self, active_only: bool = True, limit: int = 100) -> List[Dict[str, Any]]:
        """List conversation sessions"""
        return self.conversation_repo.list_sessions(active_only=active_only, limit=limit)
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information"""
        return self.conversation_repo.get_session(session_id)
    
    def get_database_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        return self.conversation_repo.get_stats()

    def health_check(self) -> Dict[str, Any]:
        """Check if the service is healthy"""
        try:
            # Try a simple similarity search
            test_results = self.vector_store.similarity_search("test", k=1)
            
            # Get database stats
            db_stats = self.get_database_stats()
            
            return {
                "status": "healthy",
                "vector_store_loaded": True,
                "documents_indexed": len(test_results) > 0,
                "database_stats": db_stats
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "vector_store_loaded": False
            } 