from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.db.database import get_db
from app.retrieval.vector_search import search_chunks_by_vector

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
