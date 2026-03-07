"""
Tests for the SSE streaming endpoint — POST /api/v1/evaluate_ad_stream.
Validates that the streaming pipeline emits correct event types in order,
and that the frontend can parse them correctly.
"""
import pytest
import os
import sys
import json
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


@pytest.fixture(scope="module")
def test_client():
    """Create a FastAPI TestClient with real ML models + mocked externals."""
    os.environ.setdefault("GEMINI_API_KEY", "test-key")

    from fastapi.testclient import TestClient
    import main

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

    from helpers import _make_mock_gemini_response, MOCK_MEDIA_DECOMP_RESPONSE, MOCK_DIAGNOSTIC_RESPONSE

    mock_gemini = MagicMock()
    def gemini_side_effect(model, contents, **kwargs):
        if isinstance(contents, list) and len(contents) >= 2:
            return _make_mock_gemini_response(MOCK_MEDIA_DECOMP_RESPONSE)
        return _make_mock_gemini_response(MOCK_DIAGNOSTIC_RESPONSE)
    mock_gemini.models.generate_content.side_effect = gemini_side_effect
    main.gemini_client = mock_gemini

    if main.audience_scorer is None:
        main.audience_scorer = {"model": MagicMock(), "embeddings": {}}

    client = TestClient(main.app, raise_server_exceptions=False)
    yield client


@pytest.fixture
def mock_trends():
    """Patch pytrends for all streaming tests."""
    import pandas as pd
    import numpy as np

    mock = MagicMock()
    dates = pd.date_range(end="2026-03-05", periods=91, freq="D")
    values = np.linspace(50, 75, 91)
    df = pd.DataFrame({"keyword1": values, "isPartial": [False] * 91}, index=dates)
    mock.interest_over_time.return_value = df
    mock.related_queries.return_value = {
        "keyword1": {
            "top": pd.DataFrame({"query": ["related 1", "related 2"]}),
            "rising": pd.DataFrame({"query": ["rising 1"]}),
        }
    }
    mock.interest_by_region.return_value = pd.DataFrame(
        {"keyword1": [100, 80]},
        index=["United States", "United Kingdom"],
    )

    with patch("main._pytrends_with_retry", return_value=mock):
        yield mock


def parse_sse_events(response_text: str) -> list:
    """Parse SSE text into a list of event dicts."""
    events = []
    for line in response_text.split("\n\n"):
        line = line.strip()
        if line.startswith("data: "):
            try:
                events.append(json.loads(line[6:]))
            except json.JSONDecodeError:
                continue
    return events


# ──────────────────────────────────────────────────────────────────
# Core streaming behavior
# ──────────────────────────────────────────────────────────────────

class TestStreamingEndpoint:
    def test_returns_200_event_stream(self, test_client, mock_trends):
        """Endpoint should return 200 with text/event-stream content type."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Streaming test",
                "body": "Test body for streaming",
                "platform": "Meta",
            },
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

    def test_emits_pipeline_started_event(self, test_client, mock_trends):
        """First event should be pipeline_started with metadata."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Pipeline start test",
                "body": "Body",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        assert len(events) > 0

        first = events[0]
        assert first["type"] == "pipeline_started"
        assert "total_steps" in first
        assert "platform" in first
        assert first["platform"] == "Meta"

    def test_emits_done_event_at_end(self, test_client, mock_trends):
        """Last event should be type='done'."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Done event test",
                "body": "Body",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        assert len(events) > 0

        last = events[-1]
        assert last["type"] == "done"

    def test_step_events_have_required_fields(self, test_client, mock_trends):
        """Every step event should have step, name, model, duration_ms."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Step validation test",
                "body": "Body",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        step_events = [e for e in events if e.get("type") == "step"]

        assert len(step_events) > 0
        for step in step_events:
            assert "step" in step
            assert "name" in step
            assert "model" in step
            assert "duration_ms" in step
            assert isinstance(step["duration_ms"], int)

    def test_emits_data_events_for_each_module(self, test_client, mock_trends):
        """Should emit vision_data, text_data, sem_metrics, trend_data, diagnostic."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Full pipeline test",
                "body": "Complete body text for pipeline",
                "hashtags": "#test,#pipeline",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        event_types = {e.get("type") for e in events}

        # These should always be present
        assert "pipeline_started" in event_types
        assert "text_data" in event_types
        assert "sem_metrics" in event_types
        assert "diagnostic" in event_types
        assert "done" in event_types

    def test_step_numbers_sequential(self, test_client, mock_trends):
        """Step numbers should be sequential starting from 1."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Sequential steps test",
                "body": "Body",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        step_events = [e for e in events if e.get("type") == "step"]

        step_nums = [s["step"] for s in step_events]
        assert step_nums == sorted(step_nums), "Steps should be in order"
        assert step_nums[0] == 1, "First step should be 1"


