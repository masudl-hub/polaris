#!/usr/bin/env bash
# ==========================================
# Polaris — One-Command Startup
# ==========================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
VENV_DIR="${BACKEND_DIR}/venv"

echo "⚡ Polaris — Startup"
echo "========================================"

# --- Step 1: Create virtual environment if needed ---
if [ ! -d "${VENV_DIR}" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "${VENV_DIR}"
fi

# --- Step 2: Activate venv ---
source "${VENV_DIR}/bin/activate"

# --- Step 3: Install dependencies ---
echo "📥 Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r "${BACKEND_DIR}/requirements.txt" -q

# --- Step 4: Download spaCy model if needed ---
if ! python -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null; then
    echo "📥 Downloading spaCy en_core_web_sm model..."
    python -m spacy download en_core_web_sm
fi

# --- Step 5: Check for .env file ---
if [ ! -f "${BACKEND_DIR}/.env" ]; then
    echo ""
    echo "⚠️  No .env file found at ${BACKEND_DIR}/.env"
    echo "   Copy .env.example and add your Gemini API key:"
    echo "   cp ${BACKEND_DIR}/.env.example ${BACKEND_DIR}/.env"
    echo ""
    echo "   The app will still work without it, but LLM synthesis will be skipped."
    echo ""
fi

# --- Step 6: Launch server ---
echo ""
echo "🚀 Starting Polaris server..."
echo "   Dashboard: http://localhost:8000"
echo "   API Docs:  http://localhost:8000/docs"
echo "   Health:    http://localhost:8000/health"
echo "========================================"
echo ""

cd "${BACKEND_DIR}"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
