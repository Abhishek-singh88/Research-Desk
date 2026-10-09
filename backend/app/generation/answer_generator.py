import os
import google.generativeai as genai
from typing import List, Dict, Any

def generate_answer(query: str, context_chunks: List[Dict[str, Any]]) -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set. Please set it to generate answers.")
    
    genai.configure(api_key=api_key)
    
    # Construct context string
    context_str = ""
    for i, chunk in enumerate(context_chunks, start=1):
        page_str = chunk.get('page_number', 'N/A')
        context_str += f"[SOURCE {i}] (Doc ID: {chunk['document_id']}, Page: {page_str}):\n{chunk['content']}\n\n"
        
    prompt = f"""
SYSTEM: Answer using the provided research context. If the context does not support an answer, say so.
Cite the supplied source IDs for factual claims.

QUESTION: {query}

CONTEXT:
{context_str}
"""

    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)
    
    return response.text
