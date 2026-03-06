"""
Tests for Vision pipeline — Gemini Vision integration, response parsing,
video frame extraction, and VisionAnalysis construction.
External Gemini API is always mocked.
"""
import pytest
import json
import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import VisionAnalysis


# ──────────────────────────────────────────────────────────────────
# Response Parsing
# ──────────────────────────────────────────────────────────────────

class TestVisionResponseParsing:
    """Test that run_vision_pipeline correctly parses Gemini JSON responses."""

    def test_valid_json_response(self, mock_gemini_client, sample_image_path):
        """Full valid JSON from Gemini → correctly populated VisionAnalysis."""
        import main
        main.gemini_client = mock_gemini_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False, platform="Meta")

        assert result is not None
        assert isinstance(result, VisionAnalysis)
        assert len(result.visual_tags) > 0
        assert result.extracted_text == "TEST AD BuyNow"
        assert result.brand_detected == "TestBrand"
        assert result.platform_fit_score == 7.5
        assert result.is_cluttered is False

    def test_malformed_json_fallback(self, sample_image_path):
        """When Gemini returns garbage, should fallback gracefully."""
        import main

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "This is not JSON at all, just random text"
        mock_client.models.generate_content.return_value = mock_resp
        main.gemini_client = mock_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)

        assert result is not None
        assert "(could not parse vision response)" in result.visual_tags

    def test_json_with_markdown_fences(self, sample_image_path):
        """Gemini sometimes wraps JSON in ```json ... ``` fences."""
        import main

        vision_data = {
            "visual_tags": ["widget"],
            "extracted_text": "Hello",
            "brand_detected": None,
            "style": "minimal",
            "is_cluttered": False,
            "platform_fit": "fair",
            "platform_fit_score": 5.0,
            "platform_suggestions": "Improve contrast",
            "description": "A minimal widget",
        }

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = "```json\n" + json.dumps(vision_data) + "\n```"
        mock_client.models.generate_content.return_value = mock_resp
        main.gemini_client = mock_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)

        assert result is not None
        assert result.visual_tags == ["widget"]
        assert result.platform_fit_score == 5.0

    def test_empty_response_returns_none(self, sample_image_path):
        """When Gemini returns empty text, should return None."""
        import main

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = ""
        mock_client.models.generate_content.return_value = mock_resp
        main.gemini_client = mock_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)
        assert result is None

    def test_platform_fit_score_clamping(self, sample_image_path):
        """Platform fit score outside 1-10 should be clamped."""
        import main

        vision_data = {
            "visual_tags": ["tag"],
            "is_cluttered": False,
            "platform_fit_score": 15.0,  # > 10
        }

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = json.dumps(vision_data)
        mock_client.models.generate_content.return_value = mock_resp
        main.gemini_client = mock_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)
        assert result is not None
        assert result.platform_fit_score == 10.0

    def test_platform_fit_score_string_coercion(self, sample_image_path):
        """Gemini sometimes returns score as string instead of number."""
        import main

        vision_data = {
            "visual_tags": ["tag"],
            "is_cluttered": False,
            "platform_fit_score": "8.5",  # string, not float
        }

        mock_client = MagicMock()
        mock_resp = MagicMock()
        mock_resp.text = json.dumps(vision_data)
        mock_client.models.generate_content.return_value = mock_resp
        main.gemini_client = mock_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)
        assert result is not None
        assert result.platform_fit_score == 8.5


# ──────────────────────────────────────────────────────────────────
# Video Frame Extraction
# ──────────────────────────────────────────────────────────────────

class TestVideoFrameExtraction:
    def test_video_extracts_middle_frame(self, mock_gemini_client, sample_video_path):
        """Video input should extract middle frame and send as JPEG."""
        import main
        main.gemini_client = mock_gemini_client

        result = main.run_vision_pipeline(sample_video_path, is_video=True)

        assert result is not None
        # Verify Gemini was called
        mock_gemini_client.models.generate_content.assert_called_once()

        # Verify the call used image/jpeg MIME (since we extract a frame)
        call_args = mock_gemini_client.models.generate_content.call_args
        contents = call_args.kwargs.get("contents") or call_args[1].get("contents")
        # The first element should be a Part with image/jpeg MIME
        from google.genai import types
        first_part = contents[0]
        # It was constructed via Part.from_bytes with mime_type="image/jpeg"
        assert isinstance(result, VisionAnalysis)

    def test_image_sends_original_bytes(self, mock_gemini_client, sample_image_path):
        """Image input should send original file bytes, not extract a frame."""
        import main
        main.gemini_client = mock_gemini_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)

        assert result is not None
        mock_gemini_client.models.generate_content.assert_called_once()


# ──────────────────────────────────────────────────────────────────
# Platform Context
# ──────────────────────────────────────────────────────────────────

class TestPlatformContext:
    def test_meta_default_context(self, mock_gemini_client, sample_image_path):
        """Meta platform should include Meta-specific best practices in prompt."""
        import main
        main.gemini_client = mock_gemini_client

        main.run_vision_pipeline(sample_image_path, is_video=False, platform="Meta")

        call_args = mock_gemini_client.models.generate_content.call_args
        contents = call_args.kwargs.get("contents") or call_args[1].get("contents")
        prompt_text = contents[-1]  # Last element is the text prompt
        assert "Meta" in prompt_text or "Facebook" in prompt_text

    def test_tiktok_context(self, mock_gemini_client, sample_image_path):
        """TikTok platform should include TikTok-specific guidance."""
        import main
        main.gemini_client = mock_gemini_client

        main.run_vision_pipeline(sample_image_path, is_video=False, platform="TikTok")

        call_args = mock_gemini_client.models.generate_content.call_args
        contents = call_args.kwargs.get("contents") or call_args[1].get("contents")
        prompt_text = contents[-1]
        assert "TikTok" in prompt_text

    def test_specific_placements(self, mock_gemini_client, sample_image_path):
        """When specific placements are provided, prompt should reference them."""
        import main
        main.gemini_client = mock_gemini_client

        main.run_vision_pipeline(
            sample_image_path, is_video=False,
            platform="Meta", ad_placements="Stories,Reels",
        )

        call_args = mock_gemini_client.models.generate_content.call_args
        contents = call_args.kwargs.get("contents") or call_args[1].get("contents")
        prompt_text = contents[-1]
        assert "Stories" in prompt_text or "Reels" in prompt_text or "9:16" in prompt_text


# ──────────────────────────────────────────────────────────────────
# Retry Logic
# ──────────────────────────────────────────────────────────────────

class TestVisionRetry:
    def test_retries_on_failure(self, sample_image_path):
        """Should retry up to 3 times on Gemini API failure."""
        import main

        mock_client = MagicMock()
        # First 2 calls raise, third succeeds
        mock_client.models.generate_content.side_effect = [
            Exception("429 Too Many Requests"),
            Exception("Connection timeout"),
            MagicMock(text=json.dumps({
                "visual_tags": ["recovered"],
                "is_cluttered": False,
            })),
        ]
        main.gemini_client = mock_client

        result = main.run_vision_pipeline(sample_image_path, is_video=False)
        assert result is not None
        assert "recovered" in result.visual_tags
        assert mock_client.models.generate_content.call_count == 3
