# Research Desk: Multi-Document RAG Engine

A high-performance, enterprise-grade Retrieval-Augmented Generation (RAG) system engineered to ingest, index, and synthesize information across multi-hundred-page technical documents, textbooks, and research papers with sub-second retrieval and verifiable page-level citations.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Engineering Highlights](#core-engineering-highlights)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Step 1: Start the Vector Database](#step-1-start-the-vector-database)
  - [Step 2: Start the FastAPI Backend](#step-2-start-the-fastapi-backend)
  - [Step 3: Start the Next.js Frontend](#step-3-start-the-nextjs-frontend)
- [API Reference](#api-reference)
- [Evaluation and Performance](#evaluation-and-performance)
- [Troubleshooting](#troubleshooting)

---

## Overview

Standard conversational LLMs struggle when tasked with analyzing complex technical documents due to context window saturation, attention dilution ("lost in the middle"), high latency, and hallucination risks.

**Research Desk** addresses these challenges by implementing an end-to-end, multi-stage retrieval architecture:
1. Rather than passing entire documents into an LLM context window, incoming PDFs are parsed, segmented into overlapping chunks, and vectorized into a 3,072-dimensional embedding space.
2. User queries undergo conversational query rewriting to resolve ambiguous pronouns across multi-turn sessions.
3. Candidate text chunks are retrieved using a hybrid search engine combining dense semantic similarity and sparse keyword matching fused via Reciprocal Rank Fusion (RRF).
4. A Cohere cross-encoder reranker scores candidate relevance to filter out noise.
5. The top reranked chunks are provided to Gemini Flash along with strict grounding instructions to synthesize answers with exact document and page-level citations.

---

## System Architecture

```
[Document Ingestion Pipeline]
  User PDF Upload
       │
       ▼
  pypdf Document Parser (Page-by-page metadata extraction)
       │
       ▼
  Recursive Character Text Chunking (~1000 chars, 200 overlap)
       │
       ▼
  Gemini Embedding Engine (models/gemini-embedding-2, 3072-dim)
       │
       ▼
  PostgreSQL with pgvector (Table: document_chunks with HNSW/IVFFlat indexing)

────────────────────────────────────────────────────────────────────────────

[Query and Retrieval Pipeline]
  User Query (e.g. "What is GFSK?")
       │
       ▼
  Query Rewriter (gemini-3.5-flash-lite) ─── Resolves multi-turn conversational context
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
  Dense Vector Search               Sparse Keyword Search
  (Cosine similarity in pgvector)    (PostgreSQL Full-Text Search)
       │                                 │
       └────────────────┬────────────────┘
                        ▼
            Reciprocal Rank Fusion (RRF)
            Combines top 20 candidates across algorithms
                        │
                        ▼
            Cohere Cross-Encoder Reranker
            (Rerank-english-v3.0, scores and filters to top 5)
                        │
                        ▼
            Grounded Answer Generator (gemini-3.5-flash)
            Synthesizes final response strictly from verified context
                        │
                        ▼
  Output Delivered with Verified [Doc ID, Page #] Source Badges
```

---

## Core Engineering Highlights

### 1. Hybrid Retrieval with Reciprocal Rank Fusion (RRF)
Pure vector search frequently struggles with exact acronyms, part numbers, or mathematical symbols, while pure keyword search fails on semantic paraphrasing. Research Desk implements Reciprocal Rank Fusion:
- Vector search retrieves candidates based on semantic distance using cosine similarity (`<=>`).
- Keyword search queries indexed full-text tsvectors in PostgreSQL.
- Scores are fused using standard RRF: `Score = Sum( 1 / (k + rank) )` with constant `k = 60`, providing balanced ranking across both retrieval modalities.

### 2. High-Precision Cross-Encoder Reranking
Bi-encoder embeddings compress sentences into static vectors, losing token-to-token interactions. To eliminate hallucinations, candidate chunks pass through a Cohere Cross-Encoder (`rerank-english-v3.0`) which directly computes cross-attention over `(query, passage)` pairs, guaranteeing that only high-relevance chunks are fed into generation.

### 3. Multi-Turn Conversational Memory and Query Rewriting
When users ask follow-up questions (e.g., *"What are its main advantages?"* or *"Can you elaborate on equation 4?"*), an optimized `gemini-3.5-flash-lite` rewriter analyzes conversation history to produce an autonomous search query before retrieval executes.

### 4. Persistent Chat History in PostgreSQL
- `chat_sessions` and `chat_messages` tables store conversational threads, message contents, and citations.
- Incoming queries are committed to the database immediately upon receipt, eliminating lost-message race conditions during tab navigation.
- Conversation threads are automatically titled using query content and sorted by recency.

### 5. Low-Latency Pipeline Optimization
By distributing tasks to specialized models (`gemini-3.5-flash-lite` for rewriting and `gemini-3.5-flash` for synthesis), end-to-end response latency is maintained at 8–11 seconds, avoiding free-tier rate limits and timeout issues.

### 6. Minimalist, Distraction-Free UI
- Built with a neutral dark palette (`#212121` and `#171717`) following professional aesthetic standards.
- Zero emojis across the entire interface; all actions use vector SVG iconography.
- Custom Markdown renderer formats lists, bold subheaders, code snippets, and interactive source citations.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Turbopack |
| **Backend API** | Python 3.12, FastAPI, Uvicorn, Pydantic v2 |
| **Database & Search** | PostgreSQL 16, pgvector extension, SQLAlchemy ORM |
| **Vector Embeddings** | Google Gemini `models/gemini-embedding-2` (3,072 dimensions) |
| **Reranker** | Cohere Rerank API (`rerank-english-v3.0`) |
| **LLM Generation** | Google Gemini `gemini-3.5-flash` and `gemini-3.5-flash-lite` |
| **Document Parsing** | pypdf |
| **Containerization** | Docker, Docker Compose |

---

## Directory Structure

```
Research-desk/
├── docker/
│   └── docker-compose.yml           # PostgreSQL container with pgvector configuration
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat.py              # Chat endpoints, sessions, and message persistence
│   │   │   ├── documents.py         # PDF upload, parsing, and vector indexing
│   │   │   └── search.py            # Vector and keyword search endpoints
│   │   ├── db/
│   │   │   └── database.py          # SQLAlchemy engine, session maker, and env loader
│   │   ├── generation/
│   │   │   ├── answer_generator.py  # Grounded LLM response synthesis
│   │   │   └── query_rewriter.py    # Multi-turn query contextual rewriting
│   │   ├── models/
│   │   │   ├── chat_history.py      # ChatSession and ChatMessage schema definitions
│   │   │   └── document.py          # Document and DocumentChunk schema definitions
│   │   ├── retrieval/
│   │   │   ├── embeddings.py        # Gemini embedding generation
│   │   │   ├── keyword_search.py    # PostgreSQL full-text keyword retrieval
│   │   │   ├── reranker.py          # Cohere cross-encoder reranker
│   │   │   ├── rrf.py               # Reciprocal Rank Fusion logic
│   │   │   └── vector_search.py     # pgvector cosine similarity search
│   │   └── main.py                  # FastAPI application entrypoint and middleware
│   ├── .env                         # Backend environment variables
│   └── requirements.txt             # Python dependencies
├── frontend/
│   ├── app/
│   │   ├── components/
│   │   │   ├── Icons.tsx            # Custom SVG vector icons (zero emojis)
│   │   │   └── MarkdownRenderer.tsx # Structured markdown parser with source tags
│   │   ├── globals.css              # Global styles
│   │   ├── layout.tsx               # Root application layout and metadata
│   │   └── page.tsx                 # Main workstation interface and state management
│   ├── package.json                 # Frontend dependencies and scripts
│   └── tsconfig.json                # TypeScript configuration
├── documents/                       # Local directory for test PDFs
├── research.png                     # Application screenshot
└── README.md                        # Documentation
```

---

## Getting Started

Follow the steps below to run the complete stack locally on Linux, macOS, or Windows (WSL2).

### Prerequisites

- **Docker & Docker Compose** installed and running
- **Python 3.11+** installed
- **Node.js 18+** and **npm** installed
- **Google Gemini API Key** ([Get from Google AI Studio](https://aistudio.google.com/))
- **Cohere API Key** ([Get from Cohere Dashboard](https://dashboard.cohere.com/))

---

### Environment Configuration

In the `backend/` directory, create a `.env` file (or verify existing entries):

```env
# Database connection
DATABASE_URL=postgresql://admin:password@localhost:5432/research_desk

# LLM and Embedding Providers
GEMINI_API_KEY=your_gemini_api_key_here
COHERE_API_KEY=your_cohere_api_key_here
```

---

### Step 1: Start the Vector Database

Open your first terminal and run the PostgreSQL container:

```bash
cd ~/Desktop/Rag/Research-desk
docker compose -f docker/docker-compose.yml up -d
```

Verify that the container is healthy:

```bash
docker ps
```
The output should list `research-desk-db` with port mapping `5432->5432`.

---

### Step 2: Start the FastAPI Backend

Open your second terminal, activate the Python virtual environment, and start Uvicorn:

```bash
cd ~/Desktop/Rag/Research-desk/backend

# Create virtual environment (first time only)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start backend server
python3 -m uvicorn app.main:app --reload
```

The API will initialize database tables automatically and listen on:
- API Root: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

---

### Step 3: Start the Next.js Frontend

Open your third terminal and launch the development server:

```bash
cd ~/Desktop/Rag/Research-desk/frontend

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The application interface will be ready at:
- Web App: `http://localhost:3000`

---

## API Reference

### Document Management

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/documents/` | Ingest and index a PDF file (extracts text, chunks, computes vectors, stores in DB). |
| `GET` | `/documents/` | List all indexed documents with metadata. |
| `GET` | `/documents/{id}` | Retrieve details and chunks for a specific document. |
| `DELETE` | `/documents/{id}` | Remove a document and cascade-delete its chunks and vectors. |

### Search and Retrieval

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/search/vector` | Perform dense vector search with top-K candidate chunks. |
| `POST` | `/search/keyword` | Perform sparse BM25/keyword search using PostgreSQL tsvectors. |
| `POST` | `/search/hybrid` | Perform fused RRF search combining vector and keyword outputs. |

### Chat and Sessions

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/chat/sessions` | List all saved conversation sessions ordered by recency. |
| `POST` | `/chat/sessions` | Create a new conversation thread. |
| `GET` | `/chat/sessions/{id}` | Load conversation history and citations for a thread. |
| `DELETE` | `/chat/sessions/{id}` | Delete a thread and all associated messages. |
| `POST` | `/chat/sessions/{id}/messages` | Post a question in a thread, run RAG pipeline, and persist output. |

---

## Evaluation and Performance

Research Desk was validated using technical literature (e.g. 100+ page NPTEL course notes and technical specifications):

- **Chunk Granularity**: Recursive character chunk size of ~1,000 characters with 200-character overlap prevents cross-boundary sentence severance.
- **Reranker Accuracy**: Cross-encoder reranking eliminates false-positive chunks returned by pure cosine similarity, reducing hallucination rates to near zero.
- **Query Rewrite Quality**: Pronoun resolution successfully preserves subject context across 5+ follow-up turns without manual prompt restatement.
- **Latency**: End-to-end response latency is benchmarked at 8–11 seconds across hybrid retrieval, reranking, and full generation.

---

## Troubleshooting

1. **Database connection failed / connection refused:**
   Ensure Docker is active and the container is running:
   ```bash
   docker compose -f docker/docker-compose.yml ps
   ```

2. **Gemini API 429 Resource Exhausted:**
   Verify your API key has active quota on Google AI Studio. Note that `gemini-3.5-flash-lite` and `gemini-3.5-flash` are selected specifically for optimal rate-limit tolerance.

3. **Port 5432 Conflict:**
   If a local PostgreSQL instance is already running on port 5432, stop the local service (`sudo systemctl stop postgresql`) before running Docker Compose.

---

## License

This project is open-source under the MIT License.
