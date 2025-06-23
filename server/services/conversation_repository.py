"""
Conversation Repository
Handles database operations for conversation sessions and messages
"""

import sqlite3
import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from uuid import uuid4

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage


class ConversationRepository:
    """Repository for managing conversation data in SQLite"""
    
    def __init__(self, db_path: str = "conversations.db"):
        """
        Initialize the conversation repository
        
        Note: Database must be initialized separately before creating the repository
        """
        self.db_path = db_path
    
    def create_session(self, session_id: str = None, name: str = None, metadata: Dict[str, Any] = None) -> str:
        """Create a new conversation session"""
        if session_id is None:
            session_id = str(uuid4())
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO sessions (id, name, metadata) VALUES (?, ?, ?)",
                (session_id, name, json.dumps(metadata) if metadata else None)
            )
        
        return session_id
    
    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM sessions WHERE id = ? AND is_active = 1",
                (session_id,)
            )
            row = cursor.fetchone()
            
            if row:
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                    "is_active": row["is_active"]
                }
        
        return None
    
    def list_sessions(self, active_only: bool = True, limit: int = 100) -> List[Dict[str, Any]]:
        """List conversation sessions"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            query = "SELECT * FROM sessions"
            params = []
            
            if active_only:
                query += " WHERE is_active = 1"
            
            query += " ORDER BY updated_at DESC LIMIT ?"
            params.append(limit)
            
            cursor = conn.execute(query, params)
            rows = cursor.fetchall()
            
            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "created_at": row["created_at"],
                    "updated_at": row["updated_at"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                    "is_active": row["is_active"]
                }
                for row in rows
            ]
    
    def add_message(self, session_id: str, message: BaseMessage):
        """Add a message to a session"""
        message_type = self._get_message_type(message)
        content = message.content if hasattr(message, 'content') else str(message)
        metadata = self._get_message_metadata(message)
        
        with sqlite3.connect(self.db_path) as conn:
            # Update session's updated_at timestamp
            conn.execute(
                "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (session_id,)
            )
            
            # Insert message
            cursor = conn.execute(
                "INSERT INTO messages (session_id, message_type, content, metadata) VALUES (?, ?, ?, ?)",
                (session_id, message_type, content, json.dumps(metadata) if metadata else None)
            )
            return cursor.lastrowid
    
    def add_message_simple(self, session_id: str, message_type: str, content: str, metadata: Dict[str, Any] = None) -> int:
        """Add a message to a session with simple parameters"""
        # Validate message type
        valid_types = ["human", "ai", "system", "tool", "user", "assistant"]
        if message_type not in valid_types:
            raise ValueError(f"Invalid message type: {message_type}. Must be one of {valid_types}")
        
        # Normalize message types
        if message_type == "user":
            message_type = "human"
        elif message_type == "assistant":
            message_type = "ai"
        
        with sqlite3.connect(self.db_path) as conn:
            # Update session's updated_at timestamp
            conn.execute(
                "UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (session_id,)
            )
            
            # Insert message
            cursor = conn.execute(
                "INSERT INTO messages (session_id, message_type, content, metadata) VALUES (?, ?, ?, ?)",
                (session_id, message_type, content, json.dumps(metadata) if metadata else None)
            )
            return cursor.lastrowid
    
    def get_messages(self, session_id: str, limit: int = 100) -> List[BaseMessage]:
        """Get messages for a session"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
                (session_id, limit)
            )
            rows = cursor.fetchall()
            
            messages = []
            for row in rows:
                message = self._row_to_message(row)
                if message:
                    messages.append(message)
            
            return messages
    
    def get_message_history(self, session_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get message history as dictionaries"""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?",
                (session_id, limit)
            )
            rows = cursor.fetchall()
            
            return [
                {
                    "type": row["message_type"],
                    "content": row["content"],
                    "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
                    "timestamp": row["created_at"]
                }
                for row in rows
            ]
    
    def clear_session(self, session_id: str):
        """Clear/deactivate a session"""
        with sqlite3.connect(self.db_path) as conn:
            # Mark session as inactive
            conn.execute(
                "UPDATE sessions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (session_id,)
            )
            
            # Delete messages
            conn.execute(
                "DELETE FROM messages WHERE session_id = ?",
                (session_id,)
            )
    
    def update_session_name(self, session_id: str, name: str):
        """Update a session's name"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "UPDATE sessions SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (name, session_id)
            )
    
    def delete_session(self, session_id: str):
        """Permanently delete a session"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with sqlite3.connect(self.db_path) as conn:
            stats = {}
            
            # Session stats
            cursor = conn.execute("SELECT COUNT(*) FROM sessions WHERE is_active = 1")
            stats["active_sessions"] = cursor.fetchone()[0]
            
            cursor = conn.execute("SELECT COUNT(*) FROM sessions")
            stats["total_sessions"] = cursor.fetchone()[0]
            
            # Message stats
            cursor = conn.execute("SELECT COUNT(*) FROM messages")
            stats["total_messages"] = cursor.fetchone()[0]
            
            cursor = conn.execute("""
                SELECT message_type, COUNT(*) as count 
                FROM messages 
                GROUP BY message_type
            """)
            stats["messages_by_type"] = {row[0]: row[1] for row in cursor.fetchall()}
            
            return stats
    
    def _get_message_type(self, message: BaseMessage) -> str:
        """Get the string type of a message"""
        if isinstance(message, HumanMessage):
            return "human"
        elif isinstance(message, AIMessage):
            return "ai"
        elif isinstance(message, SystemMessage):
            return "system"
        elif isinstance(message, ToolMessage):
            return "tool"
        else:
            return "unknown"
    
    def _get_message_metadata(self, message: BaseMessage) -> Dict[str, Any]:
        """Extract metadata from a message"""
        metadata = {}
        
        if hasattr(message, 'additional_kwargs') and message.additional_kwargs:
            metadata['additional_kwargs'] = message.additional_kwargs
        
        if hasattr(message, 'tool_calls') and message.tool_calls:
            metadata['tool_calls'] = [
                {
                    'name': tc.get('name', ''),
                    'args': tc.get('args', {}),
                    'id': tc.get('id', '')
                }
                for tc in message.tool_calls
            ]
        
        if hasattr(message, 'tool_call_id'):
            metadata['tool_call_id'] = message.tool_call_id
        
        return metadata
    
    def _row_to_message(self, row) -> Optional[BaseMessage]:
        """Convert a database row to a LangChain message"""
        message_type = row["message_type"]
        content = row["content"]
        metadata = json.loads(row["metadata"]) if row["metadata"] else {}
        
        try:
            if message_type == "human":
                return HumanMessage(content=content, additional_kwargs=metadata.get('additional_kwargs', {}))
            elif message_type == "ai":
                msg = AIMessage(content=content, additional_kwargs=metadata.get('additional_kwargs', {}))
                if 'tool_calls' in metadata:
                    msg.tool_calls = metadata['tool_calls']
                return msg
            elif message_type == "system":
                return SystemMessage(content=content, additional_kwargs=metadata.get('additional_kwargs', {}))
            elif message_type == "tool":
                return ToolMessage(
                    content=content, 
                    tool_call_id=metadata.get('tool_call_id', ''),
                    additional_kwargs=metadata.get('additional_kwargs', {})
                )
        except Exception as e:
            print(f"Error converting row to message: {e}")
            return None
        
        return None 