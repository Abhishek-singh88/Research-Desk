import os
import google.generativeai as genai
from typing import List, Dict

def rewrite_query(current_query: str, conversation_history: List[Dict[str, str]]) -> str:
    """
    Rewrites a follow-up query into a standalone query using conversation history.
    conversation_history format: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    """
    if not conversation_history:
        return current_query
        
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return current_query # fallback to original if no API key
        
    genai.configure(api_key=api_key)
    
    # Format history (take last 4 messages for context window)
    history_str = ""
    for msg in conversation_history[-4:]: 
        role = msg.get("role", "user").upper()
        content = msg.get("content", "")
        history_str += f"{role}: {content}\n"
        
    prompt = f"""
You are a helpful search assistant. Your task is to rewrite the user's latest question into a standalone, clear, and comprehensive search query. 
Use the provided conversation history to understand context (e.g., resolving pronouns like "it", "they", "this method").
If the latest question is already a standalone question and doesn't need context, return it exactly as is.
DO NOT answer the question. ONLY return the rewritten standalone query.

CONVERSATION HISTORY:
{history_str}

LATEST QUESTION:
{current_query}

REWRITTEN STANDALONE QUERY:"""

    # Use gemini-1.5-flash for faster query rewriting
    model = genai.GenerativeModel('gemini-1.5-flash') 
    response = model.generate_content(prompt)
    
    rewritten = response.text.strip()
    return rewritten if rewritten else current_query
