# RAG Pipeline Flask Server

A Flask-based REST API server that provides a Retrieval-Augmented Generation (RAG) pipeline with conversation history support. This server uses Google's Gemini model for text generation and maintains conversation context across multiple exchanges.

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