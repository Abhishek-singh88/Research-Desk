import json
import os
from app.db.database import SessionLocal
from app.retrieval.vector_search import search_chunks_by_vector
from app.retrieval.rrf import hybrid_search_rrf
from app.retrieval.reranker import rerank_results
from app.models.document import Document

def run_evaluation():
    db = SessionLocal()
    
    dataset_path = os.path.join(os.path.dirname(__file__), "evaluation", "dataset.json")
    with open(dataset_path, "r") as f:
        dataset = json.load(f)
        
    doc_map = {doc.title: doc.id for doc in db.query(Document).all()}
    if not doc_map:
        print("=========================================")
        print("Evaluation Script Initialized Successfully!")
        print(f"Loaded {len(dataset)} evaluation questions.")
        print("Warning: Database is currently empty.")
        print("To calculate actual Recall@5 scores, please upload the corresponding PDFs (e.g., 'Attention Is All You Need.pdf') using the POST /documents API, and then run this script again.")
        print("=========================================")
        return
        
    vector_hits = 0
    hybrid_hits = 0
    rerank_hits = 0
    total = len(dataset)
    
    print("Running evaluation...")
    for item in dataset:
        query = item["question"]
        expected_title = item["expected_document"]
        expected_id = doc_map.get(expected_title)
        
        if not expected_id:
            print(f"Skip: {expected_title} not found in database.")
            total -= 1
            continue
            
        # 1. Vector Search
        v_res = search_chunks_by_vector(query, db, limit=5)
        if any(r.document_id == expected_id for r in v_res):
            vector_hits += 1
            
        # 2. Hybrid (RRF)
        h_res = hybrid_search_rrf(query, db, limit=5)
        if any(r["document_id"] == expected_id for r in h_res):
            hybrid_hits += 1
            
        # 3. Hybrid + Reranker
        h_candidates = hybrid_search_rrf(query, db, limit=20)
        try:
            r_res = rerank_results(query, h_candidates, top_n=5)
            if any(r["document_id"] == expected_id for r in r_res):
                rerank_hits += 1
        except Exception:
            pass
            
    if total > 0:
        print(f"--- Evaluation Results (Tested on {total} questions) ---")
        print(f"Vector only Recall@5:       {vector_hits / total:.2%}")
        print(f"Hybrid (RRF) Recall@5:      {hybrid_hits / total:.2%}")
        print(f"Hybrid + Reranker Recall@5: {rerank_hits / total:.2%}")

if __name__ == "__main__":
    run_evaluation()
