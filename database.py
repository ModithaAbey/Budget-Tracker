
import sqlite3
from pathlib import Path

# Find the location of our database file
DATABASE_PATH = Path(__file__).resolve().parent / "expenses.db"


# Connect to the database
def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


# Create the transactions table
def init_db():
    connection = get_connection()

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK (
                    type IN ('income', 'expense')
                ),
                description TEXT NOT NULL,
                amount REAL NOT NULL CHECK (amount > 0),
                category TEXT NOT NULL,
                date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.commit()

    finally:
        connection.close()
