-- RAG Service Database Schema
-- SQLite database schema for conversation persistence

-- Sessions table to track conversation sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    is_active BOOLEAN DEFAULT 1
);

-- Messages table to store conversation messages
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    message_type TEXT NOT NULL, -- 'human', 'ai', 'system', 'tool'
    content TEXT NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
);

-- LangGraph checkpoints table (used by SqliteSaver)
-- This table structure is expected by LangGraph's SqliteSaver
CREATE TABLE IF NOT EXISTS checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    type TEXT,
    checkpoint BLOB,
    metadata BLOB,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

-- LangGraph writes table (used by SqliteSaver)
CREATE TABLE IF NOT EXISTS writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    type TEXT,
    task BLOB,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions (created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions (is_active);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages (session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages (message_type);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread_id ON checkpoints (thread_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON checkpoints (thread_id, checkpoint_ns, checkpoint_id);

CREATE INDEX IF NOT EXISTS idx_writes_thread_id ON writes (thread_id);
CREATE INDEX IF NOT EXISTS idx_writes_checkpoint ON writes (thread_id, checkpoint_ns, checkpoint_id);

-- Triggers to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_sessions_updated_at 
    AFTER UPDATE ON sessions
    FOR EACH ROW
BEGIN
    UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END; 