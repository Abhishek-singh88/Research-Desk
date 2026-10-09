from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.document import Document, DocumentChunk
from app.ingestion.loader import extract_text_from_pdf
from app.ingestion.chunker import recursive_chunk_text
from app.retrieval.embeddings import get_embeddings

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
    
    all_chunks_text = []
    chunk_metadata = []
    chunk_index = 0
    
    for page in pages:
        chunks = recursive_chunk_text(page["text"], chunk_size=400, overlap=60)
        for chunk_text in chunks:
            all_chunks_text.append(chunk_text)
            chunk_metadata.append({
                "page_number": page["metadata"]["page_number"],
                "chunk_index": chunk_index
            })
            chunk_index += 1
            
    # Generate embeddings in batch
    embeddings = []
    if all_chunks_text:
        try:
            embeddings = get_embeddings(all_chunks_text)
        except Exception as e:
            # If embedding fails, we could rollback or store without it.
            # Here we let it fail explicitly so the user knows.
            raise HTTPException(status_code=500, detail=f"Failed to generate embeddings: {str(e)}")
            
    # Store chunks in DB
    for text, meta, emb in zip(all_chunks_text, chunk_metadata, embeddings):
        chunk = DocumentChunk(
            document_id=doc.id,
            content=text,
            page_number=meta["page_number"],
            chunk_index=meta["chunk_index"],
            embedding=emb
        )
        db.add(chunk)
            
    db.commit()
    
    return {"message": "Document uploaded and processed successfully", "document_id": doc.id, "chunks_created": chunk_index}

@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).all()
    return docs
