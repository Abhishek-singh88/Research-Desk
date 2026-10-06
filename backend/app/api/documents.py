from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.document import Document, DocumentChunk
from app.ingestion.loader import extract_text_from_pdf
from app.ingestion.chunker import recursive_chunk_text

router = APIRouter(prefix="/documents", tags=["documents"])

@router.post("/")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported currently")
    
    content = await file.read()
    
    try:
        pages = extract_text_from_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")
        
    doc = Document(
        title=file.filename,
        filename=file.filename,
        metadata_info={"source": "upload"}
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    chunk_index = 0
    for page in pages:
        chunks = recursive_chunk_text(page["text"], chunk_size=400, overlap=60)
        for chunk_text in chunks:
            chunk = DocumentChunk(
                document_id=doc.id,
                content=chunk_text,
                page_number=page["metadata"]["page_number"],
                chunk_index=chunk_index,
            )
            db.add(chunk)
            chunk_index += 1
            
    db.commit()
    
    return {"message": "Document uploaded and processed successfully", "document_id": doc.id, "chunks_created": chunk_index}

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).all()
    return docs