# ──────────────────────────────────────────────────────────────────
# Streaming with image
# ──────────────────────────────────────────────────────────────────

class TestStreamingWithMedia:
    def test_image_upload_emits_vision_data(self, test_client, mock_trends):
        """Image upload should emit vision_data event with tags."""
        image_path = os.path.join(FIXTURES_DIR, "sample_image.jpg")
        with open(image_path, "rb") as f:
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "Image stream test",
                    "body": "Body",
                    "platform": "Meta",
                },
                files={"media_file": ("test.jpg", f, "image/jpeg")},
            )
        events = parse_sse_events(resp.text)
        event_types = {e.get("type") for e in events}
        assert "vision_data" in event_types

        # Find vision_data event and validate
        vision_events = [e for e in events if e.get("type") == "vision_data"]
        assert len(vision_events) == 1
        assert "data" in vision_events[0]
        assert "visual_tags" in vision_events[0]["data"]

    def test_video_upload_emits_vision_data(self, test_client, mock_trends):
        """Video upload should also emit vision_data."""
        video_path = os.path.join(FIXTURES_DIR, "sample_video.mp4")
        with open(video_path, "rb") as f:
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "Video stream test",
                    "body": "Body",
                    "platform": "TikTok",
                },
                files={"media_file": ("test.mp4", f, "video/mp4")},
            )
        events = parse_sse_events(resp.text)
        event_types = {e.get("type") for e in events}
        assert "vision_data" in event_types

    def test_no_media_skips_vision(self, test_client, mock_trends):
        """Text-only should emit vision_data with '(no media)' tag."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Text only stream",
                "body": "No media",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        vision_events = [e for e in events if e.get("type") == "vision_data"]
        assert len(vision_events) == 1
        assert "(no media)" in vision_events[0]["data"]["visual_tags"]


# ──────────────────────────────────────────────────────────────────
# Error handling
# ──────────────────────────────────────────────────────────────────

class TestStreamingErrorHandling:
    def test_gemini_failure_emits_error_step(self, test_client, mock_trends):
        """If Gemini fails during vision, pipeline should continue with fallback."""
        import main
        original_client = main.gemini_client

        # Make vision call fail but diagnostic call succeed
        mock_broken = MagicMock()
        mock_broken.models.generate_content.side_effect = Exception("API quota exceeded")
        main.gemini_client = mock_broken

        image_path = os.path.join(FIXTURES_DIR, "sample_image.jpg")
        with open(image_path, "rb") as f:
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "Error test",
                    "body": "Body",
                    "platform": "Meta",
                },
                files={"media_file": ("test.jpg", f, "image/jpeg")},
            )

        # Restore
        main.gemini_client = original_client

        events = parse_sse_events(resp.text)
        # Pipeline should still complete (with error steps) or emit an error event
        event_types = {e.get("type") for e in events}
        # Should have either continued with error steps or emitted an error
        assert "done" in event_types or "error" in event_types


# ──────────────────────────────────────────────────────────────────
# Frontend-compatible event parsing
# ──────────────────────────────────────────────────────────────────

class TestFrontendCompatibility:
    def test_all_events_are_valid_json(self, test_client, mock_trends):
        """Every SSE data line should parse as valid JSON."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "JSON validity test",
                "body": "Body",
                "platform": "Meta",
            },
        )
        for line in resp.text.split("\n\n"):
            line = line.strip()
            if line.startswith("data: "):
                parsed = json.loads(line[6:])
                assert "type" in parsed, f"Event missing 'type' key: {parsed}"

    def test_text_data_shape(self, test_client, mock_trends):
        """text_data event should match TextAnalysis model shape."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Model shape test",
                "body": "Testing text data shape",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        text_events = [e for e in events if e.get("type") == "text_data"]
        assert len(text_events) == 1

        td = text_events[0]["data"]
        assert "extracted_entities" in td
        assert "sentiment_score" in td
        assert "suggested_tags" in td
        assert isinstance(td["extracted_entities"], list)

    def test_sem_metrics_shape(self, test_client, mock_trends):
        """sem_metrics event should match SEMMetrics model shape."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "SEM shape test",
                "body": "Body",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        sem_events = [e for e in events if e.get("type") == "sem_metrics"]
        assert len(sem_events) == 1

        sem = sem_events[0]["data"]
        assert "quality_score" in sem
        assert "effective_cpc" in sem
        assert "daily_clicks" in sem


