"""
Health check routes
"""

from flask import Blueprint, jsonify

# Create blueprint for health routes
health_bp = Blueprint('health', __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    from app import rag_service
    
    if rag_service is None:
        return jsonify({
            "status": "error",
            "message": "RAG service not initialized"
        }), 500
    
    health_status = rag_service.health_check()
    status_code = 200 if health_status["status"] == "healthy" else 500
    
    return jsonify(health_status), status_code 