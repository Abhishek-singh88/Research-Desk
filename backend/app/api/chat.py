from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.db.database import get_db
from app.retrieval.rrf import hybrid_search_rrf
from app.retrieval.reranker import rerank_results
from app.generation.answer_generator import generate_answer
from app.generation.query_rewriter import rewrite_query

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[ChatMessage]] = []
    
class ChatResponse(BaseModel):
    answer: str
    citations: List[Dict[str, Any]]

@router.post("/", response_model=ChatResponse)
def chat_with_documents(request: ChatRequest, db: Session = Depends(get_db)):
    # 0. Rewrite query for follow-ups
    standalone_query = request.query
    if request.history:
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
        try:
            standalone_query = rewrite_query(request.query, history_dicts)
        except Exception as e:
            print(f"Query rewrite failed: {e}")
            
    # 1. Retrieve top candidates using hybrid search (Phase 5)
    candidates = hybrid_search_rrf(standalone_query, db, limit=20)
    
    # 2. Rerank to get top 5 (Phase 6)
    try:
        final_context = rerank_results(standalone_query, candidates, top_n=5)
    except Exception as e:
        # Fallback if reranker fails (e.g. missing API key)
        final_context = candidates[:5]
        
    # 3. Generate answer (Phase 7)
    try:
        answer = generate_answer(request.query, final_context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Answer generation failed: {str(e)}")
        
    # 4. Prepare citations
    citations = []
    for chunk in final_context:
        citations.append({
            "id": chunk["id"],
            "document_id": chunk["document_id"],
            "page_number": chunk.get("page_number"),
            "content_snippet": chunk["content"][:100] + "..." # Snippet preview
        })
        
    return ChatResponse(answer=answer, citations=citations)