# ──────────────────────────────────────────────────────────────────
# Phase 2: Audio Intelligence streaming events
# ──────────────────────────────────────────────────────────────────

class TestAudioIntelligenceStreaming:
    def test_no_audio_intelligence_event_for_text_only(self, test_client, mock_trends):
        """audio_intelligence_data should NOT appear when no media is uploaded."""
        resp = test_client.post(
            "/api/v1/evaluate_ad_stream",
            data={
                "headline": "Text-only audio test",
                "body": "No media file here",
                "platform": "Meta",
            },
        )
        events = parse_sse_events(resp.text)
        ai_events = [e for e in events if e.get("type") == "audio_intelligence_data"]
        assert len(ai_events) == 0

    def test_audio_intelligence_event_emitted_for_video(self, test_client, mock_trends):
        """audio_intelligence_data should be emitted for video uploads when song is identified."""
        import main
        from models import SongIdentification

        mock_song = SongIdentification(
            title="Blinding Lights",
            artist="The Weeknd",
            trend_momentum=0.75,
        )

        video_path = os.path.join(FIXTURES_DIR, "sample_video.mp4")
        with open(video_path, "rb") as f:
            with patch.object(main, "run_audio_intelligence", new_callable=AsyncMock, return_value=mock_song):
                resp = test_client.post(
                    "/api/v1/evaluate_ad_stream",
                    data={
                        "headline": "Video audio intel test",
                        "body": "Body",
                        "platform": "TikTok",
                    },
                    files={"media_file": ("test.mp4", f, "video/mp4")},
                )

        events = parse_sse_events(resp.text)
        ai_events = [e for e in events if e.get("type") == "audio_intelligence_data"]
        assert len(ai_events) == 1
        song_data = ai_events[0]["data"]
        assert song_data["title"] == "Blinding Lights"
        assert song_data["artist"] == "The Weeknd"
        assert song_data["trend_momentum"] == pytest.approx(0.75)


# ──────────────────────────────────────────────────────────────────
# Phase 3: Entity Atomization streaming events
# ──────────────────────────────────────────────────────────────────

