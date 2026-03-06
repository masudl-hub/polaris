"""
Polaris Test Suite — Shared Fixtures & Mocks

Provides:
- Mock Gemini client (no real API calls)
- Mock pytrends (no real Google Trends calls)
- FastAPI TestClient with mocked external services
- Sample fixture file paths (image, video)
- Pre-loaded ML models for integration tests
"""
import os
import sys
import json
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

# Ensure backend/ is on the import path
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..")
TESTS_DIR = os.path.dirname(__file__)
sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, TESTS_DIR)

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


# ──────────────────────────────────────────────────────────────────
# Fixture paths
# ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_image_path():
    """Path to a small test JPEG image (100x100 with text overlay)."""
    path = os.path.join(FIXTURES_DIR, "sample_image.jpg")
    assert os.path.exists(path), f"Fixture missing: {path}. Run tests/gen_fixtures.py first."
    return path


@pytest.fixture
def sample_video_path():
    """Path to a small test MP4 video (1s, 10fps, 100x100)."""
    path = os.path.join(FIXTURES_DIR, "sample_video.mp4")
    assert os.path.exists(path), f"Fixture missing: {path}. Run tests/gen_fixtures.py first."
    return path


# ──────────────────────────────────────────────────────────────────
# Mock Gemini client
# ──────────────────────────────────────────────────────────────────

from helpers import MOCK_VISION_RESPONSE, MOCK_DIAGNOSTIC_RESPONSE, _make_mock_gemini_response


@pytest.fixture
def mock_gemini_client():
    """
    Mock Gemini client that returns deterministic responses.
    Returns vision JSON for multimodal calls, diagnostic text for text-only calls.
    """
    client = MagicMock()

    def generate_content_side_effect(model, contents, **kwargs):
        # If contents include a Part (bytes), it's a vision call
        if isinstance(contents, list) and len(contents) >= 2:
            return _make_mock_gemini_response(MOCK_VISION_RESPONSE)
        # Otherwise it's a text/diagnostic call
        return _make_mock_gemini_response(MOCK_DIAGNOSTIC_RESPONSE)

    client.models.generate_content.side_effect = generate_content_side_effect
    return client


# ──────────────────────────────────────────────────────────────────
# Mock pytrends
# ──────────────────────────────────────────────────────────────────

MOCK_TREND_INTEREST = {
    "keyword1": [50, 55, 60, 58, 62, 65, 70] * 13,  # 91 days of data
}


@pytest.fixture
def mock_pytrends():
    """Mock pytrends TrendReq that returns canned data."""
    import pandas as pd
    import numpy as np

    mock = MagicMock()

    # interest_over_time
    dates = pd.date_range(end="2026-03-05", periods=91, freq="D")
    values = np.linspace(50, 75, 91)
    df = pd.DataFrame({"keyword1": values, "isPartial": [False] * 91}, index=dates)
    mock.interest_over_time.return_value = df

    # related_queries
    mock.related_queries.return_value = {
        "keyword1": {
            "top": pd.DataFrame({"query": ["related term 1", "related term 2", "related term 3"]}),
            "rising": pd.DataFrame({"query": ["rising trend 1", "breakout term"]}),
        }
    }

    # interest_by_region
    regions = pd.DataFrame(
        {"keyword1": [100, 85, 72, 60, 45]},
        index=["United States", "United Kingdom", "Canada", "Australia", "Germany"],
    )
    mock.interest_by_region.return_value = regions

    return mock


# ──────────────────────────────────────────────────────────────────
# Patched app fixture for integration tests
# ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_env(monkeypatch):
    """Set environment variables for testing (mock API keys)."""
    monkeypatch.setenv("GEMINI_API_KEY", "test-key-not-real")
    monkeypatch.setenv("PERPLEXITY_API_KEY", "test-pplx-not-real")


@pytest.fixture
def patched_gemini(mock_gemini_client):
    """Patch the global gemini_client in main module."""
    with patch("main.gemini_client", mock_gemini_client):
        yield mock_gemini_client


@pytest.fixture
def patched_pytrends(mock_pytrends):
    """Patch pytrends to use canned data."""
    with patch("main._pytrends_with_retry", return_value=mock_pytrends):
        yield mock_pytrends


# ──────────────────────────────────────────────────────────────────
# Sample data for model validation tests
# ──────────────────────────────────────────────────────────────────

@pytest.fixture
def sample_text_analysis_data():
    """Valid data dict for constructing a TextAnalysis model."""
    return {
        "extracted_entities": ["Nike", "Portland", "Oregon"],
        "sentiment_score": 0.72,
        "sentiment_breakdown": {"positive": 0.65, "neutral": 0.25, "negative": 0.10},
        "suggested_tags": ["#fitness", "#running", "#sports"],
    }


@pytest.fixture
def sample_vision_analysis_data():
    """Valid data dict for constructing a VisionAnalysis model."""
    return {
        "visual_tags": ["shoe", "person", "outdoor"],
        "extracted_text": "Just Do It",
        "brand_detected": "Nike",
        "style_assessment": "polished",
        "is_cluttered": False,
        "platform_fit": "good",
        "platform_fit_score": 8.0,
        "platform_suggestions": "Consider vertical format for Stories",
    }


@pytest.fixture
def sample_trend_analysis_data():
    """Valid data dict for constructing a TrendAnalysis model."""
    return {
        "momentum": 0.65,
        "related_queries_top": ["nike shoes", "running shoes"],
        "related_queries_rising": ["nike air max 2026"],
        "top_regions": [
            {"name": "United States", "interest": 100},
            {"name": "United Kingdom", "interest": 75},
        ],
        "keywords_searched": ["Nike"],
        "data_points": 91,
        "time_series": [50.0 + i * 0.27 for i in range(91)],
    }


@pytest.fixture
def sample_sem_metrics_data():
    """Valid data dict for constructing SEMMetrics model."""
    return {
        "quality_score": 7.5,
        "effective_cpc": 0.95,
        "daily_clicks": 105,
    }
