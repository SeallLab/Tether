"""
Info and general routes
"""

from flask import Blueprint, jsonify

# Create blueprint for info routes
info_bp = Blueprint('info', __name__)


@info_bp.route("/", methods=["GET"])
def root():
    """Root endpoint with API information"""
    return jsonify({
        "message": "RAG Pipeline API",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health - Check service health",
            "create_session": "POST /session - Create new conversation session",
            "generate": "POST /generate - Generate response (requires message and session_id)",
            "get_history": "GET /conversation/<session_id> - Get conversation history",
            "clear_session": "DELETE /conversation/<session_id> - Clear conversation history"
        }
    })


@info_bp.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "error": "Endpoint not found",
        "message": "The requested endpoint does not exist"
    }), 404


@info_bp.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        "error": "Internal server error",
        "message": "An unexpected error occurred"
    }), 500 