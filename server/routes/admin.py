"""
Admin and management routes
"""

from flask import Blueprint, jsonify, request
from services.database import check_database_health, get_database_info
from config import Config

# Create blueprint for admin routes
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route("/sessions", methods=["GET"])
def list_sessions():
    """List conversation sessions"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        # Get query parameters
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        limit = int(request.args.get('limit', 100))
        
        sessions = rag_service.list_sessions(active_only=active_only, limit=limit)
        
        return jsonify({
            "success": True,
            "sessions": sessions,
            "count": len(sessions)
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@admin_bp.route("/sessions/<session_id>", methods=["GET"])
def get_session_info(session_id: str):
    """Get detailed session information"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        session_info = rag_service.get_session_info(session_id)
        
        if session_info is None:
            return jsonify({
                "success": False,
                "error": "Session not found"
            }), 404
        
        return jsonify({
            "success": True,
            "session": session_info
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@admin_bp.route("/stats", methods=["GET"])
def get_database_stats():
    """Get database statistics"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        stats = rag_service.get_database_stats()
        
        return jsonify({
            "success": True,
            "stats": stats
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@admin_bp.route("/sessions/<session_id>", methods=["DELETE"])
def delete_session(session_id: str):
    """Permanently delete a session"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "error": "RAG service not initialized"
        }), 500
    
    try:
        # First check if session exists
        session_info = rag_service.get_session_info(session_id)
        
        if session_info is None:
            return jsonify({
                "success": False,
                "error": "Session not found"
            }), 404
        
        # Delete the session
        rag_service.conversation_repo.delete_session(session_id)
        
        return jsonify({
            "success": True,
            "message": f"Session {session_id} permanently deleted"
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@admin_bp.route("/database/health", methods=["GET"])
def get_database_health():
    """Get database health status"""
    try:
        health = check_database_health(Config.DATABASE_PATH)
        status_code = 200 if health["status"] == "healthy" else 500
        
        return jsonify({
            "success": True,
            "health": health
        }), status_code
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@admin_bp.route("/database/info", methods=["GET"])
def get_database_information():
    """Get detailed database information"""
    try:
        info = get_database_info(Config.DATABASE_PATH)
        
        return jsonify({
            "success": True,
            "database": info
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500 