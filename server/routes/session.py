"""
Session management routes
"""

from flask import Blueprint, request, jsonify

# Create blueprint for session routes
session_bp = Blueprint('session', __name__)


@session_bp.route("/session", methods=["POST"])
def create_session():
    """Create a new conversation session"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        # Get optional context from request
        data = request.get_json() or {}
        context = data.get("context", "general")
        
        session_id = rag_service.create_session()
        
        # If context is provided, store it as session metadata
        if context != "general":
            # You can add context storage logic here if needed
            pass
            
        return jsonify({
            "success": True,
            "session_id": session_id,
            "context": context
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@session_bp.route("/sessions", methods=["GET"])
def list_user_sessions():
    """List user conversation sessions (non-admin endpoint)"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        # Get query parameters
        limit = int(request.args.get('limit', 50))
        
        sessions = rag_service.list_sessions(active_only=True, limit=limit)
        
        # Format sessions for UI consumption
        formatted_sessions = []
        for session in sessions:
            formatted_sessions.append({
                "id": session["id"],
                "title": f"Chat - {session['created_at'][:10]}",  # Will be updated by title generation
                "context": "general",  # Default context
                "messages": [],  # Empty for listing
                "createdAt": session["created_at"],
                "updatedAt": session["updated_at"]
            })
        
        return jsonify({
            "success": True,
            "data": formatted_sessions
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@session_bp.route("/generate", methods=["POST"])
def generate_response():
    """Generate a response for a given message and session"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        # Get request data
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        message = data.get("message")
        session_id = data.get("session_id")
        activity_context = data.get("activity_context", [])
        
        if not message:
            return jsonify({
                "success": False,
                "error": "Message is required"
            }), 400
        
        if not session_id:
            return jsonify({
                "success": False,
                "error": "Session ID is required"
            }), 400
        
        # Generate response with activity context
        result = rag_service.generate_response(message, session_id, activity_context)
        
        if result["success"]:
            # Format response for ChatService compatibility
            return jsonify({
                "success": True,
                "data": {
                    "message": result.get("response", ""),
                    "sessionId": session_id,
                    "messageId": str(result.get("message_id", ""))
                }
            }), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 