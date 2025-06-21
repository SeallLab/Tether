"""
Database initialization and management
"""

import sqlite3
import os
from typing import Optional


def init_database(db_path: str = "conversations.db") -> bool:
    """
    Initialize the database with schema
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        bool: True if initialization was successful
    """
    try:
        # Get schema file path
        schema_path = os.path.join(os.path.dirname(__file__), '..', 'schema.sql')
        
        with sqlite3.connect(db_path) as conn:
            # Enable foreign keys
            conn.execute("PRAGMA foreign_keys = ON")
            
            # Execute schema if it exists
            if os.path.exists(schema_path):
                with open(schema_path, 'r') as f:
                    conn.executescript(f.read())
                print(f"Database initialized from schema at {schema_path}")
            else:
                print(f"Database schema not found at {schema_path}")
        
        print(f"Database ready at: {db_path}")
        return True
        
    except Exception as e:
        print(f"Database initialization failed: {e}")
        return False


def check_database_health(db_path: str = "conversations.db") -> dict:
    """
    Check if the database is accessible and healthy
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        dict: Health status information
    """
    try:
        with sqlite3.connect(db_path) as conn:
            # Check if we can query the database
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
            
            # Check if required tables exist
            required_tables = ['sessions', 'messages', 'checkpoints', 'writes']
            missing_tables = [table for table in required_tables if table not in tables]
            
            return {
                "status": "healthy" if not missing_tables else "warning",
                "database_exists": True,
                "tables": tables,
                "missing_tables": missing_tables,
                "path": db_path
            }
            
    except Exception as e:
        return {
            "status": "error",
            "database_exists": False,
            "error": str(e),
            "path": db_path
        }


def get_database_info(db_path: str = "conversations.db") -> dict:
    """
    Get detailed database information
    
    Args:
        db_path: Path to the SQLite database file
        
    Returns:
        dict: Database information
    """
    info = {
        "path": db_path,
        "exists": os.path.exists(db_path),
        "size_bytes": 0,
        "tables": {},
        "indexes": []
    }
    
    if not info["exists"]:
        return info
    
    try:
        # Get file size
        info["size_bytes"] = os.path.getsize(db_path)
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            
            # Get table information
            cursor = conn.execute("""
                SELECT name, sql FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name;
            """)
            
            for row in cursor.fetchall():
                table_name = row["name"]
                
                # Get row count for each table
                count_cursor = conn.execute(f"SELECT COUNT(*) FROM {table_name}")
                row_count = count_cursor.fetchone()[0]
                
                info["tables"][table_name] = {
                    "row_count": row_count,
                    "schema": row["sql"]
                }
            
            # Get index information
            cursor = conn.execute("""
                SELECT name, tbl_name, sql FROM sqlite_master 
                WHERE type='index' AND name NOT LIKE 'sqlite_%'
                ORDER BY name;
            """)
            
            info["indexes"] = [
                {
                    "name": row["name"],
                    "table": row["tbl_name"],
                    "sql": row["sql"]
                }
                for row in cursor.fetchall()
            ]
            
    except Exception as e:
        info["error"] = str(e)
    
    return info 