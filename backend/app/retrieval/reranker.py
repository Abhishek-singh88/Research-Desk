import os
import cohere
from typing import List, Dict, Any

def _get_cohere_client():
    api_key = os.environ.get("COHERE_API_KEY")
    if not api_key:
        raise ValueError("COHERE_API_KEY environment variable is not set. Please set it to use Cohere Rerank.")
    return cohere.Client(api_key)

def rerank_results(query: str, results: List[Dict[str, Any]], top_n: int = 5) -> List[Dict[str, Any]]:
    """
    Reranks a list of candidate chunks using Cohere's Rerank API.
    `results` is a list of dicts, each containing 'content'.
    """
    if not results:
        return []
        
    co = _get_cohere_client()
    
    # Extract just the text content for the reranker
    documents = [res["content"] for res in results]
    
    # Call Cohere API
    response = co.rerank(
        model="rerank-english-v3.0",
        query=query,
        documents=documents,
        top_n=top_n
    )
    
    # Reconstruct the final list based on reranked order
    reranked_results = []
    for reranked_doc in response.results:
        original_idx = reranked_doc.index
        item = results[original_idx]
        item["rerank_score"] = reranked_doc.relevance_score
        reranked_results.append(item)
        
    return reranked_results
