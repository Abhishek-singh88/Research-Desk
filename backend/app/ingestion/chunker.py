from typing import List

def recursive_chunk_text(text: str, chunk_size: int = 400, overlap: int = 60) -> List[str]:
    """
    Very simple recursive chunking approximation based on words.
    Assuming ~400 words is roughly ~500 tokens.
    """
    words = text.split()
    chunks = []
    i = 0
    if not words:
        return []
    
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        i += chunk_size - overlap
        if chunk_size - overlap <= 0:
            break
    return chunks
