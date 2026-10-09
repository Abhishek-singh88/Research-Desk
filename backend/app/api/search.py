from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.retrieval.vector_search import search_chunks_by_vector
from app.retrieval.keyword_search import search_chunks_by_keyword
from app.retrieval.rrf import hybrid_search_rrf
from app.retrieval.reranker import rerank_results

router = APIRouter(prefix="/search", tags=["search"])

class SearchRequest(BaseModel):
    query: str
    limit: int = 5

@router.post("/vector")
def vector_search(request: SearchRequest, db: Session = Depends(get_db)):
    results = search_chunks_by_vector(request.query, db, request.limit)
    return [
        {
            "id": r.id,
            "document_id": r.document_id,
            "content": r.content,
            "page_number": r.page_number
        }
        for r in results
    ]

@router.post("/keyword")
def keyword_search(request: SearchRequest, db: Session = Depends(get_db)):
    results = search_chunks_by_keyword(request.query, db, request.limit)
    return [
        {
            "id": r.id,
            "document_id": r.document_id,
            "content": r.content,
            "page_number": r.page_number,
            "rank": r.rank
        }
        for r in results
    ]

@router.post("/hybrid")
def hybrid_search(request: SearchRequest, db: Session = Depends(get_db)):
    # Get top 20 from RRF to send to reranker
    results = hybrid_search_rrf(request.query, db, limit=20)
    
    # Rerank and keep top N (default 5)
    try:
        final_results = rerank_results(request.query, results, top_n=request.limit)
        return final_results
    except Exception as e:
        # Fallback to RRF if reranker fails (e.g., missing API key)
        return results[:request.limit]
