"""
Flask Server for RAG Pipeline with Conversation History
Provides REST API endpoints for the RAG service
"""

import os
from flask import Flask
from flask_cors import CORS

from services.rag_service import RAGService
from services.database import init_database, check_database_health
from config import Config

# Import blueprints
from routes.health import health_bp
from routes.session import session_bp
from routes.conversation import conversation_bp
from routes.info import info_bp
from routes.admin import admin_bp

# Global RAG service instance
rag_service = None


def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    CORS(app)  # Enable CORS for cross-origin requests
    
    # Register blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(session_bp)
    app.register_blueprint(conversation_bp)
    app.register_blueprint(info_bp)
    app.register_blueprint(admin_bp)
    
    return app


def initialize_database():
    """Initialize the database"""
    print("Initializing database...")
    
    if not init_database(Config.DATABASE_PATH):
        raise RuntimeError("Failed to initialize database")
    
    # Check database health
    health = check_database_health(Config.DATABASE_PATH)
    if health["status"] == "error":
        raise RuntimeError(f"Database health check failed: {health.get('error', 'Unknown error')}")
    
    if health["missing_tables"]:
        print(f"⚠️  Warning: Missing tables: {health['missing_tables']}")
    
    print("Database initialization complete!")


def initialize_rag_service():
    """Initialize the RAG service"""
    global rag_service
    
    try:
        # Validate configuration first
        Config.validate()
        
        # Initialize database first
        initialize_database()
        
        print("Initializing RAG service...")
        rag_service = RAGService(
            vector_store_path=Config.VECTOR_STORE_PATH,
            google_api_key=Config.GOOGLE_API_KEY,
            db_path=Config.DATABASE_PATH
        )
        print("RAG service initialized successfully!")
        
    except Exception as e:
        print(f"Failed to initialize RAG service: {e}")
        raise


def main():
    """Main function to run the Flask application"""
    try:
        # Initialize RAG service
        initialize_rag_service()
        
        # Create Flask app
        app = create_app()
        
        # Start the server
        print(f"Starting server on {Config.FLASK_HOST}:{Config.FLASK_PORT}")
        app.run(
            host=Config.FLASK_HOST,
            port=Config.FLASK_PORT,
            debug=Config.FLASK_DEBUG
        )
        
    except Exception as e:
        print(f"Failed to start server: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main()) 