import os
import psycopg2
from app.db.database import Base, engine
from app.models.document import Document, DocumentChunk

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://admin:password@localhost:5432/research_desk")

def init_db():
    print("Connecting to database to enable pgvector...")
    # We need to connect with psycopg2 directly to enable the extension because
    # it must be done outside a transaction (or at least it's easier this way).
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    print("pgvector extension enabled.")
    cur.close()
    conn.close()

    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully.")

if __name__ == "__main__":
    init_db()
