import os
import google.generativeai as genai
from typing import List

def _check_config():
    if not os.environ.get("GEMINI_API_KEY"):
        raise ValueError("GEMINI_API_KEY environment variable is not set. Please set it to use Gemini embeddings.")
    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

def get_embeddings(texts: List[str], task_type: str = "retrieval_document") -> List[List[float]]:
    _check_config()
    if not texts:
        return []
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=texts,
        task_type=task_type
    )
    return result['embedding']

def get_query_embedding(query: str) -> List[float]:
    _check_config()
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=query,
        task_type="retrieval_query"
    )
    return result['embedding']
