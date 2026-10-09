from sqlalchemy.orm import Session
from app.models.document import DocumentChunk
from app.retrieval.embeddings import get_query_embedding

def search_chunks_by_vector(query: str, db: Session, limit: int = 5):
    query_embedding = get_query_embedding(query)
    
    # Use pgvector's cosine distance operator
    results = db.query(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_embedding)
    ).limit(limit).all()
    
    return results
