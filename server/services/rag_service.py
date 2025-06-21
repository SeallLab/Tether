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
from langgraph.checkpoint.sqlite import SqliteSaver
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
        
        # Load vector store
        self.load_vector_store(vector_store_path)
        
        # Initialize RAG graph
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
    
    def _setup_rag_graph(self):
        """Set up the RAG graph with conversation history"""
        
        # Create retrieve tool
        retrieve_tool = self._create_retrieve_tool()
        
        # Build the graph
        graph_builder = StateGraph(MessagesState)
        
        def query_or_respond(state: MessagesState):
            """Generate tool call for retrieval or respond."""
            llm_with_tools = self.llm.bind_tools([retrieve_tool])
            response = llm_with_tools.invoke(state["messages"])
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
            
            # Format into prompt
            docs_content = "\n\n".join(doc.content for doc in tool_messages)
            system_message_content = (
                "You are an assistant for question-answering tasks. "
                "Use the following pieces of retrieved context to answer "
                "the question. If you don't know the answer, say that you "
                "don't know. Use three sentences maximum and keep the "
                "answer concise."
                "\n\n"
                f"{docs_content}"
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
        
        # Compile with SQLite persistence
        memory = SqliteSaver.from_conn_string(f"sqlite:///{self.db_path}")
        self.graph = graph_builder.compile(checkpointer=memory)
    
    def create_session(self) -> str:
        """Create a new conversation session"""
        return self.conversation_repo.create_session()
    
    def generate_response(self, message: str, session_id: str) -> Dict[str, Any]:
        """Generate a response for the given message and session"""
        try:
            # Configuration for the session
            config = {"configurable": {"thread_id": session_id}}
            
            # Create human message
            human_message = HumanMessage(content=message)
            
            # Run the graph
            result = None
            for step in self.graph.stream(
                {"messages": [human_message]},
                stream_mode="values",
                config=config,
            ):
                result = step
            
            if result and result["messages"]:
                # Get the last AI message
                last_message = result["messages"][-1]
                if hasattr(last_message, 'content'):
                    response_text = last_message.content
                else:
                    response_text = str(last_message)
                
                return {
                    "success": True,
                    "response": response_text,
                    "session_id": session_id
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
            config = {"configurable": {"thread_id": session_id}}
            
            # Get the current state
            current_state = self.graph.get_state(config)
            
            if current_state and current_state.values.get("messages"):
                messages = current_state.values["messages"]
                history = []
                
                for msg in messages:
                    if msg.type == "human":
                        history.append({
                            "type": "user",
                            "content": msg.content,
                            "timestamp": getattr(msg, 'timestamp', None)
                        })
                    elif msg.type == "ai" and not getattr(msg, 'tool_calls', None):
                        history.append({
                            "type": "assistant",
                            "content": msg.content,
                            "timestamp": getattr(msg, 'timestamp', None)
                        })
                
                return history
            else:
                return []
                
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