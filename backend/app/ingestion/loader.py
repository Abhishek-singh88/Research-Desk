import io
from pypdf import PdfReader
from typing import List, Dict, Any

def extract_text_from_pdf(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Extracts text from a PDF file.
    Returns a list of dicts with 'text' and 'metadata' (like page_number).
    """
    reader = PdfReader(io.BytesIO(file_bytes))
    pages_data = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text:
            pages_data.append({
                "text": text,
                "metadata": {"page_number": i + 1}
            })
    return pages_data
