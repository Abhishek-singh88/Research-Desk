from sqlalchemy.orm import Session
from sqlalchemy import text

def search_chunks_by_keyword(query: str, db: Session, limit: int = 5):
    # Using plainto_tsquery for simple keyword search
    sql_query = text("""
        SELECT id, document_id, content, page_number, chunk_index,
               ts_rank(search_vector, plainto_tsquery('english', :query)) as rank
        FROM document_chunks
        WHERE search_vector @@ plainto_tsquery('english', :query)
        ORDER BY rank DESC
        LIMIT :limit
    """)
    results = db.execute(sql_query, {"query": query, "limit": limit}).fetchall()
    return results
