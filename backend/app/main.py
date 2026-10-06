from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api import documents

from .db.database import engine
from .db import models

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Research Desk API",
    description="API for the Multi-Document Research Assistant",
    version="1.0.0",
)

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Research Desk API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
