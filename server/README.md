# RAG Pipeline Flask Server

A Flask-based REST API server that provides a Retrieval-Augmented Generation (RAG) pipeline with conversation history support. This server uses Google's Gemini model for text generation and maintains conversation context across multiple exchanges.

## Features

- **RAG Pipeline**: Query documents using semantic search and get AI-generated responses
- **Conversation History**: Maintains context across multiple messages in a session
- **Session Management**: Create, retrieve, and clear conversation sessions
- **Document Indexing**: Separate script to index PDF documents
- **Health Monitoring**: Health check endpoint for service monitoring
- **CORS Support**: Cross-origin resource sharing enabled for web applications

## Architecture

The server is built with:
- **Flask**: Web framework for REST API
- **LangChain**: Framework for building RAG applications
- **LangGraph**: For managing conversation flow and state
- **Google Gemini**: LLM for text generation
- **Google Embeddings**: For document vectorization
- **FAISS Vector Store**: For fast document retrieval
- **SQLite Database**: For persistent conversation storage

## Setup

### Prerequisites

- Python 3.9+
- Google AI API key
- PDF documents to index (optional, but recommended)

### Virtual Environment Setup (Recommended)

It's highly recommended to use a virtual environment to isolate project dependencies and avoid conflicts with other Python projects.

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Create a virtual environment:**
   ```bash
   # Using venv (built-in)
   python3 -m venv venv
   ```

3. **Activate the virtual environment:**
   
   **On macOS/Linux:**
   ```bash
   source venv/bin/activate
   ```
   
   **On Windows:**
   ```bash
   # Command Prompt
   venv\Scripts\activate
   
   # PowerShell
   venv\Scripts\Activate.ps1
   ```

4. **Verify the virtual environment is active:**
   ```bash
   which python  # Should show path to venv/bin/python
   ```

5. **To deactivate the virtual environment later:**
   ```bash
   deactivate
   ```

### Installation

1. **Ensure your virtual environment is activated (see above)**

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   Create a `.env` file:
   ```bash
   cp .env.example .env
   ```

### Document Indexing

Before running the server, you need to create a vector store from your PDF documents:

1. **Place your PDF files in the `../rag/pdfs/` directory**

2. **Run the indexing script:**
   ```bash
   python index_pdfs.py
   ```

   Or with custom parameters:
   ```bash
   python index_pdfs.py --pdf-dir /path/to/pdfs --output my_vector_store
   ```

   This will create a `vector_store/` directory containing the indexed documents.

## Usage

### Starting the Server

**Option 1: Using the run script (recommended)**
```bash
python run.py
```

**Option 2: Direct Flask run**
```bash
python app.py
```

**Option 3: Using Gunicorn (production)**
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### API Endpoints

#### 1. Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "vector_store_loaded": true,
  "documents_indexed": true
}
```

#### 2. Create Session
```http
POST /session
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid-string"
}
```

#### 3. Generate Response
```http
POST /generate
Content-Type: application/json

{
  "message": "What is emotion regulation?",
  "session_id": "uuid-string"
}
```

**Response:**
```json
{
  "success": true,
  "response": "Emotion regulation is the ability to generate, maintain, decrease, and increase the intensity or abundance of emotions...",
  "session_id": "uuid-string"
}
```

#### 4. Get Conversation History
```http
GET /conversation/{session_id}
```

**Response:**
```json
{
  "success": true,
  "session_id": "uuid-string",
  "history": [
    {
      "type": "user",
      "content": "What is emotion regulation?",
      "timestamp": null
    },
    {
      "type": "assistant",
      "content": "Emotion regulation is the ability to...",
      "timestamp": null
    }
  ]
}
```

#### 5. Clear Session
```http
DELETE /conversation/{session_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Session uuid-string cleared"
}
```

### Admin Endpoints

#### 1. List Sessions
```http
GET /admin/sessions?active_only=true&limit=100
```

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "id": "uuid-string",
      "created_at": "2023-01-01T12:00:00",
      "updated_at": "2023-01-01T12:05:00",
      "metadata": {},
      "is_active": true
    }
  ],
  "count": 1
}
```

#### 2. Get Session Info
```http
GET /admin/sessions/{session_id}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid-string",
    "created_at": "2023-01-01T12:00:00",
    "updated_at": "2023-01-01T12:05:00",
    "metadata": {},
    "is_active": true
  }
}
```

#### 3. Database Statistics
```http
GET /admin/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "active_sessions": 5,
    "total_sessions": 10,
    "total_messages": 47,
    "messages_by_type": {
      "human": 23,
      "ai": 21,
      "system": 2,
      "tool": 1
    }
  }
}
```

