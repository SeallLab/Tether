"""
RAG Service with Conversation History
Handles the retrieval-augmented generation with chat history management
"""

import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
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
        self.llm = init_chat_model("gemini-2.5-flash", model_provider="google_genai")
        self.conversation_repo = ConversationRepository(db_path)
        self.db_path = db_path
        self._current_activity_context = None
        self._current_mode = "general"
        self._current_detective_mode = "teaching"
        
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
    
    def _create_system_prompt(self, mode: str = "general", activity_summary: str = "", docs_content: str = "", detective_mode: str = "teaching") -> str:
        """Create mode-specific system prompts"""
        if mode == "planner":
            return self._create_planner_prompt(activity_summary, docs_content)
        elif mode == "builder":
            return self._create_builder_prompt(activity_summary, docs_content)
        elif mode == "detective":
            return self._create_detective_prompt(activity_summary, docs_content, detective_mode)
        elif mode == "reviewer":
            return self._create_reviewer_prompt(activity_summary, docs_content)
        else:
            return self._create_general_prompt(activity_summary, docs_content)
    
    def _create_general_prompt(self, activity_summary: str = "", docs_content: str = "") -> str:
        """Create the unified ADHD-focused system prompt for general mode"""
        context_section = ""
        if docs_content:
            context_section = f"RETRIEVED RESEARCH CONTEXT:\n{docs_content}\n\n"
        
        return f"""You are Tether, an ADHD support assistant for software engineers.

                SCOPE - ONLY HELP WITH:
                - Software development, coding, debugging
                - ADHD productivity for programming work
                - Managing focus, overwhelm, procrastination while coding
                
                REFUSE REQUESTS ABOUT:
                - Cooking, recipes, baking, general life tasks
                - Non-programming topics
                
                IF OFF-TOPIC: Say "I only help with coding and ADHD productivity for software engineers. Can I help with a programming task instead?"

                RESPONSE STYLE:
                - Keep responses concise (4-5 sentences)
                - Be encouraging, never judgmental
                - Break tasks into small steps
                - When users are overwhelmed: validate feelings first, then help with the task
                - Suggest ADHD strategies like Pomodoro, body doubling, breaking tasks down
                - No medication suggestions

                {context_section}{activity_summary}"""
    
    def _create_planner_prompt(self, activity_summary: str = "", docs_content: str = "") -> str:
        """Create system prompt for Planner (Planning & Architecture) mode"""
        context_section = ""
        if docs_content:
            context_section = f"RETRIEVED RESEARCH CONTEXT:\n{docs_content}\n\n"
        
        return f"""You are Tether PLANNER MODE - help software engineers plan coding projects.

                SCOPE: Only plan SOFTWARE projects. Refuse cooking, recipes, or non-coding requests.
                
                PLANNING WORKFLOW:
                1. FIRST INTERACTION: When user describes a project idea, ask clarifying questions to understand:
                   - What are the core features they want?
                   - What's the tech stack or do they need help choosing?
                   - What's their timeline/scope (MVP vs full featured)?
                   - Any specific challenges or concerns?
                   
                2. GUIDE THE CONVERSATION: Have a brief back-and-forth (2-3 exchanges) to refine the plan
                
                3. GENERATE TASK LIST: Only create the checklist when:
                   - User explicitly says they're ready (e.g., "create the task list", "let's start", "make the checklist")
                   - OR after clarifying questions and user confirms the approach
                   - OR user asks "what should I do first?"

                TASK LIST FORMAT - USE THIS EXACT SYNTAX:
                When generating the task list, use this format:
                
                - [ ] Task 1: Description (15 mins)
                - [ ] Task 2: Description (20 mins)
                - [ ] Task 3: Description
                
                CRITICAL: Use "- [ ]" (dash space bracket space bracket space). 
                DO NOT use bullet points "•" or escaped brackets "\[ ]".

                RULES:
                1. Never generate code - redirect to Builder mode
                2. Don't rush to create the task list - guide first, then plan
                3. Break projects into 5-10 small tasks (15-30 mins each)
                4. Number tasks within checklist items
                5. Add time estimates
                6. Be conversational and encouraging
                
                EXAMPLE FLOW:
                User: "I want to build a todo app"
                You: "Great idea! A todo app is a perfect project. Let me ask a few questions:
                - Should it be web-based, desktop, or mobile?
                - Do you want user accounts and cloud sync, or just local storage?
                - Any special features like priorities, tags, or due dates?
                
                This will help me create a focused task list for you!"
                
                [After user responds and confirms]
                
                ## Project: Todo Application
                
                - [ ] Task 1: Set up project structure (15 mins)
                - [ ] Task 2: Create todo data model (20 mins)
                - [ ] Task 3: Build add todo functionality (30 mins)
                - [ ] Task 4: Implement display todos (20 mins)
                - [ ] Task 5: Add delete/complete functionality (25 mins)

                {context_section}{activity_summary}"""
    
    def _create_builder_prompt(self, activity_summary: str = "", docs_content: str = "") -> str:
        """Create system prompt for Builder (Active Coding) mode"""
        context_section = ""
        if docs_content:
            context_section = f"RETRIEVED RESEARCH CONTEXT:\n{docs_content}\n\n"
        
        return f"""You are Tether BUILDER MODE - teach coding to software engineers with ADHD.

                SCOPE: Only help with CODE. Refuse non-programming requests.

                TEACHING APPROACH:
                1. Explain WHY, not just what
                2. Break code into small chunks
                3. Provide working examples with comments
                4. Celebrate progress, normalize mistakes
                5. Suggest breaks for long sessions

                CODE FORMAT:
                - Brief "What this does" explanation
                - Code with helpful comments  
                - "Why this approach" explanation
                - Optional: "Try experimenting with..." suggestions

                ADHD TIPS:
                - Keep explanations concise (3-4 sentences)
                - Point out what's working first, then issues
                - Remind to save/commit often
                - When stuck, suggest smallest next step

                {context_section}{activity_summary}"""
    
    def _create_detective_prompt(self, activity_summary: str = "", docs_content: str = "", detective_mode: str = "teaching") -> str:
        """Create system prompt for Detective (Debugging) mode"""
        context_section = ""
        if docs_content:
            context_section = f"RETRIEVED RESEARCH CONTEXT:\n{docs_content}\n\n"
        
        mode_specific = ""
        if detective_mode == "teaching":
            mode_specific = """TEACHING MODE: Guide them to find the bug.
                Ask: "What did you expect vs what happened?" "What was the last thing that worked?"
                Help them discover the issue through questions."""
        else:  # quick-fix mode
            mode_specific = """QUICK-FIX MODE: Provide direct solution.
                1. Identify the issue clearly
                2. Show the fix with corrected code
                3. Explain why it failed (1-2 sentences)
                4. How to prevent it next time"""
        
        return f"""You are Tether DETECTIVE MODE - help debug CODE for software engineers with ADHD.

                SCOPE: Only debug CODE. Refuse non-programming requests.

                {mode_specific}

                ADHD SUPPORT:
                - Validate frustration first
                - Break complex errors into small investigation steps
                - Celebrate finding bugs, not just fixing them
                - If stuck >20min, suggest a break

                ERROR ANALYSIS:
                1. Acknowledge their feelings
                2. Explain error in plain English
                3. Identify specific problem location
                4. Provide solution (guided or direct based on mode)
                5. Prevention tips

                {context_section}{activity_summary}"""
    
    def _create_reviewer_prompt(self, activity_summary: str = "", docs_content: str = "") -> str:
        """Create system prompt for Reviewer (Testing & Polish) mode"""
        context_section = ""
        if docs_content:
            context_section = f"RETRIEVED RESEARCH CONTEXT:\n{docs_content}\n\n"
        
        return f"""You are Tether REVIEWER MODE - help finish and polish CODE projects.

                SCOPE: Only review CODE projects. Refuse non-programming requests.

                MISSION: Help software engineers with ADHD complete projects (testing, documentation, reflection).

                DEFINITION OF DONE:
                1. Code works
                2. Basic tests written
                3. Documentation (comments/README)
                4. Learning reflection

                APPROACH:
                - Celebrate working code first
                - One completion task at a time
                - Keep tests simple (2-3 tests, happy path + 1 edge case)
                - Minimal but useful documentation
                
                TESTING: Help write simple unit tests, explain what/why testing
                
                DOCUMENTATION: 
                - Helpful code comments
                - Simple README (What does it do? How to run? What did you learn?)
                
                REFACTORING: Suggest 1-2 simple improvements, not rewrites
                
                REFLECTION: Generate learning summary when done:
                - What you built
                - Key concepts used
                - Challenges overcome
                - What you learned
                - Next steps (optional)

                {context_section}{activity_summary}"""

    def _analyze_activity_context(self, activity_logs: List[Dict]) -> str:
        """Analyze activity logs to provide insights for the LLM"""
        if not activity_logs:
            return ""
        
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
            mode = getattr(self, '_current_mode', 'general')
            detective_mode = getattr(self, '_current_detective_mode', 'teaching')
            
            # Create an enhanced system message with activity context and mode
            activity_summary = self._analyze_activity_context(activity_context) if activity_context else ""
            enhanced_system_prompt = self._create_system_prompt(
                mode=mode,
                activity_summary=activity_summary,
                detective_mode=detective_mode
            )
            
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
            
            # Get current mode settings
            mode = getattr(self, '_current_mode', 'general')
            detective_mode = getattr(self, '_current_detective_mode', 'teaching')
            
            # Create focused prompt for RAG responses using shared function
            system_message_content = self._create_system_prompt(
                mode=mode,
                docs_content=docs_content,
                detective_mode=detective_mode
            )
            
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
        
        # Compile without persistence (we are handling persistence manually)
        self.graph = graph_builder.compile()
    
    def create_session(self) -> str:
        """Create a new conversation session"""
        return self.conversation_repo.create_session()
    
    def _generate_chat_name(self, first_message: str) -> str:
        """Generate a meaningful chat name based on the first message using LLM"""
        try:
            # Create a simple prompt for name generation
            naming_prompt = f"""Generate a short, meaningful title (3-5 words max) for a chat that starts with this message:

"{first_message}"

The title should:
- Be concise and descriptive
- Capture the main topic or intent
- Be suitable for ADHD users (clear, not overwhelming)
- Use title case

Examples:
- "Focus Techniques Help"
- "React Project Setup"
- "Managing Overwhelm"
- "Time Management Tips"

Title:"""

            # Use the LLM to generate the name
            response = self.llm.invoke([HumanMessage(content=naming_prompt)])
            
            # Extract and clean the response
            generated_name = response.content.strip()
            
            # Remove quotes if present
            if generated_name.startswith('"') and generated_name.endswith('"'):
                generated_name = generated_name[1:-1]
            
            # Ensure it's not too long
            if len(generated_name) > 50:
                generated_name = generated_name[:47] + "..."
            
            return generated_name if generated_name else "New Chat"
            
        except Exception as e:
            print(f"Error generating chat name: {e}")
            return "New Chat"
    
    def create_session_with_first_message(self, first_message: str) -> Dict[str, str]:
        """Create a new conversation session and generate a name based on first message"""
        session_id = self.conversation_repo.create_session()
        
        # Generate a meaningful name
        chat_name = self._generate_chat_name(first_message)
        
        # Update the session with the generated name
        self.conversation_repo.update_session_name(session_id, chat_name)
        
        return {
            "session_id": session_id,
            "name": chat_name
        }
    
    def generate_response(self, message: str, session_id: str, activity_context: List[Dict] = None, mode: str = "general", detective_mode: str = "teaching") -> Dict[str, Any]:
        """Generate a response for the given message and session with optional activity context and mode"""
        try:
            # Get conversation history from our database
            history = self.get_conversation_history(session_id)
            
            # Check if this is the first message in the session
            is_first_message = len(history) == 0
            
            # If this is the first message and the session doesn't have a name, generate one
            if is_first_message:
                session_info = self.conversation_repo.get_session(session_id)
                if session_info and (not session_info.get("name") or session_info.get("name") == "New Chat"):
                    # Generate and update the session name
                    chat_name = self._generate_chat_name(message)
                    self.conversation_repo.update_session_name(session_id, chat_name)
            
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
            user_msg_id = self.conversation_repo.add_message_simple(session_id, "user", message, mode=mode)
            
            # Store context and mode for this request
            self._current_activity_context = activity_context
            self._current_mode = mode
            self._current_detective_mode = detective_mode
            
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
                # Store assistant response in database with mode
                assistant_msg_id = self.conversation_repo.add_message_simple(session_id, "assistant", response_text, mode=mode)
                
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