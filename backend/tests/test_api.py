"""
Tests for the main API endpoint — POST /api/v1/evaluate_ad.
Integration tests that use the real FastAPI app with mocked external services
(Gemini, pytrends) but real ML models (spaCy, RoBERTa, GloVe).
"""
import pytest
import os
import sys
import json
from unittest.mock import patch, MagicMock
from io import BytesIO

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture(scope="module")
def test_client():
    """
    Create a FastAPI TestClient with real ML models loaded
    but Gemini and pytrends mocked.
    """
    # Patch environment before importing main
    os.environ.setdefault("GEMINI_API_KEY", "test-key")

    from fastapi.testclient import TestClient
    import main

    # Load real ML models
    import spacy
    from transformers import pipeline as hf_pipeline
    import gensim.downloader as gensim_api

    main.nlp_model = spacy.load("en_core_web_sm")
    main.sentiment_analyzer = hf_pipeline(
        "text-classification",
        model="cardiffnlp/twitter-roberta-base-sentiment",
        top_k=None,
        device=-1,
    )
    main.word2vec_model = gensim_api.load("glove-twitter-50")

    # Mock Gemini client
    from helpers import _make_mock_gemini_response, MOCK_MEDIA_DECOMP_RESPONSE, MOCK_DIAGNOSTIC_RESPONSE

    mock_gemini = MagicMock()
    def gemini_side_effect(model, contents, **kwargs):
        if isinstance(contents, list) and len(contents) >= 2:
            return _make_mock_gemini_response(MOCK_MEDIA_DECOMP_RESPONSE)
        return _make_mock_gemini_response(MOCK_DIAGNOSTIC_RESPONSE)
    mock_gemini.models.generate_content.side_effect = gemini_side_effect
    main.gemini_client = mock_gemini

    # Mock audience scorer (skip sentence-transformers loading in tests)
    if main.audience_scorer is None:
        main.audience_scorer = {"model": MagicMock(), "embeddings": {}}

    client = TestClient(main.app, raise_server_exceptions=False)
    yield client


@pytest.fixture
def mock_trends():
    """Patch pytrends for all API tests."""
    import pandas as pd
    import numpy as np

    mock = MagicMock()
    dates = pd.date_range(end="2026-03-05", periods=91, freq="D")
    values = np.linspace(50, 75, 91)
    df = pd.DataFrame({"keyword1": values, "isPartial": [False] * 91}, index=dates)
    mock.interest_over_time.return_value = df
    mock.related_queries.return_value = {
        "keyword1": {
            "top": pd.DataFrame({"query": ["trending term 1", "trending term 2"]}),
            "rising": pd.DataFrame({"query": ["breakout term"]}),
        }
    }
    mock.interest_by_region.return_value = pd.DataFrame(
        {"keyword1": [100, 80]},
        index=["United States", "United Kingdom"],
    )

    with patch("main._pytrends_with_retry", return_value=mock):
        yield mock


# ──────────────────────────────────────────────────────────────────
# Text-only analysis
# ──────────────────────────────────────────────────────────────────

class TestEvaluateAdTextOnly:
    def test_text_only_returns_200(self, test_client, mock_trends):
        """Basic text-only submission should return 200 with valid response."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "Nike Air Max — Revolutionary Comfort",
                "body": "Experience the next generation of running shoes.",
                "hashtags": "#nike,#running",
                "audience": "Gen-Z (18-24)",
                "platform": "Meta",
                "geo": "US",
                "base_cpc": "1.50",
                "budget": "100.0",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"

        # Verify quantitative metrics structure
        qm = data["quantitative_metrics"]
        assert "text_data" in qm
        assert "vision_data" in qm
        assert "sem_metrics" in qm

        # Text data
        td = qm["text_data"]
        assert "extracted_entities" in td
        assert "sentiment_score" in td
        assert "suggested_tags" in td

        # SEM metrics
        sem = qm["sem_metrics"]
        assert 1.0 <= sem["quality_score"] <= 10.0
        assert sem["effective_cpc"] > 0
        assert sem["daily_clicks"] >= 1

    def test_empty_text_still_works(self, test_client, mock_trends):
        """Even with empty text, endpoint should return 200."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "",
                "body": "",
                "platform": "Meta",
            },
        )
        assert resp.status_code == 200

    def test_diagnostic_present(self, test_client, mock_trends):
        """Response should include executive diagnostic string."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "Test headline for diagnostic",
                "body": "Test body text",
                "platform": "Meta",
            },
        )
        data = resp.json()
        assert "executive_diagnostic" in data
        assert len(data["executive_diagnostic"]) > 0

    def test_pipeline_trace_present(self, test_client, mock_trends):
        """Response should include pipeline trace with multiple steps."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "Pipeline trace test",
                "body": "Test content",
                "platform": "Meta",
            },
        )
        data = resp.json()
        assert "pipeline_trace" in data
        assert len(data["pipeline_trace"]) > 0
        for step in data["pipeline_trace"]:
            assert "step" in step
            assert "name" in step
            assert "duration_ms" in step