#### 4. Delete Session (Permanent)
```http
DELETE /admin/sessions/{session_id}
```

**Response:**
```json
{
  "success": true,
  "message": "Session uuid-string permanently deleted"
}
```

#### 5. Database Health Check
```http
GET /admin/database/health
```

**Response:**
```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "database_exists": true,
    "tables": ["sessions", "messages", "checkpoints", "writes"],
    "missing_tables": [],
    "path": "conversations.db"
  }
}
```

#### 6. Database Information
```http
GET /admin/database/info
```

**Response:**
```json
{
  "success": true,
  "database": {
    "path": "conversations.db",
    "exists": true,
    "size_bytes": 12345,
    "tables": {
      "sessions": {
        "row_count": 5,
        "schema": "CREATE TABLE sessions (...)"
      },
      "messages": {
        "row_count": 47,
        "schema": "CREATE TABLE messages (...)"
      }
    },
    "indexes": [
      {
        "name": "idx_messages_session_id",
        "table": "messages",
        "sql": "CREATE INDEX idx_messages_session_id ON messages (session_id)"
      }
    ]
  }
}
```

### Example Usage with Python

```python
import requests
import json

# Base URL
base_url = "http://localhost:5000"

# Create a session
session_response = requests.post(f"{base_url}/session")
session_data = session_response.json()
session_id = session_data["session_id"]

# Send a message
message_data = {
    "message": "What is emotion regulation in ADHD?",
    "session_id": session_id
}

response = requests.post(
    f"{base_url}/generate",
    headers={"Content-Type": "application/json"},
    data=json.dumps(message_data)
)

result = response.json()
print(f"Response: {result['response']}")

# Get conversation history
history_response = requests.get(f"{base_url}/conversation/{session_id}")
history = history_response.json()
print(f"History: {history['history']}")
```

### Example Usage with cURL

```bash
# Create session
curl -X POST http://localhost:5000/session

# Generate response
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{"message": "What is emotion regulation?", "session_id": "your-session-id"}'

# Get conversation history
curl http://localhost:5000/conversation/your-session-id

# Health check
curl http://localhost:5000/health
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Google AI API key | Required |
| `VECTOR_STORE_PATH` | Path to vector store directory | `vector_store` |
| `DATABASE_PATH` | Path to SQLite database file | `conversations.db` |
| `FLASK_HOST` | Flask server host | `0.0.0.0` |
| `FLASK_PORT` | Flask server port | `5000` |
| `FLASK_DEBUG` | Enable Flask debug mode | `false` |
| `FLASK_ENV` | Flask environment | `development` |
| `LANGSMITH_TRACING` | Enable LangSmith tracing | `false` |
| `LANGSMITH_API_KEY` | LangSmith API key | Optional |

### Customization

You can customize the RAG pipeline by modifying:

- **Chunk size and overlap**: Edit `RecursiveCharacterTextSplitter` parameters in `index_pdfs.py`
- **Number of retrieved documents**: Change the `k` parameter in the `retrieve` function
- **LLM model**: Modify the model name in `RAGService.__init__`
- **System prompt**: Update the system message in the `generate` function

## Troubleshooting

### Common Issues

1. **"RAG service not initialized"**
   - Make sure you have set the `GOOGLE_API_KEY` environment variable
   - Ensure the vector store file exists (run `python index_pdfs.py` first)

2. **"Vector store file not found"**
   - Run the indexing script: `python index_pdfs.py`
   - Check the `VECTOR_STORE_PATH` environment variable

3. **"No PDF files found"**
   - Place PDF files in the `../rag/pdfs/` directory
   - Or specify a custom directory with `--pdf-dir`

4. **Import errors**
   - Make sure your virtual environment is activated: `source venv/bin/activate`
   - Install dependencies: `pip install -r requirements.txt`
   - Check Python version (3.9+ required)

### Logging

The server provides detailed console output. For production deployment, consider:

- Using a proper logging configuration
- Setting up log rotation
- Monitoring server health with the `/health` endpoint

## Development

### Project Structure

```
server/
├── app.py              # Flask application
├── rag_service.py      # RAG service implementation
├── index_pdfs.py       # PDF indexing script
├── config.py           # Configuration management
├── run.py              # Production startup script
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

### Contributing

1. Follow PEP 8 style guidelines
2. Add type hints for new functions
3. Update the README for new features
4. Test changes with both development and production configurations

## License

This project is part of the Tether application suite. 