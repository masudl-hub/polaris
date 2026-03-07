"""
Phase 1 — Native Video Decomposition Tests
Tests for run_media_decomposition(), media_decomp_to_vision_analysis(),
and the SceneBreakdown / AudioDescription / MediaDecomposition models.
"""
import json
import os
import sys
import tempfile
from unittest.mock import MagicMock, patch

import pytest

# Make sure the backend module is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main  # noqa: E402 — imported after sys.path setup

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_gemini_response(text: str) -> MagicMock:
    """Build a mock response object that mimics google-genai response."""
    resp = MagicMock()
    resp.text = text
    return resp


def _minimal_decomp_json(**overrides) -> str:
    """Return a minimal valid MediaDecomposition JSON payload."""
    payload = {
        "media_type": "image",
        "duration_seconds": None,
        "scenes": [
            {
                "scene_number": 1,
                "start_seconds": 0.0,
                "end_seconds": 0.0,
                "duration_seconds": 0.0,
                "primary_setting": "Studio",
                "key_entities": ["BrandX"],
                "visual_summary": "Product shot",
                "all_ocr_text": ["BUY NOW"],
            }
        ],
        "audio": None,
        "all_extracted_text": ["BUY NOW"],
        "all_entities": ["BrandX"],
        "overall_visual_style": "clean",
        "platform_fit": "excellent",
        "platform_fit_score": 9.0,
        "brand_detected": "BrandX",
        "platform_suggestions": "Use square crop",
    }
    payload.update(overrides)
    return json.dumps(payload)


def _sample_image_path() -> str:
    """Create a tiny JPEG-like temp file and return its path."""
    fd, path = tempfile.mkstemp(suffix=".jpg")
    with os.fdopen(fd, "wb") as f:
        # Minimal JPEG SOI marker so it's non-empty
        f.write(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 100)
    return path


def _sample_mp4_path() -> str:
    fd, path = tempfile.mkstemp(suffix=".mp4")
    with os.fdopen(fd, "wb") as f:
        f.write(b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 100)
    return path



# ---------------------------------------------------------------------------
# 1. Model tests — SceneBreakdown
# ---------------------------------------------------------------------------

from models import SceneBreakdown, AudioDescription, MediaDecomposition, VisionAnalysis


class TestSceneBreakdown:
    def test_valid_scene(self):
        s = SceneBreakdown(
            scene_number=1, start_seconds=0.0, end_seconds=5.0,
            duration_seconds=5.0, primary_setting="office",
            key_entities=["laptop"], visual_summary="Person typing",
            all_ocr_text=["DEADLINE"],
        )
        assert s.scene_number == 1
        assert "laptop" in s.key_entities
        assert s.all_ocr_text == ["DEADLINE"]

    def test_empty_entities_allowed(self):
        s = SceneBreakdown(
            scene_number=2, start_seconds=5.0, end_seconds=10.0,
            duration_seconds=5.0, primary_setting="outdoor",
            key_entities=[], visual_summary="Wide shot", all_ocr_text=[],
        )
        assert s.key_entities == []

    def test_ocr_text_is_list(self):
        s = SceneBreakdown(
            scene_number=1, start_seconds=0.0, end_seconds=2.0,
            duration_seconds=2.0, primary_setting="gym",
            key_entities=["Nike"], visual_summary="Shoe ad",
            all_ocr_text=["JUST DO IT", "nike.com"],
        )
        assert isinstance(s.all_ocr_text, list)
        assert len(s.all_ocr_text) == 2


# ---------------------------------------------------------------------------
# 2. Model tests — AudioDescription
# ---------------------------------------------------------------------------

class TestAudioDescription:
    def test_has_audio_true(self):
        a = AudioDescription(has_audio=True, description="Hip-hop beat")
        assert a.has_audio is True
        assert a.description == "Hip-hop beat"

    def test_no_audio(self):
        a = AudioDescription(has_audio=False, description=None)
        assert a.has_audio is False
        assert a.description is None


# ---------------------------------------------------------------------------
# 3. Model tests — MediaDecomposition
# ---------------------------------------------------------------------------

class TestMediaDecompositionModel:
    def test_basic_image(self):
        md = MediaDecomposition(
            media_type="image",
            scenes=[SceneBreakdown(
                scene_number=1, start_seconds=0.0, end_seconds=0.0,
                duration_seconds=0.0, primary_setting="studio",
                key_entities=[], visual_summary="Clean product", all_ocr_text=[],
            )],
            all_extracted_text=[], all_entities=[],
        )
        assert md.media_type == "image"
        assert md.duration_seconds is None

    def test_platform_fit_score_bounds(self):
        md = MediaDecomposition(
            media_type="video", scenes=[], all_extracted_text=[], all_entities=[],
            platform_fit_score=7.5,
        )
        assert md.platform_fit_score == 7.5

    def test_platform_fit_score_rejects_below_1(self):
        import pydantic
        with pytest.raises((pydantic.ValidationError, ValueError)):
            MediaDecomposition(
                media_type="video", scenes=[], all_extracted_text=[], all_entities=[],
                platform_fit_score=0.5,
            )

    def test_platform_fit_score_rejects_above_10(self):
        import pydantic
        with pytest.raises((pydantic.ValidationError, ValueError)):
            MediaDecomposition(
                media_type="video", scenes=[], all_extracted_text=[], all_entities=[],
                platform_fit_score=10.5,
            )

    def test_optional_fields_default_none(self):
        md = MediaDecomposition(
            media_type="image", scenes=[], all_extracted_text=[], all_entities=[],
        )
        assert md.audio is None
        assert md.brand_detected is None
        assert md.platform_suggestions is None


