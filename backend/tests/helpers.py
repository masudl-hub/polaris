"""
Shared test helpers and constants.

Importable from test files (unlike conftest.py which is auto-loaded by pytest).
"""
import json
from unittest.mock import MagicMock

# ─── Mock Gemini Response Constants ──────────────────────────

MOCK_VISION_RESPONSE = json.dumps({
    "visual_tags": ["product", "person", "text overlay", "logo"],
    "extracted_text": "TEST AD BuyNow",
    "brand_detected": "TestBrand",
    "style": "polished",
    "is_cluttered": False,
    "platform_fit": "good",
    "platform_fit_score": 7.5,
    "platform_suggestions": "Consider adding a clear CTA button",
    "description": "A polished ad featuring a product with text overlay",
})

# New Phase 1 MediaDecomposition format — used by run_media_decomposition
MOCK_MEDIA_DECOMP_RESPONSE = json.dumps({
    "media_type": "image",
    "duration_seconds": None,
    "scenes": [
        {
            "scene_number": 1,
            "start_seconds": 0.0,
            "end_seconds": 0.0,
            "duration_seconds": 0.0,
            "primary_setting": "Studio product shot",
            "key_entities": ["product", "person", "logo"],
            "visual_summary": "A polished ad featuring a product with text overlay",
            "all_ocr_text": ["TEST AD", "BuyNow"],
        }
    ],
    "audio": None,
    "all_extracted_text": ["TEST AD", "BuyNow"],
    "all_entities": ["product", "person", "text overlay", "logo"],
    "overall_visual_style": "polished",
    "platform_fit": "good",
    "platform_fit_score": 7.5,
    "brand_detected": "TestBrand",
    "platform_suggestions": "Consider adding a clear CTA button",
})

MOCK_DIAGNOSTIC_RESPONSE = (
    "**Performance Summary**: Your ad scores a 6.5 quality score.\n\n"
    "**Creative Analysis**: The creative is polished with clear branding.\n\n"
    "**Trend & Market Context**: The topic shows moderate interest.\n\n"
    "**Competitive Context**: No competitor data available.\n\n"
    "**3 Specific Improvements**: 1. Add a CTA. 2. Test vertical format. 3. Include trending hashtags."
)

MOCK_RESONANCE_DIAGNOSTIC_RESPONSE = (
    "**Resonance Overview**: This campaign achieves MODERATE resonance (0.43).\n\n"
    "**Creative & Platform Fit**: The creative scores 8.0/10 for platform fit.\n\n"
    "**Market & Audio Signals**: Trend momentum is 0.65 \u2014 topic is growing.\n\n"
    "**Semantic Coherence**: Nike\u2194running cluster (0.61) reinforces the sport message.\n\n"
    "**Competitive & Community Intelligence**: No competitor data available.\n\n"
    "**3 Resonance-Optimized Improvements**: "
    "1. Signal: cultural_risk 0.1 on Nike \u2192 maintain current framing. "
    "2. Signal: gap_trend 'trail running' \u2192 add distance/time stat. "
    "3. Signal: platform_fit 8.0/10 \u2192 test Stories vertical format."
)


def _make_mock_gemini_response(text: str):
    """Create a mock Gemini response object with .text attribute."""
    mock_resp = MagicMock()
    mock_resp.text = text
    mock_resp.candidates = [MagicMock(finish_reason="STOP")]
    return mock_resp
