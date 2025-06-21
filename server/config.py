"""
Configuration for the RAG Flask Application
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()


class Config:
    """Base configuration class"""
    
    # Google API Configuration
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    
    # Vector Store Configuration
    VECTOR_STORE_PATH = os.environ.get('VECTOR_STORE_PATH', 'vector_store')
    
    # Database Configuration
    DATABASE_PATH = os.environ.get('DATABASE_PATH', 'conversations.db')
    
    # Flask Configuration
    FLASK_HOST = os.environ.get('FLASK_HOST', '0.0.0.0')
    FLASK_PORT = int(os.environ.get('FLASK_PORT', 5000))
    FLASK_DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    
    # LangSmith Configuration (Optional)
    LANGSMITH_TRACING = os.environ.get('LANGSMITH_TRACING', 'False').lower() == 'true'
    LANGSMITH_API_KEY = os.environ.get('LANGSMITH_API_KEY')
    
    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is required")
        
        if not os.path.exists(cls.VECTOR_STORE_PATH):
            print(f"Warning: Vector store directory not found at {cls.VECTOR_STORE_PATH}")
            print("Make sure to run the indexing script first!")
        
        return True


class DevelopmentConfig(Config):
    """Development configuration"""
    FLASK_DEBUG = True


class ProductionConfig(Config):
    """Production configuration"""
    FLASK_DEBUG = False


# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
} 