# ---------------------------------------------------------------------------
# 4. run_media_decomposition() — happy path (image)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def inject_mock_gemini_client():
    """Ensure main.gemini_client is a MagicMock so tests can patch its methods."""
    mock_client = MagicMock()
    original = main.gemini_client
    main.gemini_client = mock_client
    yield mock_client
    main.gemini_client = original


class TestRunMediaDecomposition:
    def test_happy_path_image(self):
        img = _sample_image_path()
        try:
            good_json = _minimal_decomp_json()
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(good_json)):
                result = main.run_media_decomposition(img, is_video=False, platform="Meta")
            assert result is not None
            assert result.media_type == "image"
            assert len(result.scenes) == 1
            assert result.brand_detected == "BrandX"
            assert result.platform_fit_score == 9.0
        finally:
            os.unlink(img)

    def test_happy_path_video(self):
        mp4 = _sample_mp4_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["media_type"] = "video"
            payload["duration_seconds"] = 30.0
            payload["audio"] = {"has_audio": True, "description": "Music"}
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(json.dumps(payload))):
                result = main.run_media_decomposition(mp4, is_video=True, platform="TikTok")
            assert result is not None
            assert result.media_type == "video"
            assert result.duration_seconds == 30.0
            assert result.audio is not None
            assert result.audio.has_audio is True
        finally:
            os.unlink(mp4)

    def test_returns_none_on_empty_response(self):
        img = _sample_image_path()
        try:
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response("")):
                result = main.run_media_decomposition(img, is_video=False)
            assert result is None
        finally:
            os.unlink(img)

    def test_strips_markdown_fence(self):
        img = _sample_image_path()
        try:
            fenced = "```json\n" + _minimal_decomp_json() + "\n```"
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(fenced)):
                result = main.run_media_decomposition(img, is_video=False)
            assert result is not None
            assert result.brand_detected == "BrandX"
        finally:
            os.unlink(img)

    def test_graceful_invalid_json(self):
        img = _sample_image_path()
        try:
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response("not json at all")):
                result = main.run_media_decomposition(img, is_video=False)
            assert result is not None
            assert result.scenes == []
        finally:
            os.unlink(img)

    def test_platform_fit_score_clipped_high(self):
        img = _sample_image_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["platform_fit_score"] = 999
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(json.dumps(payload))):
                result = main.run_media_decomposition(img, is_video=False)
            assert result is not None
            assert result.platform_fit_score == 10.0
        finally:
            os.unlink(img)

    def test_platform_fit_score_clipped_low(self):
        img = _sample_image_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["platform_fit_score"] = -5
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(json.dumps(payload))):
                result = main.run_media_decomposition(img, is_video=False)
            assert result is not None
            assert result.platform_fit_score == 1.0
        finally:
            os.unlink(img)

    def test_retries_on_exception_then_succeeds(self):
        img = _sample_image_path()
        try:
            call_count = {"n": 0}
            good_json = _minimal_decomp_json()

            def side_effect(*args, **kwargs):
                call_count["n"] += 1
                if call_count["n"] < 2:
                    raise RuntimeError("transient error")
                return _make_gemini_response(good_json)

            with patch.object(main.gemini_client.models, "generate_content",
                              side_effect=side_effect):
                with patch("time.sleep"):
                    result = main.run_media_decomposition(img, is_video=False)
            assert result is not None
            assert call_count["n"] == 2
        finally:
            os.unlink(img)

    def test_malformed_scene_is_skipped(self):
        img = _sample_image_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["scenes"].append({"scene_number": "not-an-int", "oops": True})
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(json.dumps(payload))):
                result = main.run_media_decomposition(img, is_video=False)
            assert result is not None
            assert len(result.scenes) >= 1
        finally:
            os.unlink(img)

    def test_large_video_uses_files_api(self):
        """Files >20MB should call gemini_client.files.upload instead of inline bytes."""
        mp4 = _sample_mp4_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["media_type"] = "video"

            mock_uploaded = MagicMock()
            mock_uploaded.state.name = "ACTIVE"
            mock_uploaded.name = "files/abc123"

            # Simulate a 25MB file read
            large_bytes = b"\x00" * (25 * 1024 * 1024)

            with (
                patch.object(main.gemini_client.files, "upload", return_value=mock_uploaded) as mock_upload,
                patch.object(main.gemini_client.models, "generate_content",
                             return_value=_make_gemini_response(json.dumps(payload))),
                patch("builtins.open",
                      MagicMock(return_value=MagicMock(
                          __enter__=lambda s, *a: MagicMock(read=MagicMock(return_value=large_bytes)),
                          __exit__=MagicMock(return_value=False),
                      ))),
            ):
                result = main.run_media_decomposition(mp4, is_video=True)
            # Files API should have been called
            mock_upload.assert_called_once()
        finally:
            os.unlink(mp4)

    def test_all_extracted_text_aggregation(self):
        img = _sample_image_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["all_extracted_text"] = ["SALE 50%", "Shop Now", "Limited Time"]
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(json.dumps(payload))):
                result = main.run_media_decomposition(img, is_video=False)
            assert len(result.all_extracted_text) == 3
            assert "SALE 50%" in result.all_extracted_text
        finally:
            os.unlink(img)

    def test_all_entities_aggregation(self):
        img = _sample_image_path()
        try:
            payload = json.loads(_minimal_decomp_json())
            payload["all_entities"] = ["Nike", "athlete", "stadium"]
            with patch.object(main.gemini_client.models, "generate_content",
                              return_value=_make_gemini_response(json.dumps(payload))):
                result = main.run_media_decomposition(img, is_video=False)
            assert "Nike" in result.all_entities
            assert len(result.all_entities) == 3
        finally:
            os.unlink(img)


