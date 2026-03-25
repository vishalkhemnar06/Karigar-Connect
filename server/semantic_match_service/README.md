# Semantic Job-Worker Matching Service

This service powers LLM-style semantic matching using Sentence Transformers + FAISS.

## Features

- Multilingual semantic embeddings with Sentence Transformers
- Vector indexing for workers and jobs using FAISS
- Hybrid ranking with semantic + skills + location + experience + pay + availability + verification
- Persistent indexes and metadata on disk
- Feedback ingestion (`viewed`, `invited`, `applied`, `hired`, `completed`, `rejected`) for adaptive weighting

## Setup

1. Create a virtual environment:

   python -m venv .venv

2. Activate it (PowerShell):

   .\.venv\Scripts\Activate.ps1

3. Install dependencies:

   pip install -r requirements.txt

4. Run service:

   uvicorn main:app --host 0.0.0.0 --port 5100

## Environment Variables

- `SEMANTIC_SERVICE_HOST` (default `0.0.0.0`)
- `SEMANTIC_SERVICE_PORT` (default `5100`)
- `SENTENCE_TRANSFORMER_MODEL` (default `paraphrase-multilingual-MiniLM-L12-v2`)
- `SEMANTIC_DATA_DIR` (default `./data`)

## Node Integration

Node backend calls this service through:

- `GET /health`
- `POST /index/rebuild`
- `POST /index/workers/upsert`
- `POST /index/jobs/upsert`
- `DELETE /index/workers/{workerId}`
- `DELETE /index/jobs/{jobId}`
- `POST /match/job/{jobId}`
- `POST /match/worker/{workerId}`
- `POST /feedback`

## Production Notes

- Keep this service behind your private network.
- Use a process manager (systemd, PM2, supervisor, Docker) for auto restart.
- Persist `SEMANTIC_DATA_DIR` on durable disk.
- Consider GPU-backed model hosting for higher throughput.
