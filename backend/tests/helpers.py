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

MOCK_DIAGNOSTIC_RESPONSE = (
    "**Performance Summary**: Your ad scores a 6.5 quality score.\n\n"
    "**Creative Analysis**: The creative is polished with clear branding.\n\n"
    "**Trend & Market Context**: The topic shows moderate interest.\n\n"
    "**Competitive Context**: No competitor data available.\n\n"
    "**3 Specific Improvements**: 1. Add a CTA. 2. Test vertical format. 3. Include trending hashtags."
)


def _make_mock_gemini_response(text: str):
    """Create a mock Gemini response object with .text attribute."""
    mock_resp = MagicMock()
    mock_resp.text = text
    mock_resp.candidates = [MagicMock(finish_reason="STOP")]
    return mock_resp
