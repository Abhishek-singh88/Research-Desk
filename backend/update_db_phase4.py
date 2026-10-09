import os
import psycopg2

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://admin:password@localhost:5432/research_desk")

def update_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    # We change search_vector to TSVECTOR if it's currently TEXT
    cur.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS search_vector;")
    cur.execute("ALTER TABLE document_chunks ADD COLUMN search_vector tsvector;")
    
    # Create index
    cur.execute("CREATE INDEX IF NOT EXISTS search_vector_idx ON document_chunks USING GIN(search_vector);")
    
    # Create trigger for automatic updates
    trigger_func = """
    CREATE OR REPLACE FUNCTION document_chunks_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector('english', COALESCE(NEW.content, ''));
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """
    cur.execute(trigger_func)
    
    trigger_sql = """
    DROP TRIGGER IF EXISTS document_chunks_search_vector_trigger ON document_chunks;
    CREATE TRIGGER document_chunks_search_vector_trigger
    BEFORE INSERT OR UPDATE ON document_chunks
    FOR EACH ROW EXECUTE PROCEDURE document_chunks_search_vector_update();
    """
    cur.execute(trigger_sql)
    
    print("Database updated for Phase 4 (Keyword Search).")
    cur.close()
    conn.close()

if __name__ == "__main__":
    update_db()
