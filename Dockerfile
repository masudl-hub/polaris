# ============================================
# Polaris — Multi-stage Docker build
# Stage 1: Build React frontend
# Stage 2: Python backend + serve built frontend
# ============================================

# --- Stage 1: Build frontend ---
FROM oven/bun:1 AS frontend-build

WORKDIR /app/frontend-react
COPY frontend-react/package.json frontend-react/bun.lock ./
RUN bun install
COPY frontend-react/ ./
RUN bun run build

# --- Stage 2: Python backend ---
FROM python:3.11-slim

# System deps for OpenCV, spaCy, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Download ML models at build time (baked into image — no cold start penalty)
RUN python -m spacy download en_core_web_sm
RUN python -c "from transformers import pipeline; pipeline('sentiment-analysis', model='cardiffnlp/twitter-roberta-base-sentiment-latest')"
RUN python -c "import gensim.downloader as api; api.load('glove-wiki-gigaword-50')"

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-build /app/frontend-react/dist ./frontend-react/dist

# Cloud Run uses PORT env var (defaults to 8080)
ENV PORT=8080

EXPOSE ${PORT}

CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
