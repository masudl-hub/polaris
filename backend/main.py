"""
Polaris — Multi-Modal Ad Resonance & Trend Predictor
Production-grade FastAPI backend with full DAG pipeline.
"""

import os
import cv2
import time
import asyncio
import tempfile
import math
import numpy as np
import pandas as pd
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv

# --- ML & Data Libraries ---
import spacy
from transformers import pipeline as hf_pipeline
import gensim.downloader as gensim_api
from pytrends.request import TrendReq
from google import genai
from google.genai import types

from models import (
    EvaluationResponse, QuantitativeMetrics,
    TextAnalysis, SentimentBreakdown, VisionAnalysis, TrendAnalysis, SEMMetrics, ErrorResponse, PipelineStep,
    IndustryBenchmark, LandingPageCoherence, RedditSentiment, CreativeAlignment, CompetitorIntel,
    AudienceAnalysis, LinkedInPostAnalysis,
)

import json as _json_module
import httpx
from bs4 import BeautifulSoup

load_dotenv()

# ==========================================
# GLOBAL MODEL REFERENCES
# ==========================================
nlp_model = None
sentiment_analyzer = None
word2vec_model = None
gemini_client = None
audience_scorer = None  # Sentence transformer + pre-computed audience embeddings


# ==========================================
# LIFESPAN: Load models on startup
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global nlp_model, sentiment_analyzer, word2vec_model, gemini_client, audience_scorer

    print("=" * 60)
    print("🚀 Polaris — Loading ML Models into memory...")
    print("=" * 60)

    # 1. spaCy NER
    print("[1/3] Loading spaCy NER model (en_core_web_sm)...")
    nlp_model = spacy.load("en_core_web_sm")

    # 2. RoBERTa Sentiment
    print("[2/3] Loading HuggingFace RoBERTa sentiment model...")
    sentiment_analyzer = hf_pipeline(
        "text-classification",
        model="cardiffnlp/twitter-roberta-base-sentiment",
        top_k=None,
        device=-1,  # CPU; change to 0 for GPU
    )

    # 3. GloVe Word2Vec
    print("[3/3] Loading GloVe Twitter 50d vectors...")
    word2vec_model = gensim_api.load("glove-twitter-50")

    # 4. Gemini Client
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        gemini_client = genai.Client(api_key=api_key)
        print("✅ Gemini client initialized.")
    else:
        print("⚠️  GEMINI_API_KEY not set — LLM synthesis will be skipped.")

    # 5. Sentence Transformer for audience scoring
    print("[5/5] Loading sentence-transformers for audience scoring...")
    audience_scorer = _load_audience_scorer()
    print(f"✅ Audience scorer ready ({len(audience_scorer['embeddings'])} tags)")

    print("=" * 60)
    print("✅ All models loaded. Server is ready.")
    print("=" * 60)

    yield  # App runs here

    print("Shutting down Polaris...")


