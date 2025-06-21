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
        session_id = rag_service.create_session()
        return jsonify({
            "success": True,
            "session_id": session_id
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
        
        # Generate response
        result = rag_service.generate_response(message, session_id)
        
        if result["success"]:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 