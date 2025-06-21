#!/usr/bin/env python3
"""
Production startup script for the RAG Flask Application
"""

import os
import sys
from config import config, Config
from app import create_app, initialize_rag_service


def setup_environment():
    """Set up the environment and validate configuration"""
    # Get environment mode
    env = os.environ.get('FLASK_ENV', 'development')
    
    # Load configuration
    app_config = config.get(env, config['default'])
    
    # Set environment variables for LangSmith if enabled
    if app_config.LANGSMITH_TRACING and app_config.LANGSMITH_API_KEY:
        os.environ["LANGSMITH_TRACING"] = "true"
        os.environ["LANGSMITH_API_KEY"] = app_config.LANGSMITH_API_KEY
    
    # Validate configuration
    try:
        app_config.validate()
        print(f"✅ Configuration validated for {env} environment")
    except Exception as e:
        print(f"❌ Configuration error: {e}")
        sys.exit(1)
    
    return app_config


def main():
    """Main function to start the Flask application"""
    print("🚀 Starting RAG Pipeline Flask Server...")
    
    # Set up environment
    app_config = setup_environment()
    
    # Initialize RAG service
    try:
        initialize_rag_service()
    except Exception as e:
        print(f"Failed to initialize RAG service: {e}")
        print("Make sure you have:")
        print("1. Set your GOOGLE_API_KEY environment variable")
        print("2. Generated the vector store by running: python index_pdfs.py")
        print("3. Database initialization completed successfully")
        sys.exit(1)
    
    # Create Flask app
    app = create_app()
    
    # Start the Flask application
    print(f"Starting server on {app_config.FLASK_HOST}:{app_config.FLASK_PORT}")
    print(f"Debug mode: {app_config.FLASK_DEBUG}")
    
    try:
        app.run(
            host=app_config.FLASK_HOST,
            port=app_config.FLASK_PORT,
            debug=app_config.FLASK_DEBUG
        )
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 