# ==========================================
# APP INIT
# ==========================================
app = FastAPI(
    title="Polaris",
    description="Multi-Modal Ad Resonance & Trend Predictor",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount frontend static files — prefer React build, fall back to legacy
REACT_DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend-react", "dist")
LEGACY_FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.isdir(REACT_DIST_DIR):
    FRONTEND_DIR = REACT_DIST_DIR
    # Serve Vite assets from /assets/
    assets_dir = os.path.join(REACT_DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
else:
    FRONTEND_DIR = LEGACY_FRONTEND_DIR

if os.path.isdir(LEGACY_FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=LEGACY_FRONTEND_DIR), name="static")


@app.get("/")
async def serve_frontend():
    """Serve the frontend index.html."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Polaris API is running. Frontend not found."}


# ==========================================
# PIPELINE 1: SEMANTIC (NLP)
# ==========================================
def run_ner(text: str) -> List[str]:
    """Extract named entities using spaCy NER, with noun phrase fallback."""
    text = text.replace("\n", " ").replace("\r", " ")
    cleaned = text.strip().replace(".", "").replace(",", "").strip()
    if len(cleaned) < 3:
        return []
    doc = nlp_model(text)
    target_labels = {"ORG", "PRODUCT", "GPE", "PERSON", "WORK_OF_ART", "EVENT"}
    entities = list(set(
        ent.text.strip()
        for ent in doc.ents
        if ent.label_ in target_labels and len(ent.text.strip()) > 1
    ))
    # Fallback: if no named entities, extract key noun chunks
    if not entities:
        noun_chunks = list(set(
            chunk.root.text.strip().lower()
            for chunk in doc.noun_chunks
            if len(chunk.root.text.strip()) > 2
            and chunk.root.pos_ in {"NOUN", "PROPN"}
            and chunk.root.text.lower() not in {"something", "thing", "one", "way", "lot", "kind"}
        ))
        entities = noun_chunks[:5]
    # Last resort: extract any nouns
    if not entities:
        nouns = list(set(
            token.text.strip().lower()
            for token in doc
            if token.pos_ in {"NOUN", "PROPN"} and len(token.text.strip()) > 2
        ))
        entities = nouns[:5]
    return entities


def run_sentiment(text: str) -> dict:
    """Score sentiment using RoBERTa. Returns dict with composite score + breakdown."""
    # Refuse to score empty or meaningless text — no fake analysis
    cleaned = text.strip().replace(".", "").replace(",", "").strip()
    if len(cleaned) < 3:
        return None

    results = sentiment_analyzer(text[:512])
    if not results or not results[0]:
        return None

    scores = {item["label"]: item["score"] for item in results[0]}
    neg = round(scores.get("LABEL_0", 0.0), 4)
    neu = round(scores.get("LABEL_1", 0.0), 4)
    pos = round(scores.get("LABEL_2", 0.0), 4)

    composite = round(min(max((pos * 1.0) + (neu * 0.5) + (neg * 0.0), 0.0), 1.0), 4)
    return {"score": composite, "positive": pos, "neutral": neu, "negative": neg}


def run_word2vec_expansion(hashtags: List[str], top_n: int = 5, fallback_words: List[str] = None) -> List[str]:
    """Expand hashtags via GloVe cosine similarity. Falls back to entity/noun expansion."""
    # Build seed words from hashtags + fallback words (entities, nouns from ad text)
    seed_words = []
    for tag in hashtags:
        tag_clean = tag.strip().lower().replace("#", "")
        if tag_clean:
            seed_words.append(tag_clean)
    if fallback_words:
        for w in fallback_words:
            w_clean = w.strip().lower().replace("#", "")
            if w_clean and w_clean not in seed_words:
                seed_words.append(w_clean)

    if not seed_words:
        return None

    candidates = set()
    for word in seed_words:
        if word in word2vec_model:
            similar = word2vec_model.most_similar(word, topn=top_n * 2)
            for sim_word, score in similar:
                if score > 0.55:  # Slightly lower threshold for broader suggestions
                    candidates.add(f"#{sim_word}")

    # Deduplicate against input
    input_set = {f"#{w}" for w in seed_words}
    expanded = [c for c in candidates if c not in input_set]
    return sorted(expanded, key=lambda x: x)[:top_n]


# ==========================================
# PIPELINE 2: VISUAL (Gemini Vision)
# ==========================================
def run_vision_pipeline(file_path: str, is_video: bool, platform: str = "Meta", ad_placements: str = "") -> VisionAnalysis:
    """Analyze image/video using Gemini Vision -- OCR, object ID, placement-aware style assessment."""
    import json as _json

    with open(file_path, "rb") as f:
        file_bytes = f.read()

    # For video: extract middle frame, send as JPEG
    if is_video:
        cap = cv2.VideoCapture(file_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
            ret, frame = cap.read()
            cap.release()
            if ret:
                _, buf = cv2.imencode(".jpg", frame)
                file_bytes = buf.tobytes()
            else:
                return None
        else:
            cap.release()
            return None
        mime = "image/jpeg"
    else:
        ext = os.path.splitext(file_path)[1].lower()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                    ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp"}
        mime = mime_map.get(ext, "image/jpeg")

    # Placement-specific best practices
    PLACEMENT_CONTEXT = {
        "Meta": {
            "_default": "Facebook/Instagram ad across all placements. Consider that this creative may appear in Feed (square/4:5), Stories/Reels (vertical 9:16), Right Column (small thumbnail), and Marketplace. Evaluate versatility across formats.",
            "Feed": "Facebook/Instagram Feed ad. Best practices: square (1:1) or portrait (4:5) aspect ratio, eye-catching visuals, clear CTA, under 20% text overlay, bright colors.",
            "Stories": "Facebook/Instagram Stories ad. Best practices: vertical 9:16 full-screen, bold text in safe zones (top/bottom 14% reserved for UI), faces and motion, 5-15s ideal.",
            "Reels": "Facebook/Instagram Reels ad. Best practices: vertical 9:16, authentic UGC-style feel, fast-paced motion, text overlays with captions, hook in first 1-2 seconds.",
            "Right Column": "Facebook Right Column ad. Best practices: small format (254x133px effective), must be legible at tiny size, bold single image, minimal text, high contrast.",
            "Marketplace": "Facebook Marketplace ad. Best practices: product-focused square image, clean white/neutral background, clear product visibility, price-relevant styling.",
        },
        "Google": {
            "_default": "Google ad across all placements. Consider Search (text-focused), Display (banner imagery), YouTube (video pre-roll), and Discovery formats.",
            "Search": "Google Search ad. Best practices: text-centric, responsive search ad format, compelling headlines, clear value proposition. Visual creative used as optional image extension.",
            "Display": "Google Display Network ad. Best practices: multiple sizes (300x250, 728x90, 160x600), clean layout, prominent CTA button, professional imagery, brand logo visible.",
            "YouTube Pre-roll": "YouTube pre-roll video ad. Best practices: landscape 16:9, hook in first 5 seconds (before skip), brand early, clear audio, CTA overlay in final frames.",
            "Discovery": "Google Discovery ad. Best practices: aspirational lifestyle imagery, 1200x628 or square, editorial feel, minimal text overlay, swipeable carousel option.",
            "Shopping": "Google Shopping ad. Best practices: clean product image on white/neutral background, no text overlay, accurate product representation, high resolution.",
        },
        "TikTok": {
            "_default": "TikTok ad. Best practices: vertical 9:16, authentic/UGC feel, faces and people, motion/energy, lo-fi outperforms polished, text overlays common.",
            "In-Feed": "TikTok In-Feed ad. Best practices: vertical 9:16, native UGC feel, hook in first 1s, trending audio/effects, creator-style content, 15-30s sweet spot.",
            "TopView": "TikTok TopView ad. Best practices: vertical 9:16, premium polished feel (unlike typical TikTok), full-screen takeover, sound-on design, up to 60s, strong brand moment.",
            "Branded Effect": "TikTok Branded Effect ad. Best practices: AR/filter-style interactive element, fun and shareable, encourages user participation, brand integration subtle not forced.",
            "Spark Ads": "TikTok Spark Ads (boosted organic). Best practices: authentic creator content, minimal brand intrusion, native look and feel, existing organic post format.",
        },
        "X": {
            "_default": "X/Twitter ad across all placements. Bold visuals, concise text, high contrast.",
            "Timeline": "X/Twitter Timeline ad. Best practices: 1200x675 landscape or 1:1 square, bold visuals, high contrast, works at small sizes in feed, single focal point, concise text.",
            "Explore": "X/Twitter Explore ad. Best practices: eye-catching hero image, trend-worthy content, broader appeal, 1200x675, can be bolder/more editorial than timeline.",
            "Amplify Pre-roll": "X/Twitter Amplify pre-roll video ad. Best practices: landscape 16:9, hook in 2-3 seconds, brand in first frame, content-adjacent tone, 6-15s ideal.",
        },
        "LinkedIn": {
            "_default": "LinkedIn ad. Best practices: professional imagery, 1200x627 landscape, minimal text overlay, corporate/editorial style.",
            "Feed": "LinkedIn Feed ad. Best practices: 1200x627 landscape or 1:1 square, professional imagery, data/insight-driven, minimal text overlay, corporate/editorial style, clear value proposition.",
            "Sponsored Message": "LinkedIn Sponsored Message ad. Best practices: personalized tone, concise CTA, professional but conversational, banner image 300x250, single clear action.",
            "Dynamic": "LinkedIn Dynamic ad. Best practices: personalized with member profile data, clean professional look, simple CTA, auto-generated format, brand logo prominent.",
            "Video": "LinkedIn Video ad. Best practices: landscape or square, professional production value, subtitles required (85% watch muted), 15-30s for awareness, hook in first 3s.",
        },
        "Snapchat": {
            "_default": "Snapchat ad. Best practices: vertical full-screen, bold colors, large text, young/casual aesthetic, faces and motion.",
            "Full Screen": "Snapchat Full Screen ad. Best practices: vertical 9:16, bold colors, large legible text, young/casual aesthetic, faces and motion, swipe-up CTA, under 6s ideal.",
            "Story": "Snapchat Story ad. Best practices: vertical 9:16, series of 3-20 snaps, narrative arc, each snap stands alone, branded but native feel, sound-on design.",
            "Spotlight": "Snapchat Spotlight ad. Best practices: vertical 9:16, TikTok-style short-form, trending content feel, UGC aesthetic, music-driven, entertaining first / brand second.",
            "Collection": "Snapchat Collection ad. Best practices: vertical product showcase, tappable product tiles, lifestyle hero image at top, clean product shots below, shopping-focused.",
        },
    }

    placements_list = [p.strip() for p in ad_placements.split(",") if p.strip()] if ad_placements else []

    platform_contexts = PLACEMENT_CONTEXT.get(platform, {})
    if placements_list:
        # Build context from selected placements
        context_parts = []
        for pl in placements_list:
            ctx = platform_contexts.get(pl)
            if ctx:
                context_parts.append(ctx)
        if context_parts:
            platform_context = " | ".join(context_parts)
        else:
            platform_context = platform_contexts.get("_default", "social media ad")
    else:
        platform_context = platform_contexts.get("_default", "social media ad")

    prompt = (
        f'Analyze this ad creative for {platform}. Context: {platform_context} '
        'Return ONLY valid JSON with these exact keys: '
        '{"visual_tags": ["list of objects, products, people, elements you see"], '
        '"extracted_text": "ALL text visible in the image exactly as written", '
        '"brand_detected": "brand name if any logo or brand visible, or null", '
        '"style": "one of: polished, ugc, minimal, bold, editorial, corporate", '
        '"is_cluttered": true or false, '
        f'"platform_fit": "how well this creative fits {platform} best practices (good/fair/poor)", '
        f'"platform_fit_score": "a precise score from 1 to 10 rating how well this creative fits {platform} best practices. '
        '1=terrible fit, 5=acceptable, 10=perfect. Consider aspect ratio, visual style, text density, audience expectations, '
        'and platform-specific norms. Be granular — use the full 1-10 range, not just 3/5/8", '
        f'"platform_suggestions": "1-2 specific suggestions to improve this creative for {platform}", '
        '"description": "one sentence describing what this ad is about"}. '
        'Return ONLY the JSON object. No markdown fences. No explanation.'
    )

    # Retry Gemini vision calls with exponential backoff
    response = None
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = gemini_client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime),
                    prompt,
                ],
            )
            if response.text:
                break
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                print(f"⚠️  Gemini vision attempt {attempt + 1}/{max_retries} failed ({e}), retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise

    text = response.text if response else None
    if not text:
        return None

    # Parse JSON -- strip markdown fences if present
    text = text.strip()
    fence = chr(96) * 3
    if text.startswith(fence):
        lines = text.split(chr(10))
        text = chr(10).join(lines[1:])
    if text.endswith(fence):
        text = text[:-3]
    text = text.strip()
    if text.startswith("json"):
        text = text[4:].strip()

    try:
        data = _json.loads(text)
    except _json.JSONDecodeError:
        return VisionAnalysis(
            visual_tags=["(could not parse vision response)"],
            extracted_text=text[:200],
            is_cluttered=False,
        )

    # Extract numeric platform_fit_score, coerce to float
    pfs_raw = data.get("platform_fit_score")
    platform_fit_score = None
    if pfs_raw is not None:
        try:
            platform_fit_score = float(pfs_raw)
            platform_fit_score = max(1.0, min(10.0, platform_fit_score))
        except (ValueError, TypeError):
            platform_fit_score = None

    return VisionAnalysis(
        visual_tags=data.get("visual_tags", []),
        extracted_text=data.get("extracted_text"),
        brand_detected=data.get("brand_detected"),
        style_assessment=data.get("style") or data.get("description"),
        is_cluttered=data.get("is_cluttered", False),
        platform_fit=data.get("platform_fit"),
        platform_fit_score=platform_fit_score,
        platform_suggestions=data.get("platform_suggestions"),
    )


# ==========================================
# PIPELINE 3: TREND FORECASTING
# ==========================================
def _pytrends_with_retry(keywords, geo, max_retries=3):
    """Build pytrends payload with exponential backoff retries on 429/connection errors."""
    for attempt in range(max_retries):
        try:
            pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
            pytrends.build_payload(keywords, cat=0, timeframe="today 3-m", geo=geo)
            return pytrends
        except Exception as e:
            err_str = str(e).lower()
            is_retryable = "429" in err_str or "too many" in err_str or "response" in err_str or "connection" in err_str or "timeout" in err_str
            if attempt < max_retries - 1 and is_retryable:
                wait = 2 ** attempt + 1  # 2s, 3s, 5s
                print(f"⚠️  pytrends attempt {attempt + 1}/{max_retries} failed ({e}), retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise


def run_trend_analysis(entities: List[str], geo: str) -> Optional[TrendAnalysis]:
    """
    Full Google Trends analysis: momentum + related queries + regional interest.
    Returns structured TrendAnalysis with real data from 3 pytrends endpoints.
    Includes retry logic for transient pytrends failures.
    """
    if not entities:
        return None

    keywords = entities[:5]

    try:
        pytrends = _pytrends_with_retry(keywords, geo)

        # 1. Interest over time → momentum
        momentum = None
        data_points = 0
        df = pytrends.interest_over_time()
        if not df.empty:
            if "isPartial" in df.columns:
                df = df.drop(columns=["isPartial"])
            data_points = len(df)
            avg_series = df.mean(axis=1)
            recent_7d = avg_series.tail(7).mean()
            recent_30d = avg_series.tail(30).mean()
            if recent_30d > 0:
                raw = recent_7d / recent_30d
                # Sigmoid mapping centered at 1.0 (flat trend = 0.5)
                # Symmetric: 50% decline → ~0.18, 50% growth → ~0.82
                # Full range used: near-zero interest → ~0.0, doubling → ~0.95
                momentum = round(1.0 / (1.0 + math.exp(-3.0 * (raw - 1.0))), 4)

        # 2. Related queries → content ideas + rising trends
        related_top = []
        related_rising = []
        try:
            rq = pytrends.related_queries()
            for kw, data in rq.items():
                if data.get("top") is not None:
                    related_top.extend(data["top"]["query"].head(8).tolist())
                if data.get("rising") is not None:
                    related_rising.extend(data["rising"]["query"].head(5).tolist())
        except Exception:
            pass

        # If related queries came back empty, retry with lowercase generic terms
        # (proper nouns like "Heinz" often return no related queries)
        if not related_top and not related_rising:
            try:
                lower_kws = [k.lower() for k in keywords if k.lower() != k]
                if lower_kws:
                    pytrends.build_payload(lower_kws[:5], cat=0, timeframe="today 3-m", geo=geo)
                    rq2 = pytrends.related_queries()
                    for kw, data in rq2.items():
                        if data.get("top") is not None:
                            related_top.extend(data["top"]["query"].head(8).tolist())
                        if data.get("rising") is not None:
                            related_rising.extend(data["rising"]["query"].head(5).tolist())
            except Exception:
                pass

        # 3. Interest by region → geo validation
        top_regions = []
        try:
            ibr = pytrends.interest_by_region(resolution="COUNTRY", inc_low_vol=False)
            if not ibr.empty:
                col = ibr.columns[0]
                top5 = ibr.nlargest(5, col)
                top_regions = [{"name": name, "interest": int(row[col])} for name, row in top5.iterrows()]
        except Exception:
            pass  # interest_by_region can fail independently

        # Deduplicate
        related_top = list(dict.fromkeys(related_top))[:8]
        related_rising = list(dict.fromkeys(related_rising))[:5]

        # Extract time series for sparkline
        time_series = []
        if not df.empty:
            avg_series = df.mean(axis=1)
            time_series = [round(float(v), 1) for v in avg_series.tolist()]

        return TrendAnalysis(
            momentum=momentum,
            related_queries_top=related_top,
            related_queries_rising=related_rising,
            top_regions=top_regions,
            keywords_searched=keywords,
            data_points=data_points,
            time_series=time_series,
        )

    except Exception as e:
        print(f"Google Trends error: {e}")
        return None


# ==========================================
# SEM COST ENGINE (Business Logic)
# ==========================================

# Platform-specific CPC multipliers (industry averages relative to Meta)
PLATFORM_CPC_MULTIPLIER = {
    "Meta": 1.0,
    "Google": 1.6,      # Search intent = higher CPC
    "TikTok": 0.7,      # Cheaper but less intent
    "X": 0.85,
    "LinkedIn": 2.4,     # B2B premium
    "Snapchat": 0.6,     # Cheapest, younger demo
}

# Geo competition index (relative ad market saturation)
GEO_COMPETITION = {
    "US": 1.0,
    "GB": 0.9,
    "CA": 0.85,
    "AU": 0.88,
    "DE": 0.82,
    "FR": 0.78,
    "JP": 0.92,
    "BR": 0.55,
    "IN": 0.40,
    "KR": 0.80,
}

def calculate_sem_metrics(
    sentiment_score,
    trend_momentum,
    visual_authenticity,
    base_cpc: float,
    daily_budget: float,
    platform: str = "Meta",
    geo: str = "US",
) -> SEMMetrics:
    """
    Platform & geo-aware Quality Score + Auction Simulation.
    Only scores dimensions that have REAL data. None values are excluded, not faked.
    """
    # Build weighted components — only include dimensions with real data
    components = []  # list of (value, weight, name)
    if sentiment_score is not None:
        components.append((sentiment_score, 0.35, "sentiment"))
    if trend_momentum is not None:
        components.append((trend_momentum, 0.30, "trend"))
    if visual_authenticity is not None:
        components.append((visual_authenticity, 0.35, "visual_platform_fit"))

    # Quality Score — renormalize weights to sum to 1.0 based on available data
    if not components:
        # Nothing to score — return minimum
        quality_score = 1.0
    else:
        total_weight = sum(w for _, w, _ in components)
        raw_qs = sum(v * (w / total_weight) for v, w, _ in components)
        quality_score = round(max(1.0, min(10.0, raw_qs * 10)), 2)

    # Platform and geo adjustments to CPC
    plat_mult = PLATFORM_CPC_MULTIPLIER.get(platform, 1.0)
    geo_comp = GEO_COMPETITION.get(geo, 0.75)

    # Auction simulation modeled after Google Ads: higher QS = lower CPC.
    # The ×5.0 is the midpoint reference QS — at QS=5 you pay face value (base_cpc × plat × geo).
    # QS=10 → 50% discount. QS=1 → 5× penalty. This mirrors real auction dynamics where
    # ad rank = bid × quality, and you pay just enough to beat the next-lowest rank.
    effective_cpc = round((base_cpc * plat_mult * geo_comp * 5.0) / quality_score, 4)

    # Daily clicks
    daily_clicks = max(1, int(daily_budget / effective_cpc))

    return SEMMetrics(
        quality_score=quality_score,
        effective_cpc=effective_cpc,
        daily_clicks=daily_clicks,
    )


# ==========================================
# PIPELINE: LANDING PAGE COHERENCE
# ==========================================
async def run_landing_page_coherence(url: str, ad_entities: List[str], ad_sentiment: Optional[float], headline: str) -> Optional[LandingPageCoherence]:
    """Fetch landing page, compare entities/sentiment with ad copy."""
    if not url or not url.startswith(("http://", "https://")):
        return None

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Polaris/1.0"})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        # Remove script/style
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        page_text = soup.get_text(separator=" ", strip=True)[:5000]

        # Check entities on page
        page_lower = page_text.lower()
        matched = [e for e in ad_entities if e.lower() in page_lower]
        missing = [e for e in ad_entities if e.lower() not in page_lower]

        # Check headline on page
        headline_found = headline.lower().strip() in page_lower if headline.strip() else False

        # Sentiment of page text
        page_sentiment_result = run_sentiment(page_text[:512])
        page_sent = page_sentiment_result["score"] if page_sentiment_result else None

        # Sentiment alignment
        sent_align = None
        if ad_sentiment is not None and page_sent is not None:
            sent_align = round(1.0 - abs(ad_sentiment - page_sent), 4)

        # Coherence score
        entity_ratio = len(matched) / max(len(ad_entities), 1)
        headline_bonus = 0.15 if headline_found else 0.0
        sent_bonus = (sent_align * 0.25) if sent_align is not None else 0.0
        coherence = round(min(1.0, entity_ratio * 0.6 + headline_bonus + sent_bonus), 4)

        # Issues
        issues = []
        if not headline_found and headline.strip():
            issues.append("Ad headline not found on landing page")
        if len(missing) > len(matched):
            issues.append(f"{len(missing)} of {len(ad_entities)} ad entities missing from page")
        if sent_align is not None and sent_align < 0.5:
            issues.append("Sentiment mismatch between ad copy and landing page")

        return LandingPageCoherence(
            url=url, coherence_score=coherence,
            matched_entities=matched, missing_entities=missing,
            sentiment_alignment=sent_align, headline_found=headline_found,
            issues=issues,
        )
    except Exception as e:
        print(f"Landing page error: {e}")
        return LandingPageCoherence(
            url=url, coherence_score=0.0,
            issues=[f"Failed to fetch: {str(e)}"],
        )


# ==========================================
# PIPELINE: REDDIT COMMUNITY SENTIMENT
# ==========================================
async def run_reddit_sentiment(entities: List[str]) -> Optional[RedditSentiment]:
    """Search Reddit for discussions about ad entities, analyze sentiment."""
    if not entities:
        return None

    query = " ".join(entities[:3])
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.reddit.com/search.json",
                params={"q": query, "sort": "relevance", "limit": 25, "t": "month"},
                headers={"User-Agent": "Polaris/1.0"},
            )
            resp.raise_for_status()
            data = resp.json()

        posts = data.get("data", {}).get("children", [])
        if not posts:
            return RedditSentiment(query=query, post_count=0)

        titles = [p["data"].get("title", "") for p in posts if p["data"].get("title")]
        subreddits = [p["data"].get("subreddit", "") for p in posts if p["data"].get("subreddit")]

        # Aggregate sentiment across titles
        sentiments = []
        for title in titles[:15]:
            s = run_sentiment(title)
            if s:
                sentiments.append(s)

        avg_sent = None
        breakdown = None
        if sentiments:
            avg_sent = round(sum(s["score"] for s in sentiments) / len(sentiments), 4)
            avg_pos = round(sum(s["positive"] for s in sentiments) / len(sentiments), 4)
            avg_neu = round(sum(s["neutral"] for s in sentiments) / len(sentiments), 4)
            avg_neg = round(sum(s["negative"] for s in sentiments) / len(sentiments), 4)
            breakdown = SentimentBreakdown(positive=avg_pos, neutral=avg_neu, negative=avg_neg)

        # Extract themes via NER on combined titles
        combined = " ".join(titles[:10])
        theme_entities = run_ner(combined)

        # Language patterns — find recurring 2-word phrases
        from collections import Counter
        all_words = combined.lower().split()
        bigrams = [f"{all_words[i]} {all_words[i+1]}" for i in range(len(all_words)-1)]
        common_bigrams = [bg for bg, count in Counter(bigrams).most_common(5) if count >= 2]

        # Top subreddits
        top_subs = [s for s, _ in Counter(subreddits).most_common(5)]

        return RedditSentiment(
            query=query, post_count=len(posts),
            avg_sentiment=avg_sent, sentiment_breakdown=breakdown,
            themes=theme_entities[:8], language_patterns=common_bigrams[:5],
            top_subreddits=top_subs,
        )
    except Exception as e:
        print(f"Reddit error: {e}")
        return None


# ==========================================
# PIPELINE: INDUSTRY BENCHMARKS
# ==========================================
_benchmarks_data = None

def _load_benchmarks():
    global _benchmarks_data
    if _benchmarks_data is None:
        bench_path = os.path.join(os.path.dirname(__file__), "benchmarks.json")
        with open(bench_path, "r") as f:
            _benchmarks_data = _json_module.load(f)
    return _benchmarks_data

def run_industry_benchmark(industry: str, platform: str, user_ecpc: Optional[float] = None) -> Optional[IndustryBenchmark]:
    """Look up industry benchmarks and compare with user's eCPC."""
    if not industry:
        return None

    benchmarks = _load_benchmarks()
    industry_lower = industry.lower().strip()
    platform_lower = platform.lower().strip()

    if industry_lower not in benchmarks:
        return None
    if platform_lower not in benchmarks[industry_lower]:
        return None

    b = benchmarks[industry_lower][platform_lower]

    cpc_delta = None
    verdict = None
    if user_ecpc is not None and b["avg_cpc"] > 0:
        cpc_delta = round(((user_ecpc - b["avg_cpc"]) / b["avg_cpc"]) * 100, 1)
        if cpc_delta < -15:
            verdict = "above_average"  # lower CPC = better
        elif cpc_delta > 15:
            verdict = "below_average"  # higher CPC = worse
        else:
            verdict = "average"

    return IndustryBenchmark(
        industry=industry, platform=platform,
        avg_cpc=b["avg_cpc"], avg_ctr=b["avg_ctr"],
        avg_cvr=b["avg_cvr"], avg_cpa=b["avg_cpa"],
        user_ecpc=user_ecpc, cpc_delta_pct=cpc_delta, verdict=verdict,
    )


# ==========================================
# PIPELINE: TREND-TO-CREATIVE ALIGNMENT
# ==========================================
def run_creative_alignment(trend_data: Optional[TrendAnalysis], ad_text: str, entities: List[str]) -> Optional[CreativeAlignment]:
    """Use GloVe cosine similarity to find alignment between trending queries and ad copy."""
    if not trend_data:
        return None

    trending = trend_data.related_queries_top + trend_data.related_queries_rising
    if not trending:
        return None

    ad_words = set()
    for word in ad_text.lower().split():
        w = word.strip(".,!?;:'\"").strip()
        if w and len(w) > 2 and w in word2vec_model:
            ad_words.add(w)
    for ent in entities:
        w = ent.lower().strip()
        if w and w in word2vec_model:
            ad_words.add(w)

    if not ad_words:
        return CreativeAlignment(alignment_score=0.0, gap_trends=trending[:5])

    matched = []
    gaps = []

    for query in trending:
        query_words = [w.strip() for w in query.lower().split() if w.strip() in word2vec_model]
        if not query_words:
            continue

        # Best cosine similarity between any query word and any ad word
        best_sim = 0.0
        for qw in query_words:
            for aw in ad_words:
                try:
                    sim = word2vec_model.similarity(qw, aw)
                    best_sim = max(best_sim, sim)
                except KeyError:
                    pass

        if best_sim > 0.55:
            matched.append(query)
        else:
            gaps.append(query)

    total = len(matched) + len(gaps)
    score = round(len(matched) / max(total, 1), 4)

    # Generate creative angles from gap trends
    angles = []
    for gap in gaps[:4]:
        angles.append(f"Incorporate '{gap}' into ad copy to align with trending searches")

    return CreativeAlignment(
        alignment_score=score,
        matched_trends=matched[:8],
        gap_trends=gaps[:8],
        creative_angles=angles,
    )


# ==========================================
# PIPELINE: AUDIENCE ALIGNMENT (IAB + Sentence Transformers)
# ==========================================

# IAB Audience Taxonomy-grounded audience tags
# Each tag maps to IAB segments + a natural language description derived from them
AUDIENCE_TAGS = {
    "Gen-Z (18-24)": {
        "iab": ["Demographic|Age Range|18-20", "Demographic|Age Range|21-24", "Interest|Technology & Computing", "Interest|Video Gaming", "Interest|Pop Culture", "Interest|Style & Fashion"],
        "desc": "Adults aged 18-24 interested in technology, video gaming, pop culture, style and fashion, social networking apps, music and audio, short-form entertainment content",
    },
    "Millennials (25-39)": {
        "iab": ["Demographic|Age Range|25-29", "Demographic|Age Range|30-34", "Demographic|Age Range|35-39", "Interest|Travel", "Interest|Food & Drink", "Interest|Careers", "Interest|Home & Garden"],
        "desc": "Adults aged 25-39 interested in travel, food and drink, career development, home and garden, healthy living, personal finance, family and relationships",
    },
    "Parents": {
        "iab": ["Demographic|Household Data|Number of Children", "Demographic|Household Data|Life Stage", "Interest|Family and Relationships", "Interest|Education", "Purchase Intent|Family and Parenting"],
        "desc": "Parents and caregivers of children, interested in family activities, education, parenting advice, children's products, baby care, kids health, family-friendly entertainment",
    },
    "Professionals": {
        "iab": ["Demographic|Education & Occupation|Professional", "Demographic|Education & Occupation|Director/Managerial", "Interest|Business and Finance", "Interest|Careers"],
        "desc": "Working professionals in managerial and director roles, interested in business strategy, finance, productivity tools, career advancement, industry news, enterprise solutions",
    },
    "Luxury Buyers": {
        "iab": ["Demographic|Personal Finance|Personal Level Affluence", "Interest|Style & Fashion", "Interest|Fine Art", "Interest|Travel", "Purchase Intent|Jewelry and Watches"],
        "desc": "High-income affluent consumers interested in luxury fashion, fine art, premium travel, designer brands, jewelry and watches, exclusive experiences, aspirational lifestyle",
    },
    "Budget Shoppers": {
        "iab": ["Interest|Shopping", "Purchase Intent|Shopping|Coupons and Discounts", "Purchase Intent|Shopping|Comparison Shopping"],
        "desc": "Price-conscious consumers interested in deals, coupons, discounts, comparison shopping, sales events, budget-friendly products, value for money, clearance and promotions",
    },
    "Health & Fitness": {
        "iab": ["Interest|Healthy Living", "Interest|Health and Medical Services", "Purchase Intent|Health and Fitness", "Purchase Intent|Sports and Fitness"],
        "desc": "Health-conscious individuals interested in fitness, exercise, nutrition, wellness, gym equipment, supplements, healthy eating, mental health, outdoor activities, yoga and meditation",
    },
    "Tech Enthusiasts": {
        "iab": ["Interest|Technology & Computing", "Purchase Intent|Technology and Computing", "Purchase Intent|Consumer Electronics"],
        "desc": "Technology enthusiasts interested in consumer electronics, software, gadgets, AI and machine learning, smartphones, computers, smart home devices, tech reviews, programming",
    },
    "Homeowners": {
        "iab": ["Demographic|Household Data|Ownership", "Demographic|Household Data|Property Type", "Interest|Home & Garden", "Interest|Real Estate"],
        "desc": "Homeowners interested in home improvement, renovation, interior design, real estate, gardening, landscaping, home appliances, furniture, property maintenance, DIY projects",
    },
    "Students": {
        "iab": ["Demographic|Age Range|18-20", "Demographic|Age Range|21-24", "Demographic|Education & Occupation|College Education", "Interest|Education", "Interest|Academic Interests"],
        "desc": "College and university students interested in education, academic resources, textbooks, student discounts, campus life, study tools, internships, career planning, affordable products",
    },
    "Small Business Owners": {
        "iab": ["Interest|Business and Finance", "Purchase Intent|Business and Industrial", "Purchase Intent|Business and Industrial|Business Services"],
        "desc": "Small business owners and entrepreneurs interested in business tools, marketing, accounting software, logistics, hiring, business loans, e-commerce platforms, growth strategies",
    },
    "Foodies": {
        "iab": ["Interest|Food & Drink", "Purchase Intent|Food and Beverages", "Purchase Intent|Restaurants"],
        "desc": "Food enthusiasts interested in restaurants, cooking, recipes, gourmet food, wine, craft beverages, food delivery, kitchen equipment, culinary experiences, food trends",
    },
    "Gamers": {
        "iab": ["Interest|Video Gaming", "Purchase Intent|Consumer Electronics|Gaming"],
        "desc": "Video gaming enthusiasts interested in PC and console gaming, esports, game downloads, gaming accessories, streaming, game reviews, RPG, FPS, mobile games, gaming communities",
    },
    "Eco-Conscious": {
        "iab": ["Purchase Intent|Home and Garden|Green Living", "Purchase Intent|Vehicles|Electric Vehicles", "Interest|Healthy Living"],
        "desc": "Environmentally conscious consumers interested in sustainability, eco-friendly products, renewable energy, electric vehicles, organic goods, recycling, climate action, green living",
    },
    "Sports Fans": {
        "iab": ["Interest|Sports", "Purchase Intent|Sports and Fitness", "Purchase Intent|Apparel|Athletic Wear"],
        "desc": "Sports fans interested in athletic events, team sports, running, cycling, sports apparel, athletic shoes, fitness gear, sports news, live events and tickets, outdoor recreation",
    },
}


def _load_audience_scorer():
    """Load sentence-transformers model and pre-compute audience embeddings."""
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = {}
    for tag, data in AUDIENCE_TAGS.items():
        desc_emb = model.encode(data["desc"], normalize_embeddings=True)
        path_emb = model.encode(" | ".join(data["iab"]), normalize_embeddings=True)
        # Blend: 70% natural language, 30% IAB taxonomy paths
        blended = 0.7 * desc_emb + 0.3 * path_emb
        blended = blended / np.linalg.norm(blended)
        embeddings[tag] = blended
    return {"model": model, "embeddings": embeddings}


def run_audience_analysis(ad_text: str, selected_tag: str) -> Optional[AudienceAnalysis]:
    """Score ad copy against IAB-grounded audience segments using sentence embeddings."""
    if not audience_scorer or not ad_text.strip():
        return None
    if selected_tag not in AUDIENCE_TAGS:
        return None

    try:
        model = audience_scorer["model"]
        embeddings = audience_scorer["embeddings"]

        ad_emb = model.encode(ad_text, normalize_embeddings=True)

        scores = {}
        for tag, tag_emb in embeddings.items():
            score = float(ad_emb @ tag_emb)
            scores[tag] = max(0.0, score)  # clamp negatives

        # Normalize to 0-1 range (divide by max possible)
        max_score = max(scores.values()) if scores else 1.0
        if max_score > 0:
            normalized = {tag: round(s / max_score, 3) for tag, s in scores.items()}
        else:
            normalized = {tag: 0.0 for tag in scores}

        ranked = sorted(normalized.items(), key=lambda x: -x[1])
        alignment_score = normalized.get(selected_tag, 0.0)

        return AudienceAnalysis(
            selected_tag=selected_tag,
            alignment_score=alignment_score,
            top_audiences=[{"tag": tag, "score": score} for tag, score in ranked],
        )
    except Exception as e:
        print(f"Audience analysis error: {e}")
        return None


# ==========================================
# PIPELINE: META COMPETITOR ANALYSIS
# ==========================================
async def run_competitor_analysis(brand: str) -> Optional[CompetitorIntel]:
    """Query Meta Ad Library API for competitor ad data."""
    if not brand or not brand.strip():
        return None

    fb_token = os.getenv("FACEBOOK_ACCESS_TOKEN")
    if not fb_token:
        return CompetitorIntel(
            brand=brand, status="skipped",
            note="No FACEBOOK_ACCESS_TOKEN configured",
        )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://graph.facebook.com/v19.0/ads_archive",
                params={
                    "access_token": fb_token,
                    "search_terms": brand,
                    "ad_type": "ALL",
                    "ad_reached_countries": '["US"]',
                    "fields": "id,ad_creation_time,ad_creative_bodies,ad_creative_link_titles",
                    "limit": 50,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        ads = data.get("data", [])
        if not ads:
            return CompetitorIntel(brand=brand, ad_count=0, note="No active ads found")

        # Calculate metrics
        from datetime import datetime
        longevities = []
        formats = {"text": 0, "link": 0, "other": 0}
        now = datetime.utcnow()

        for ad in ads:
            created = ad.get("ad_creation_time")
            if created:
                try:
                    dt = datetime.fromisoformat(created.replace("Z", "+00:00").replace("+00:00", ""))
                    days = (now - dt).days
                    longevities.append(days)
                except (ValueError, TypeError):
                    pass
            if ad.get("ad_creative_link_titles"):
                formats["link"] += 1
            elif ad.get("ad_creative_bodies"):
                formats["text"] += 1
            else:
                formats["other"] += 1

        avg_longevity = round(sum(longevities) / len(longevities), 1) if longevities else None

        return CompetitorIntel(
            brand=brand, ad_count=len(ads),
            avg_longevity_days=avg_longevity,
            format_breakdown=formats,
        )
    except Exception as e:
        print(f"Competitor analysis error: {e}")
        return CompetitorIntel(brand=brand, status="error", note=str(e))


# ==========================================
# LLM SYNTHESIS LAYER
# ==========================================
def generate_executive_diagnostic(
    metrics: QuantitativeMetrics,
    headline: str,
    platform: str,
    audience: str,
) -> str:
    """
    Send deterministic metrics to Gemini 3 Flash Preview for narrative synthesis.
    The LLM does NO math — it only narrates the pre-computed numbers.
    """
    if not gemini_client:
        return (
            "LLM synthesis unavailable (GEMINI_API_KEY not configured). "
            "Review the quantitative metrics above for your analysis."
        )

    metrics_payload = metrics.model_dump_json(indent=2)

    system_prompt = """You are a senior media-buying strategist writing an executive diagnostic for an ad creative.

You will receive a JSON payload of pre-computed metrics from a multi-model ML pipeline. Your job:
- Narrate and interpret the REAL numbers — do NOT invent statistics
- Be platform-specific: reference the target platform's norms and best practices
- If trend data includes related_queries_top or related_queries_rising, use them to suggest content angles
- If vision data includes platform_fit or platform_suggestions, incorporate those directly
- If any metric is null, acknowledge the gap honestly

Write exactly 5 sections:

**Performance Summary**: What the quality score and predicted CPC/clicks mean for this campaign on this specific platform. If industry benchmarks are available, compare the user's eCPC to the industry average and explain the verdict.

**Creative Analysis**: What the vision pipeline found — brand detection, visual style, platform fit assessment, text extracted from the image. Is this creative right for the platform? If landing page coherence data is available, mention entity match rate and any coherence issues.

**Trend & Market Context**: What Google Trends data shows — is the topic trending up or down? What are people searching for related to this? Which regions show the most interest? If Reddit sentiment data is available, reference community sentiment and key themes. If creative alignment data is available, mention gap trends the ad copy is missing.

**Competitive Context**: If competitor intelligence data is available, summarize key findings. If not, skip this section.

**3 Specific Improvements**: Three concrete, actionable changes the marketer should make. Each should reference a specific pipeline finding. Be specific — not "improve your copy" but "your headline lacks a CTA — add one like 'Shop Now' since Meta ads with CTAs see 2x higher CTR." If creative alignment gaps exist, use them as improvement suggestions.

Keep it under 400 words. Be direct, specific, and platform-aware."""

    user_prompt = f"""Ad Headline: {headline}
Platform: {platform}
Target Audience: {audience}

Pre-computed Metrics (DO NOT recalculate — just narrate):
{metrics_payload}"""

    # Retry Gemini diagnostic calls with exponential backoff
    max_retries = 3
    last_error = None
    for attempt in range(max_retries):
        try:
            response = gemini_client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=f"{system_prompt}\n\n{user_prompt}",
            )
            text = response.text
            if text:
                return text.strip()
            reason = response.candidates[0].finish_reason if response.candidates else 'unknown'
            print(f'Gemini returned no text (attempt {attempt + 1}). Finish reason: {reason}')
            if attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                print(f"⚠️  Retrying Gemini diagnostic in {wait}s...")
                time.sleep(wait)
                continue
            return 'LLM synthesis returned empty. The quantitative metrics above are still valid.'
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                print(f"⚠️  Gemini diagnostic attempt {attempt + 1}/{max_retries} failed ({e}), retrying in {wait}s...")
                time.sleep(wait)
            else:
                print(f"⚠️  Gemini error after {max_retries} attempts: {e}")
                return f"LLM synthesis failed: {str(last_error)}. Review the quantitative metrics above."


# ==========================================
# MAIN API ENDPOINT
# ==========================================
@app.post(
    "/api/v1/evaluate_ad",
    response_model=EvaluationResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def evaluate_ad(
    headline: str = Form(default="", description="Ad headline text"),
    body: str = Form(default="", description="Ad body copy"),
    hashtags: str = Form(default="", description="Comma-separated hashtags"),
    audience: str = Form(default="General audience", description="Target audience description"),
    geo: str = Form(default="US", description="2-letter geo code (US, GB, etc.)"),
    platform: str = Form(default="Meta", description="Ad platform"),
    ad_placements: str = Form(default="", description="Comma-separated ad placements (e.g. Feed,Stories,Reels). Empty = all placements."),
    base_cpc: float = Form(default=1.50, description="Industry base CPC in dollars"),
    budget: float = Form(default=100.0, description="Daily budget in dollars"),
    media_file: Optional[UploadFile] = File(default=None, description="Image or video file (optional)"),
    industry: str = Form(default="", description="Industry vertical for benchmarks"),
    landing_page_url: str = Form(default="", description="Landing page URL for coherence check"),
    competitor_brand: str = Form(default="", description="Competitor brand for Meta Ad Library lookup"),
):
    """
    Full multi-modal ad evaluation pipeline.
    Accepts ad creative (text + media) and returns quality score,
    SEM metrics, and an AI-generated executive diagnostic.
    """
    tmp_path = None
    trace: List[PipelineStep] = []
    step_num = 0

    def _step(name, model, input_summary, fn):
        nonlocal step_num
        step_num += 1
        t0 = time.time()
        note = None
        status = "ok"
        try:
            result = fn()
        except Exception as exc:
            result = None
            status = "error"
            note = str(exc)
        elapsed = int((time.time() - t0) * 1000)
        out_summary = str(result)[:200] if result is not None else "(failed)"
        trace.append(PipelineStep(
            step=step_num, name=name, model=model,
            input_summary=input_summary[:200],
            output_summary=out_summary,
            duration_ms=elapsed, status=status, note=note,
        ))
        print(f"  [{step_num}] {name}: {elapsed}ms ({status})")
        return result

    try:
        has_media = media_file is not None and media_file.filename
        file_size_kb = 0
        is_video = False
        if has_media:
            suffix = os.path.splitext(media_file.filename or "upload")[1] or ".tmp"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                file_bytes = await media_file.read()
                tmp.write(file_bytes)
                tmp_path = tmp.name
            file_size_kb = len(file_bytes) / 1024
            is_video = suffix.lower() in {".mp4", ".avi", ".mov", ".mkv", ".webm"}
        user_text = f"{headline}. {body}"
        hashtag_list = [h.strip() for h in hashtags.split(",") if h.strip()]

        # STEP 1: Visual Analysis + OCR (run FIRST to feed OCR text into NLP)
        ocr_text = ""
        ocr_brand = ""
        if has_media:
            media_desc = "video" if is_video else "image"
            vision_analysis = _step(
                "Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)",
                f"File: {media_file.filename} ({file_size_kb:.0f}KB, {media_desc})",
                lambda: run_vision_pipeline(tmp_path, is_video, platform, ad_placements),
            )
            if vision_analysis is None:
                vision_analysis = VisionAnalysis(visual_tags=["(vision failed)"], is_cluttered=False)
            ocr_text = (getattr(vision_analysis, "extracted_text", None) or "").replace("\n", " ").strip()
            ocr_brand = (getattr(vision_analysis, "brand_detected", None) or "").replace("\n", " ").strip()
        else:
            vision_analysis = VisionAnalysis(visual_tags=["(no media)"], is_cluttered=False)
            trace.append(PipelineStep(
                step=(step_num := step_num + 1), name="Visual Analysis + OCR", model="Skipped (text-only)",
                input_summary="No media file uploaded",
                output_summary="Text-only evaluation — no visual analysis",
                duration_ms=0, status="ok", note="No media provided",
            ))

        # Combine user text + OCR text for NLP (same as streaming endpoint)
        full_text = user_text
        if ocr_text:
            full_text = full_text + ". " + ocr_text
        if ocr_brand:
            full_text = full_text + ". " + ocr_brand
        full_text = full_text.strip()

        # STEP 2: NER on combined text
        entities = _step(
            "Named Entity Recognition", "spaCy en_core_web_sm",
            f"Text: '{full_text[:80]}'",
            lambda: run_ner(full_text),
        ) or []

        # STEP 3: Sentiment on combined text
        sentiment_result = _step(
            "Sentiment Analysis", "RoBERTa (cardiffnlp/twitter-roberta-base-sentiment)",
            f"Text: '{full_text[:80]}'",
            lambda: run_sentiment(full_text),
        )
        sentiment = sentiment_result["score"] if sentiment_result else None
        sentiment_bd = SentimentBreakdown(**{k: sentiment_result[k] for k in ("positive", "neutral", "negative")}) if sentiment_result else None

        # STEP 4: Hashtag Expansion
        suggested_tags = _step(
            "Hashtag Expansion", "GloVe Twitter 50d (cosine similarity)",
            f"Input tags: {hashtag_list}, fallback entities: {entities[:3]}",
            lambda: run_word2vec_expansion(hashtag_list, fallback_words=entities),
        ) or []

        text_analysis = TextAnalysis(
            extracted_entities=entities if entities else ["(no entities detected)"],
            sentiment_score=sentiment,
            sentiment_breakdown=sentiment_bd,
            suggested_tags=suggested_tags if suggested_tags else ["(no expansions found)"],
        )

        # Derive visual_authenticity from Gemini's platform_fit_score (1-10 → 0-1)
        if has_media:
            pfs = getattr(vision_analysis, "platform_fit_score", None)
            if pfs is not None:
                # Numeric score from Gemini: 1-10 → 0-1 (continuous, no cliff effects)
                visual_authenticity = round((pfs - 1.0) / 9.0, 4)
            else:
                # Fallback: coarse good/fair/poor label
                pf = getattr(vision_analysis, "platform_fit", None) or ""
                pf_lower = pf.lower().strip()
                if pf_lower == "good":
                    visual_authenticity = 0.85
                elif pf_lower == "fair":
                    visual_authenticity = 0.55
                elif pf_lower == "poor":
                    visual_authenticity = 0.25
                else:
                    visual_authenticity = None
        else:
            visual_authenticity = None

        # STEP 5: Trend Forecasting (3 pytrends endpoints: momentum + related queries + regions)
        trend_data = _step(
            "Trend Forecasting", "Google Trends (pytrends: momentum + related queries + regional interest)",
            f"Keywords: {entities[:5]}, Geo: {geo}",
            lambda: run_trend_analysis(entities, geo),
        )
        trend_momentum = trend_data.momentum if trend_data else None

        # STEP 6: SEM Auction
        s_str = f"{sentiment:.3f}" if sentiment is not None else "None"
        t_str = f"{trend_momentum:.3f}" if trend_momentum is not None else "None"
        v_str = f"{visual_authenticity:.3f}" if visual_authenticity is not None else "None"
        sem_metrics = _step(
            "SEM Auction Simulation", f"Weighted QS (platform={platform}, geo={geo})",
            f"sentiment={s_str}, trend={t_str}, visual={v_str}, cpc={base_cpc}, budget={budget}",
            lambda: calculate_sem_metrics(
                sentiment_score=sentiment, trend_momentum=trend_momentum,
                visual_authenticity=visual_authenticity, base_cpc=base_cpc,
                daily_budget=budget, platform=platform, geo=geo,
            ),
        )
        if sem_metrics is None:
            sem_metrics = SEMMetrics(quality_score=1.0, effective_cpc=base_cpc, daily_clicks=1)

        # STEP 7: Landing Page Coherence (async, optional)
        lp_data = None
        if landing_page_url:
            t0 = time.time()
            step_num += 1
            try:
                lp_data = await run_landing_page_coherence(landing_page_url, entities, sentiment, headline)
                elapsed = int((time.time() - t0) * 1000)
                trace.append(PipelineStep(
                    step=step_num, name="Landing Page Coherence", model="httpx + spaCy + RoBERTa",
                    input_summary=f"URL: {landing_page_url[:80]}", output_summary=str(lp_data)[:200],
                    duration_ms=elapsed, status="ok",
                ))
            except Exception as exc:
                elapsed = int((time.time() - t0) * 1000)
                trace.append(PipelineStep(
                    step=step_num, name="Landing Page Coherence", model="httpx + spaCy + RoBERTa",
                    input_summary=f"URL: {landing_page_url[:80]}", output_summary="(failed)",
                    duration_ms=elapsed, status="error", note=str(exc),
                ))
            print(f"  [{step_num}] Landing Page Coherence: {elapsed}ms")
        else:
            step_num += 1
            trace.append(PipelineStep(
                step=step_num, name="Landing Page Coherence", model="Skipped (no URL)",
                input_summary="No landing page URL provided", output_summary="Skipped",
                duration_ms=0, status="ok", note="No URL provided",
            ))

        # STEP 8: Reddit Community Sentiment (async, optional)
        reddit_data = None
        if entities:
            t0 = time.time()
            step_num += 1
            try:
                reddit_data = await run_reddit_sentiment(entities)
                elapsed = int((time.time() - t0) * 1000)
                trace.append(PipelineStep(
                    step=step_num, name="Reddit Community Sentiment", model="Reddit JSON + RoBERTa",
                    input_summary=f"Entities: {entities[:3]}", output_summary=str(reddit_data)[:200],
                    duration_ms=elapsed, status="ok" if reddit_data else "warning",
                    note=None if reddit_data else "No results found",
                ))
            except Exception as exc:
                elapsed = int((time.time() - t0) * 1000)
                trace.append(PipelineStep(
                    step=step_num, name="Reddit Community Sentiment", model="Reddit JSON + RoBERTa",
                    input_summary=f"Entities: {entities[:3]}", output_summary="(failed)",
                    duration_ms=elapsed, status="error", note=str(exc),
                ))
            print(f"  [{step_num}] Reddit Sentiment: {elapsed}ms")
        else:
            step_num += 1
            trace.append(PipelineStep(
                step=step_num, name="Reddit Community Sentiment", model="Skipped",
                input_summary="No entities to search", output_summary="Skipped",
                duration_ms=0, status="ok", note="No entities",
            ))

        # STEP 9: Industry Benchmarks (sync, optional)
        benchmark_data = None
        if industry:
            benchmark_data = _step(
                "Industry Benchmarks", "Static JSON lookup",
                f"Industry: {industry}, Platform: {platform}, eCPC: {sem_metrics.effective_cpc}",
                lambda: run_industry_benchmark(industry, platform, sem_metrics.effective_cpc),
            )
        else:
            step_num += 1
            trace.append(PipelineStep(
                step=step_num, name="Industry Benchmarks", model="Skipped (no industry)",
                input_summary="No industry selected", output_summary="Skipped",
                duration_ms=0, status="ok", note="No industry selected",
            ))

        # STEP 10: Trend-to-Creative Alignment (sync, optional)
        alignment_data = _step(
            "Trend-to-Creative Alignment", "GloVe cosine similarity",
            f"Trends: {len(trend_data.related_queries_top) if trend_data else 0} queries, Ad text: {len(full_text)} chars",
            lambda: run_creative_alignment(trend_data, full_text, entities),
        )

        # STEP 11: Competitor Analysis (async, optional)
        competitor_data = None
        if competitor_brand:
            t0 = time.time()
            step_num += 1
            try:
                competitor_data = await run_competitor_analysis(competitor_brand)
                elapsed = int((time.time() - t0) * 1000)
                trace.append(PipelineStep(
                    step=step_num, name="Competitor Analysis", model="Meta Ad Library API",
                    input_summary=f"Brand: {competitor_brand}", output_summary=str(competitor_data)[:200],
                    duration_ms=elapsed, status=competitor_data.status if competitor_data else "error",
                    note=competitor_data.note if competitor_data else None,
                ))
            except Exception as exc:
                elapsed = int((time.time() - t0) * 1000)
                trace.append(PipelineStep(
                    step=step_num, name="Competitor Analysis", model="Meta Ad Library API",
                    input_summary=f"Brand: {competitor_brand}", output_summary="(failed)",
                    duration_ms=elapsed, status="error", note=str(exc),
                ))
            print(f"  [{step_num}] Competitor Analysis: {elapsed}ms")
        else:
            step_num += 1
            trace.append(PipelineStep(
                step=step_num, name="Competitor Analysis", model="Skipped (no brand)",
                input_summary="No competitor brand provided", output_summary="Skipped",
                duration_ms=0, status="ok", note="No brand provided",
            ))

        quant_metrics = QuantitativeMetrics(
            text_data=text_analysis, vision_data=vision_analysis,
            trend_data=trend_data, sem_metrics=sem_metrics,
            industry_benchmark=benchmark_data,
            landing_page=lp_data,
            reddit_sentiment=reddit_data,
            creative_alignment=alignment_data,
            competitor_intel=competitor_data,
        )

        # STEP 12: LLM Synthesis
        diagnostic = _step(
            "Executive Diagnostic", "Gemini 3 Flash Preview",
            f"Platform: {platform}, Audience: {audience}, QS: {sem_metrics.quality_score}",
            lambda: generate_executive_diagnostic(
                metrics=quant_metrics, headline=headline,
                platform=platform, audience=audience,
            ),
        ) or "LLM synthesis unavailable."

        total_ms = sum(s.duration_ms for s in trace)
        trace.append(PipelineStep(
            step=step_num + 1, name="Total Pipeline", model="All 12 stages",
            input_summary=f"Ad creative + {len(hashtag_list)} tags + {platform}/{geo}",
            output_summary=f"QS={sem_metrics.quality_score}, eCPC={sem_metrics.effective_cpc}, {sem_metrics.daily_clicks} clicks/day",
            duration_ms=total_ms, status="ok",
        ))

        return EvaluationResponse(
            status="success",
            quantitative_metrics=quant_metrics,
            executive_diagnostic=diagnostic,
            pipeline_trace=trace,
        )

    except Exception as e:
        print(f"❌ Pipeline error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Cleanup temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            print(f"🧹 Cleaned up temp file: {tmp_path}")




# ==========================================
# STREAMING SSE ENDPOINT
# ==========================================
@app.post("/api/v1/evaluate_ad_stream")
async def evaluate_ad_stream(
    headline: str = Form(default=""),
    body: str = Form(default=""),
    hashtags: str = Form(default=""),
    audience: str = Form(default="General audience"),
    geo: str = Form(default="US"),
    platform: str = Form(default="Meta"),
    ad_placements: str = Form(default=""),
    base_cpc: float = Form(default=1.50),
    budget: float = Form(default=100.0),
    media_file: Optional[UploadFile] = File(default=None),
    industry: str = Form(default=""),
    landing_page_url: str = Form(default=""),
    competitor_brand: str = Form(default=""),
    post_type: str = Form(default="", description="LinkedIn post type: text, image, video, document, poll, article"),
    follower_count: int = Form(default=0, description="LinkedIn follower count for impression prediction"),
    post_day: int = Form(default=-1, description="Planned posting day (0=Mon, 6=Sun). -1 = not specified"),
    post_hour: int = Form(default=-1, description="Planned posting hour (0-23). -1 = not specified"),
):
    """SSE streaming version — sends each pipeline step as it completes."""
    import json as _json

    async def event_stream():
        tmp_path = None
        step_num = 0

        # Calculate total steps dynamically based on configuration
        # Always: Vision, NER, Sentiment, Hashtag, Trend, SEM, Landing Page,
        #         Reddit, Benchmarks, Alignment, Audience, Competitor, Diagnostic = 13
        # Conditional: LinkedIn (+1 when platform=linkedin and post_type set)
        total_steps = 13
        if platform.lower() == "linkedin" and post_type:
            total_steps += 1

        def send_step(name, model, input_summary, output_summary, duration_ms, status="ok", note=None):
            nonlocal step_num
            step_num += 1
            step_data = {
                "type": "step",
                "step": step_num, "name": name, "model": model,
                "input_summary": input_summary[:200],
                "output_summary": output_summary[:200],
                "duration_ms": duration_ms, "status": status, "note": note,
                "total_steps": total_steps,
            }
            return "data: " + _json.dumps(step_data) + "\n\n"
        async def run_step(name, model, input_summary, fn):
            t0 = time.time()
            note = None
            status = "ok"
            try:
                result = await asyncio.to_thread(fn)
            except Exception as exc:
                result = None
                status = "error"
                note = str(exc)
            elapsed = int((time.time() - t0) * 1000)
            out_summary = str(result)[:200] if result is not None else "(failed)"
            return result, send_step(name, model, input_summary, out_summary, elapsed, status, note)

        try:
            has_media = media_file is not None and media_file.filename
            file_size_kb = 0
            is_video = False
            if has_media:
                suffix = os.path.splitext(media_file.filename or "upload")[1] or ".tmp"
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    file_bytes = await media_file.read()
                    tmp.write(file_bytes)
                    tmp_path = tmp.name
                file_size_kb = len(file_bytes) / 1024
                is_video = suffix.lower() in {".mp4", ".avi", ".mov", ".mkv", ".webm"}

            user_text = f"{headline}. {body}"
            hashtag_list = [h.strip() for h in hashtags.split(",") if h.strip()]

            # STEP 1: Vision + OCR (FIRST - extract text from image before NLP)
            ocr_text = ""
            ocr_brand = ""
            if has_media:
                media_desc = "video" if is_video else "image"
                vision_analysis, evt = await run_step(
                    "Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)",
                    "File: " + str(media_file.filename) + " (" + str(int(file_size_kb)) + "KB, " + media_desc + ")",
                    lambda: run_vision_pipeline(tmp_path, is_video, platform, ad_placements),
                )
                if vision_analysis is None:
                    vision_analysis = VisionAnalysis(visual_tags=["(vision failed)"], is_cluttered=False)
                yield evt
                ocr_text = (getattr(vision_analysis, "extracted_text", None) or "").replace("\n", " ").strip()
                ocr_brand = (getattr(vision_analysis, "brand_detected", None) or "").replace("\n", " ").strip()
            else:
                vision_analysis = VisionAnalysis(visual_tags=["(no media)"], is_cluttered=False)
                yield send_step("Visual Analysis + OCR", "Skipped (text-only)", "No media file", "Text-only mode", 0)

            # Send vision data immediately
            yield "data: " + _json.dumps({'type': 'vision_data', 'data': vision_analysis.model_dump()}) + "\n\n"

            # Combine user text + OCR text for NLP
            full_text = user_text
            if ocr_text:
                full_text = full_text + ". " + ocr_text
            if ocr_brand:
                full_text = full_text + ". " + ocr_brand
            full_text = full_text.strip()

            # STEP 2: NER on combined text (user input + image text)
            entities, evt = await run_step(
                "Named Entity Recognition", "spaCy en_core_web_sm",
                "Text: " + repr(full_text[:100]),
                lambda: run_ner(full_text),
            )
            entities = entities or []
            yield evt

            # STEP 3: Sentiment on combined text
            sentiment_result, evt = await run_step(
                "Sentiment Analysis", "RoBERTa (cardiffnlp/twitter-roberta-base-sentiment)",
                "Text: " + repr(full_text[:100]),
                lambda: run_sentiment(full_text),
            )
            sentiment = sentiment_result["score"] if sentiment_result else None
            sentiment_bd = SentimentBreakdown(**{k: sentiment_result[k] for k in ("positive", "neutral", "negative")}) if sentiment_result else None
            yield evt

            # STEP 4: Hashtag Expansion (using entities from combined text)
            suggested_tags, evt = await run_step(
                "Hashtag Expansion", "GloVe Twitter 50d (cosine similarity)",
                "Input tags: " + str(hashtag_list) + ", entities: " + str(entities[:3]),
                lambda: run_word2vec_expansion(hashtag_list, fallback_words=entities),
            )
            suggested_tags = suggested_tags or []
            yield evt

            text_analysis = TextAnalysis(
                extracted_entities=entities if entities else ["(no entities detected)"],
                sentiment_score=sentiment,
                sentiment_breakdown=sentiment_bd,
                suggested_tags=suggested_tags if suggested_tags else ["(no expansions found)"],
            )
            yield "data: " + _json.dumps({'type': 'text_data', 'data': text_analysis.model_dump()}) + "\n\n"

            # Visual authenticity from platform_fit_score (1-10 → 0-1)
            if has_media:
                pfs = getattr(vision_analysis, "platform_fit_score", None)
                if pfs is not None:
                    visual_authenticity = round((pfs - 1.0) / 9.0, 4)
                else:
                    pf = getattr(vision_analysis, "platform_fit", None) or ""
                    pf_lower = pf.lower().strip()
                    if pf_lower == "good":
                        visual_authenticity = 0.85
                    elif pf_lower == "fair":
                        visual_authenticity = 0.55
                    elif pf_lower == "poor":
                        visual_authenticity = 0.25
                    else:
                        visual_authenticity = None
            else:
                visual_authenticity = None

            # STEP 5: Trend
            trend_data, evt = await run_step(
                "Trend Forecasting", "Google Trends (pytrends: momentum + related + regions)",
                "Keywords: " + str(entities[:5]) + ", Geo: " + geo,
                lambda: run_trend_analysis(entities, geo),
            )
            yield evt
            trend_momentum = trend_data.momentum if trend_data else None

            # Send trend data
            if trend_data:
                yield "data: " + _json.dumps({'type': 'trend_data', 'data': trend_data.model_dump()}) + "\n\n"
            # STEP 6: SEM
            sem_metrics, evt = await run_step(
                "SEM Auction Simulation", "Weighted QS (platform=" + platform + ", geo=" + geo + ")",
                "sentiment=" + str(sentiment) + ", trend=" + str(trend_momentum) + ", visual=" + str(visual_authenticity),
                lambda: calculate_sem_metrics(
                    sentiment_score=sentiment, trend_momentum=trend_momentum,
                    visual_authenticity=visual_authenticity, base_cpc=base_cpc,
                    daily_budget=budget, platform=platform, geo=geo,
                ),
            )
            if sem_metrics is None:
                sem_metrics = SEMMetrics(quality_score=1.0, effective_cpc=base_cpc, daily_clicks=1)
            yield evt

            # Send SEM data
            yield "data: " + _json.dumps({'type': 'sem_metrics', 'data': sem_metrics.model_dump()}) + "\n\n"

            # STEP 7: Landing Page Coherence (async, optional)
            lp_data = None
            if landing_page_url:
                t0 = time.time()
                try:
                    lp_data = await run_landing_page_coherence(landing_page_url, entities, sentiment, headline)
                    elapsed = int((time.time() - t0) * 1000)
                    out_summary = str(lp_data)[:200] if lp_data else "(failed)"
                    yield send_step("Landing Page Coherence", "httpx + spaCy + RoBERTa",
                                    "URL: " + landing_page_url[:80], out_summary, elapsed)
                except Exception as exc:
                    elapsed = int((time.time() - t0) * 1000)
                    yield send_step("Landing Page Coherence", "httpx + spaCy + RoBERTa",
                                    "URL: " + landing_page_url[:80], "(failed)", elapsed, "error", str(exc))
                if lp_data:
                    yield "data: " + _json.dumps({'type': 'landing_page_data', 'data': lp_data.model_dump()}) + "\n\n"
            else:
                yield send_step("Landing Page Coherence", "Skipped (no URL)", "No URL provided", "Skipped", 0)

            # STEP 8: Reddit Community Sentiment (async, optional)
            reddit_data = None
            if entities:
                t0 = time.time()
                try:
                    reddit_data = await run_reddit_sentiment(entities)
                    elapsed = int((time.time() - t0) * 1000)
                    out_summary = str(reddit_data)[:200] if reddit_data else "(no results)"
                    status = "ok" if reddit_data else "warning"
                    yield send_step("Reddit Community Sentiment", "Reddit JSON + RoBERTa",
                                    "Entities: " + str(entities[:3]), out_summary, elapsed, status)
                except Exception as exc:
                    elapsed = int((time.time() - t0) * 1000)
                    yield send_step("Reddit Community Sentiment", "Reddit JSON + RoBERTa",
                                    "Entities: " + str(entities[:3]), "(failed)", elapsed, "error", str(exc))
                if reddit_data:
                    yield "data: " + _json.dumps({'type': 'reddit_data', 'data': reddit_data.model_dump()}) + "\n\n"
            else:
                yield send_step("Reddit Community Sentiment", "Skipped", "No entities", "Skipped", 0)

            # STEP 9: Industry Benchmarks (sync, optional)
            benchmark_data = None
            if industry:
                benchmark_data, evt = await run_step(
                    "Industry Benchmarks", "Static JSON lookup",
                    "Industry: " + industry + ", Platform: " + platform + ", eCPC: " + str(sem_metrics.effective_cpc),
                    lambda: run_industry_benchmark(industry, platform, sem_metrics.effective_cpc),
                )
                yield evt
                if benchmark_data:
                    yield "data: " + _json.dumps({'type': 'benchmark_data', 'data': benchmark_data.model_dump()}) + "\n\n"
            else:
                yield send_step("Industry Benchmarks", "Skipped (no industry)", "No industry selected", "Skipped", 0)

            # STEP 10: Trend-to-Creative Alignment (sync)
            alignment_data, evt = await run_step(
                "Trend-to-Creative Alignment", "GloVe cosine similarity",
                "Trends: " + str(len(trend_data.related_queries_top) if trend_data else 0) + " queries",
                lambda: run_creative_alignment(trend_data, full_text, entities),
            )
            yield evt
            if alignment_data:
                yield "data: " + _json.dumps({'type': 'creative_angles', 'data': alignment_data.model_dump()}) + "\n\n"

            # STEP 11: Audience Alignment (IAB + Sentence Transformers)
            audience_data, evt = await run_step(
                "Audience Alignment", "all-MiniLM-L6-v2 + IAB Taxonomy",
                f"Tag: {audience}, Text: {full_text[:80]}",
                lambda: run_audience_analysis(full_text, audience),
            )
            yield evt
            if audience_data:
                yield "data: " + _json.dumps({'type': 'audience_data', 'data': audience_data.model_dump()}) + "\n\n"

            # STEP 12: Competitor Analysis (async, optional)
            competitor_data = None
            if competitor_brand:
                t0 = time.time()
                try:
                    competitor_data = await run_competitor_analysis(competitor_brand)
                    elapsed = int((time.time() - t0) * 1000)
                    out_summary = str(competitor_data)[:200] if competitor_data else "(failed)"
                    cstatus = competitor_data.status if competitor_data else "error"
                    cnote = competitor_data.note if competitor_data else None
                    yield send_step("Competitor Analysis", "Meta Ad Library API",
                                    "Brand: " + competitor_brand, out_summary, elapsed, cstatus, cnote)
                except Exception as exc:
                    elapsed = int((time.time() - t0) * 1000)
                    yield send_step("Competitor Analysis", "Meta Ad Library API",
                                    "Brand: " + competitor_brand, "(failed)", elapsed, "error", str(exc))
                if competitor_data:
                    yield "data: " + _json.dumps({'type': 'competitor_data', 'data': competitor_data.model_dump()}) + "\n\n"
            else:
                yield send_step("Competitor Analysis", "Skipped (no brand)", "No brand provided", "Skipped", 0)

            # LinkedIn Post Analysis (when platform is LinkedIn)
            linkedin_data = None
            if platform.lower() == "linkedin" and post_type:
                from linkedin_scorer import predict_linkedin_performance
                li_result, evt = await run_step(
                    "LinkedIn Post Prediction", "HistGradientBoosting + IAB Benchmarks",
                    f"Type: {post_type}, Followers: {follower_count}",
                    lambda: predict_linkedin_performance(
                        text=full_text,
                        post_type=post_type or "text",
                        follower_count=max(1, follower_count),
                        industry=industry,
                        hashtags=hashtag_list,
                    ),
                )
                yield evt
                if li_result:
                    linkedin_data = LinkedInPostAnalysis(**li_result)
                    yield "data: " + _json.dumps({'type': 'linkedin_data', 'data': linkedin_data.model_dump()}) + "\n\n"

            quant_metrics = QuantitativeMetrics(
                text_data=text_analysis, vision_data=vision_analysis,
                trend_data=trend_data, sem_metrics=sem_metrics,
                industry_benchmark=benchmark_data,
                landing_page=lp_data,
                reddit_sentiment=reddit_data,
                creative_alignment=alignment_data,
                audience_analysis=audience_data,
                linkedin_analysis=linkedin_data,
                competitor_intel=competitor_data,
            )

            # STEP 13: LLM
            diagnostic, evt = await run_step(
                "Executive Diagnostic", "Gemini 3 Flash Preview",
                "Platform: " + platform + ", Audience: " + audience + ", QS: " + str(sem_metrics.quality_score),
                lambda: generate_executive_diagnostic(
                    metrics=quant_metrics, headline=headline,
                    platform=platform, audience=audience,
                ),
            )
            diagnostic = diagnostic or "LLM synthesis unavailable."
            yield evt

            # Send diagnostic
            yield "data: " + _json.dumps({'type': 'diagnostic', 'data': diagnostic}) + "\n\n"
            # Send done
            yield "data: " + _json.dumps({'type': 'done'}) + "\n\n"
        except Exception as e:
            yield "data: " + _json.dumps({'type': 'error', 'detail': str(e)}) + "\n\n"
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# ==========================================
# HEALTH CHECK
# ==========================================
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": {
            "spacy": nlp_model is not None,
            "roberta": sentiment_analyzer is not None,
            "glove": word2vec_model is not None,
            "gemini": gemini_client is not None,
        },
    }
