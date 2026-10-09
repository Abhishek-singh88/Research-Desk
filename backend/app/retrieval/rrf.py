from sqlalchemy.orm import Session
from app.retrieval.vector_search import search_chunks_by_vector
from app.retrieval.keyword_search import search_chunks_by_keyword

def hybrid_search_rrf(query: str, db: Session, limit: int = 5, k: int = 60):
    # Fetch broader candidates for fusion
    fetch_limit = max(20, limit * 2)
    
    vector_results = search_chunks_by_vector(query, db, limit=fetch_limit)
    keyword_results = search_chunks_by_keyword(query, db, limit=fetch_limit)
    
    rrf_scores = {}
    chunk_map = {}
    
    # Process vector results (returns DocumentChunk models)
    for rank, chunk in enumerate(vector_results, start=1):
        rrf_scores[chunk.id] = rrf_scores.get(chunk.id, 0.0) + 1.0 / (k + rank)
        chunk_map[chunk.id] = {
            "id": chunk.id,
            "document_id": chunk.document_id,
            "content": chunk.content,
            "page_number": chunk.page_number,
            "retrieval_source": ["vector"]
        }
        
    # Process keyword results (returns SQLAlchemy Rows)
    for rank, row in enumerate(keyword_results, start=1):
        # Rows can be accessed by attribute or index, we used simple select so attributes work
        chunk_id = row.id
        rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
        
        if chunk_id in chunk_map:
            chunk_map[chunk_id]["retrieval_source"].append("keyword")
        else:
            chunk_map[chunk_id] = {
                "id": chunk_id,
                "document_id": row.document_id,
                "content": row.content,
                "page_number": row.page_number,
                "retrieval_source": ["keyword"]
            }

    # Sort by RRF score descending
    sorted_fused = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    
    # Build final top `limit` results
    final_results = []
    for chunk_id, score in sorted_fused[:limit]:
        item = chunk_map[chunk_id]
        item["rrf_score"] = score
        final_results.append(item)
        
    return final_results