# ──────────────────────────────────────────────────────────────────
# Image upload
# ──────────────────────────────────────────────────────────────────

class TestEvaluateAdWithImage:
    def test_image_upload_returns_200(self, test_client, mock_trends):
        """Image upload should trigger vision pipeline and return valid response."""
        image_path = os.path.join(FIXTURES_DIR, "sample_image.jpg")
        with open(image_path, "rb") as f:
            resp = test_client.post(
                "/api/v1/evaluate_ad",
                data={
                    "headline": "Visual ad test",
                    "body": "Testing with an image",
                    "platform": "Meta",
                },
                files={"media_file": ("test.jpg", f, "image/jpeg")},
            )
        assert resp.status_code == 200
        data = resp.json()
        vision = data["quantitative_metrics"]["vision_data"]
        assert len(vision["visual_tags"]) > 0

    def test_image_ocr_feeds_nlp(self, test_client, mock_trends):
        """OCR text from image should be fed into NER pipeline."""
        image_path = os.path.join(FIXTURES_DIR, "sample_image.jpg")
        with open(image_path, "rb") as f:
            resp = test_client.post(
                "/api/v1/evaluate_ad",
                data={
                    "headline": "",
                    "body": "",
                    "platform": "Meta",
                },
                files={"media_file": ("test.jpg", f, "image/jpeg")},
            )
        assert resp.status_code == 200
        data = resp.json()
        # The mock Gemini returns "TEST AD BuyNow" as extracted text,
        # which should be fed into NLP pipeline
        text_data = data["quantitative_metrics"]["text_data"]
        assert text_data is not None


# ──────────────────────────────────────────────────────────────────
# Video upload
# ──────────────────────────────────────────────────────────────────

class TestEvaluateAdWithVideo:
    def test_video_upload_returns_200(self, test_client, mock_trends):
        """Video upload should return valid response."""
        video_path = os.path.join(FIXTURES_DIR, "sample_video.mp4")
        with open(video_path, "rb") as f:
            resp = test_client.post(
                "/api/v1/evaluate_ad",
                data={
                    "headline": "Video ad test",
                    "body": "Testing with a video",
                    "platform": "TikTok",
                },
                files={"media_file": ("test.mp4", f, "video/mp4")},
            )
        assert resp.status_code == 200


# ──────────────────────────────────────────────────────────────────
# Platform & Geo variations
# ──────────────────────────────────────────────────────────────────

class TestPlatformVariations:
    @pytest.mark.parametrize("platform", ["Meta", "Google", "TikTok", "X", "LinkedIn", "Snapchat"])
    def test_all_platforms_return_200(self, test_client, mock_trends, platform):
        """Every supported platform should produce a valid response."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": f"Testing {platform}",
                "body": "Platform test body",
                "platform": platform,
            },
        )
        assert resp.status_code == 200

    @pytest.mark.parametrize("geo", ["US", "GB", "DE", "JP", "BR", "IN"])
    def test_geo_variations(self, test_client, mock_trends, geo):
        """Different geo codes should work without errors."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "Geo test",
                "body": "Body text",
                "platform": "Meta",
                "geo": geo,
            },
        )
        assert resp.status_code == 200


# ──────────────────────────────────────────────────────────────────
# Optional pipeline inputs
# ──────────────────────────────────────────────────────────────────

class TestOptionalInputs:
    def test_with_industry_benchmark(self, test_client, mock_trends):
        """Industry benchmark should be included when industry is provided."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "E-commerce test",
                "body": "Shop now",
                "platform": "Meta",
                "industry": "e-commerce",
            },
        )
        assert resp.status_code == 200

    def test_with_competitor_brand(self, test_client, mock_trends):
        """Competitor brand should trigger competitor analysis (may skip if no token)."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "Competitor test",
                "body": "Testing against Nike",
                "platform": "Meta",
                "competitor_brand": "Nike",
            },
        )
        assert resp.status_code == 200

    def test_with_ad_placements(self, test_client, mock_trends):
        """Ad placements should be accepted and passed to vision pipeline."""
        resp = test_client.post(
            "/api/v1/evaluate_ad",
            data={
                "headline": "Placement test",
                "body": "Feed and Stories",
                "platform": "Meta",
                "ad_placements": "Feed,Stories",
            },
        )
        assert resp.status_code == 200