class TestEntityAtomizationStreaming:
    def test_entity_atomization_event_in_stream(self, test_client, mock_trends):
        """entity_atomization_data should be emitted when entities are detected."""
        import main
        from models import EntityNode, EntityAtomization

        mock_ea = EntityAtomization(
            nodes=[
                EntityNode(name="Nike", momentum=0.7, related_queries_top=["air max"], related_queries_rising=[]),
                EntityNode(name="Adidas", momentum=0.6, related_queries_top=["yeezy"], related_queries_rising=[]),
            ],
            aggregate_momentum=0.65,
        )

        with patch.object(main, "run_entity_atomization", return_value=mock_ea):
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "Nike vs Adidas — Summer 2025 Brand Battle",
                    "body": "Nike and Adidas are competing for market share in Paris this summer.",
                    "platform": "Meta",
                },
            )

        events = parse_sse_events(resp.text)
        ea_events = [e for e in events if e.get("type") == "entity_atomization_data"]
        assert len(ea_events) == 1

        ea_data = ea_events[0]["data"]
        assert "nodes" in ea_data
        assert "aggregate_momentum" in ea_data
        assert len(ea_data["nodes"]) == 2
        node_names = {n["name"] for n in ea_data["nodes"]}
        assert "Nike" in node_names
        assert "Adidas" in node_names

    def test_entity_atomization_absent_for_no_entities(self, test_client, mock_trends):
        """entity_atomization_data should NOT be emitted when NER extracts no entities."""
        import main

        # Patch NLP so that doc.ents is empty → entities list will be []
        mock_doc = MagicMock()
        mock_doc.ents = []
        mock_nlp = MagicMock(return_value=mock_doc)

        original_nlp = main.nlp_model
        main.nlp_model = mock_nlp
        try:
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "buy now",
                    "body": "limited time offer",
                    "platform": "Meta",
                },
            )
        finally:
            main.nlp_model = original_nlp

        events = parse_sse_events(resp.text)
        ea_events = [e for e in events if e.get("type") == "entity_atomization_data"]
        assert len(ea_events) == 0


# ──────────────────────────────────────────────────────────────────
# Phase 4: Cultural Context streaming events
# ──────────────────────────────────────────────────────────────────

class TestCulturalContextStreaming:
    def test_cultural_context_event_when_key_set(self, test_client, mock_trends):
        """cultural_context_data event should be emitted when run_cultural_context returns data."""
        import main
        from models import EntityCulturalContext, CulturalContext

        mock_cc = CulturalContext(
            entity_contexts=[
                EntityCulturalContext(
                    entity_name="Nike",
                    cultural_sentiment="positive",
                    trending_direction="ascending",
                    narrative_summary="Nike is trending positively in athletic wear.",
                    advertising_risk="low",
                    cultural_moments=["Paris Olympics"],
                    adjacent_topics=["running", "fitness"],
                )
            ],
            overall_advertising_risk="low",
        )

        with patch.object(main, "run_cultural_context", new_callable=AsyncMock, return_value=mock_cc):
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "Nike Just Do It Summer 2025",
                    "body": "Nike is pushing new athletic collections this summer.",
                    "platform": "Meta",
                },
            )

        events = parse_sse_events(resp.text)
        cc_events = [e for e in events if e.get("type") == "cultural_context_data"]
        assert len(cc_events) == 1

        cc_data = cc_events[0]["data"]
        assert "entity_contexts" in cc_data
        assert "overall_advertising_risk" in cc_data
        assert cc_data["overall_advertising_risk"] == "low"
        assert len(cc_data["entity_contexts"]) == 1
        assert cc_data["entity_contexts"][0]["entity_name"] == "Nike"

    def test_cultural_context_absent_when_no_key(self, test_client, mock_trends):
        """cultural_context_data should NOT be emitted when run_cultural_context returns None."""
        import main

        with patch.object(main, "run_cultural_context", new_callable=AsyncMock, return_value=None):
            resp = test_client.post(
                "/api/v1/evaluate_ad_stream",
                data={
                    "headline": "Nike Summer Sale",
                    "body": "Big discounts on Nike shoes this summer.",
                    "platform": "Meta",
                },
            )

        events = parse_sse_events(resp.text)
        cc_events = [e for e in events if e.get("type") == "cultural_context_data"]
        assert len(cc_events) == 0

        # A step event for Cultural Context should still appear (with warning status)
        step_events = [e for e in events if e.get("type") == "step" and e.get("name") == "Cultural Context"]
        assert len(step_events) >= 1
        assert step_events[0].get("status") == "warning"