# ---------------------------------------------------------------------------
# 5. media_decomp_to_vision_analysis() — backward compat helper
# ---------------------------------------------------------------------------

def _make_rich_md() -> MediaDecomposition:
    scenes = [
        SceneBreakdown(
            scene_number=i, start_seconds=float(i * 3), end_seconds=float(i * 3 + 3),
            duration_seconds=3.0, primary_setting="outdoor",
            key_entities=["Nike"], visual_summary="Running", all_ocr_text=["RUN"],
        )
        for i in range(1, 4)
    ]
    return MediaDecomposition(
        media_type="video", duration_seconds=9.0, scenes=scenes,
        all_extracted_text=["RUN", "FAST", "NIKE"], all_entities=["Nike", "athlete"],
        overall_visual_style="dynamic", platform_fit="excellent",
        platform_fit_score=9.0, brand_detected="Nike",
        platform_suggestions="Use captions",
    )


class TestMediaDecompToVisionAnalysis:
    def test_returns_vision_analysis(self):
        md = _make_rich_md()
        va = main.media_decomp_to_vision_analysis(md)
        assert isinstance(va, VisionAnalysis)

    def test_visual_tags_from_entities(self):
        md = _make_rich_md()
        va = main.media_decomp_to_vision_analysis(md)
        assert "Nike" in va.visual_tags

    def test_extracted_text_joined(self):
        md = _make_rich_md()
        va = main.media_decomp_to_vision_analysis(md)
        assert va.extracted_text is not None
        assert "RUN" in va.extracted_text

    def test_brand_preserved(self):
        md = _make_rich_md()
        va = main.media_decomp_to_vision_analysis(md)
        assert va.brand_detected == "Nike"

    def test_platform_fit_score_preserved(self):
        md = _make_rich_md()
        va = main.media_decomp_to_vision_analysis(md)
        assert va.platform_fit_score == 9.0

    def test_is_cluttered_many_scenes(self):
        scenes = [
            SceneBreakdown(
                scene_number=i, start_seconds=float(i), end_seconds=float(i + 1),
                duration_seconds=1.0, primary_setting="x",
                key_entities=[], visual_summary="x", all_ocr_text=[],
            )
            for i in range(1, 9)  # 8 scenes > 6 threshold
        ]
        md = MediaDecomposition(
            media_type="video", scenes=scenes, all_extracted_text=[], all_entities=[],
        )
        va = main.media_decomp_to_vision_analysis(md)
        assert va.is_cluttered is True

    def test_is_not_cluttered_few_scenes(self):
        scenes = [
            SceneBreakdown(
                scene_number=1, start_seconds=0.0, end_seconds=5.0,
                duration_seconds=5.0, primary_setting="studio",
                key_entities=[], visual_summary="Clean", all_ocr_text=[],
            )
        ]
        md = MediaDecomposition(
            media_type="image", scenes=scenes, all_extracted_text=["ONE", "TWO"],
            all_entities=[],
        )
        va = main.media_decomp_to_vision_analysis(md)
        assert va.is_cluttered is False

    def test_empty_decomp_returns_safe_defaults(self):
        md = MediaDecomposition(
            media_type="image", scenes=[], all_extracted_text=[], all_entities=[],
        )
        va = main.media_decomp_to_vision_analysis(md)
        assert va.visual_tags == []
        assert va.extracted_text is None
        assert va.is_cluttered is False
