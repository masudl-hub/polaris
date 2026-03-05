# Polaris

**Ad & Post Performance Analysis Platform**

A full-stack ML pipeline that evaluates ad creatives and social posts before deployment — predicting quality scores, engagement metrics, effective CPC, and providing actionable recommendations.

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- ~4GB disk space (ML models downloaded on first run)

### 1. Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
cp .env.example .env  # Add your Gemini API key (optional)
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend
```bash
cd frontend-react
npm install
npm run dev  # Runs on port 5173, proxies /api to :8000
```

### 3. Open
Navigate to [http://localhost:5173](http://localhost:5173)

---

## What It Does

### Ad Analysis (All Platforms)
- **Semantic Pipeline**: spaCy NER, RoBERTa sentiment, GloVe Word2Vec hashtag expansion
- **Visual Pipeline**: Gemini Vision for image/video analysis, OCR, platform fit scoring
- **Trend Forecasting**: Google Trends 90-day momentum, top regions with interest values, related/rising queries
- **SEM Simulation**: Quality score, effective CPC, daily click estimates
- **Market Intelligence**: Industry benchmarks, landing page coherence, Reddit sentiment, competitor analysis
- **Audience Alignment**: IAB Taxonomy + sentence-transformers cosine similarity scoring
- **Creative Alignment**: Trend-to-copy gap analysis with suggested creative angles
- **Executive Diagnostic**: Gemini-synthesized narrative (narrates metrics, does no math)

### LinkedIn Post Prediction
- **Content Quality Score** (0-100): 8 research-backed factors (post length, hook quality, readability, format, hashtags, CTA, sentiment, formatting)
- **Engagement Prediction**: Impressions, reactions, comments, shares via HistGradientBoosting model trained on benchmark-grounded synthetic data
- **Timing Heatmap**: 7x17 grid showing predicted engagement for every day/hour combination
- **Actionable Suggestions**: Research-cited improvements with expected impact percentages

---

## Project Structure

```
polaris/
├── backend/
│   ├── main.py              # FastAPI server + full ML pipeline (SSE streaming)
│   ├── models.py            # Pydantic response schemas
│   ├── linkedin_scorer.py   # LinkedIn post performance predictor
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variable template
├── frontend-react/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Compose.jsx          # Bento-grid input form
│   │   │   ├── Results.jsx          # Results dashboard router
│   │   │   ├── results/             # Section components
│   │   │   └── ui/                  # Shared UI components
│   │   ├── hooks/                   # useAnalysis, useSessions, useTheme
│   │   └── lib/                     # Motion variants, utilities
│   └── index.html
└── run.sh                   # One-command startup script
```

---

## ML Models

| Model | Purpose |
|-------|---------|
| spaCy en_core_web_sm | Named Entity Recognition |
| cardiffnlp/twitter-roberta-base-sentiment | Sentiment scoring |
| GloVe Twitter 50d | Hashtag expansion (cosine similarity) |
| all-MiniLM-L6-v2 | Audience alignment (sentence embeddings) |
| Gemini Vision | Image/video analysis, OCR, platform fit |
| Gemini Flash | Executive diagnostic synthesis |
| HistGradientBoosting | LinkedIn engagement prediction |

---

## License

MIT
