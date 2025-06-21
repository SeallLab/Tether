"""
Conversation management routes
"""

from flask import Blueprint, jsonify

# Create blueprint for conversation routes
conversation_bp = Blueprint('conversation', __name__)


@conversation_bp.route("/conversation/<session_id>", methods=["GET"])
def get_conversation_history(session_id: str):
    """Get conversation history for a session"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        history = rag_service.get_conversation_history(session_id)
        return jsonify({
            "success": True,
            "session_id": session_id,
            "history": history
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@conversation_bp.route("/conversation/<session_id>", methods=["DELETE"])
def clear_conversation(session_id: str):
    """Clear conversation history for a session"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        rag_service.clear_session(session_id)
        return jsonify({
            "success": True,
            "message": f"Session {session_id} cleared"
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 