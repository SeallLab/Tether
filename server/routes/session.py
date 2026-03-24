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
        first_message = data.get("first_message")
        
        # If first message is provided, create session with LLM-generated name
        if first_message:
            result = rag_service.create_session_with_first_message(first_message)
            return jsonify({
                "success": True,
                "session_id": result["session_id"],
                "name": result["name"],
                "context": context
            }), 200
        else:
            # Fallback to regular session creation
            session_id = rag_service.create_session()
            return jsonify({
                "success": True,
                "session_id": session_id,
                "name": "New Chat",
                "context": context
            }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@session_bp.route("/session/with-message", methods=["POST"])
def create_session_with_message():
    """Create a new conversation session with a first message and LLM-generated name"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        first_message = data.get("first_message")
        
        if not first_message:
            return jsonify({
                "success": False,
                "error": "First message is required"
            }), 400
        
        # Create session with LLM-generated name
        result = rag_service.create_session_with_first_message(first_message)
        
        return jsonify({
            "success": True,
            "session_id": result["session_id"],
            "name": result["name"],
            "context": "general"
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
            # Use the LLM-generated name if available, otherwise fall back to date
            session_name = session.get("name")
            if not session_name or session_name.strip() == "":
                session_name = f"Chat - {session['created_at'][:10]}"
            
            formatted_sessions.append({
                "id": session["id"],
                "title": session_name,
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
        mode = data.get("mode", "general")
        detective_mode = data.get("detective_mode", "teaching")
        
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
        
        # Generate response with activity context and mode
        result = rag_service.generate_response(message, session_id, activity_context, mode, detective_mode)
        
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


@session_bp.route("/checklist/<session_id>/<int:message_id>", methods=["GET"])
def get_checklist(session_id: str, message_id: int):
    """Get checklist items for a specific message"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        items = rag_service.conversation_repo.get_checklist(session_id, message_id)
        return jsonify({
            "success": True,
            "data": items
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@session_bp.route("/checklist/<session_id>/<int:message_id>", methods=["POST"])
def save_checklist(session_id: str, message_id: int):
    """Save checklist items for a Planner mode message"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        tasks = data.get("tasks", [])
        
        if not tasks:
            return jsonify({
                "success": False,
                "error": "Tasks are required"
            }), 400
        
        success = rag_service.conversation_repo.save_checklist(session_id, message_id, tasks)
        
        if success:
            return jsonify({
                "success": True,
                "message": "Checklist saved successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Failed to save checklist"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@session_bp.route("/checklist/<session_id>/<int:message_id>/item/<int:item_id>", methods=["PATCH"])
def update_checklist_item(session_id: str, message_id: int, item_id: int):
    """Update the completion status of a checklist item"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "success": False,
                "error": "No JSON data provided"
            }), 400
        
        is_completed = data.get("isCompleted")
        
        if is_completed is None:
            return jsonify({
                "success": False,
                "error": "isCompleted field is required"
            }), 400
        
        success = rag_service.conversation_repo.update_checklist_item(
            session_id, message_id, item_id, is_completed
        )
        
        if success:
            return jsonify({
                "success": True,
                "message": "Checklist item updated successfully"
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Failed to update checklist item"
            }), 500
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 