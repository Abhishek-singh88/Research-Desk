from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from datetime import datetime
from app.db.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    author = Column(String, nullable=True)
    filename = Column(String)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    metadata_info = Column(JSON, nullable=True) # Changed from 'metadata' to avoid conflict with Base.metadata

    chunks = relationship("DocumentChunk", back_populates="document")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))
    content = Column(Text)
    page_number = Column(Integer, nullable=True)
    section = Column(String, nullable=True)
    chunk_index = Column(Integer)
    embedding = Column(Vector(768)) # Default to 768 (e.g. nomic, text-embedding-004 is 768, OpenAI is 1536)
    
    # In a full setup, we'd define a TSVector column here, but SQLAlchemy doesn't support it perfectly out of the box.
    # We will handle the tsvector generation mostly via raw SQL/triggers or specific DDL.
    search_vector = Column(Text, nullable=True) 
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chunks")
