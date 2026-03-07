"""
Tests for Phase 6: Upgraded Executive Diagnostic.

Covers _build_signal_brief() and the updated generate_executive_diagnostic()
branching logic (resonance path vs legacy fallback path).
"""
import sys
import os
import json
import pytest
from unittest.mock import patch, MagicMock, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    QuantitativeMetrics, TextAnalysis, VisionAnalysis, SEMMetrics,
    ResonanceGraph, SignalNode, SignalEdge,
    MediaDecomposition, AudioDescription, SongIdentification,
    TrendAnalysis, RedditSentiment,
)
import main
from main import (
    _build_signal_brief,
    generate_executive_diagnostic,
    RESONANCE_SYSTEM_PROMPT,
    LEGACY_SYSTEM_PROMPT,
)
from helpers import _make_mock_gemini_response, MOCK_RESONANCE_DIAGNOSTIC_RESPONSE, MOCK_DIAGNOSTIC_RESPONSE


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def make_resonance_metrics(
    nodes=None,
    edges=None,
    tier="moderate",
    composite=0.43,
    dominant_signals=None,
    vision_kwargs=None,
    trend_data=None,
    media_decomp=None,
    cultural_context=None,
):
    """Build a minimal QuantitativeMetrics with a ResonanceGraph."""
    if nodes is None:
        nodes = [SignalNode(entity="Nike", weight=0.43, cultural_risk=0.1)]
    if edges is None:
        edges = []
    if dominant_signals is None:
        dominant_signals = [n.entity for n in nodes[:3]]

    vision_kw = {"visual_tags": ["sport"], "is_cluttered": False}
    if vision_kwargs:
        vision_kw.update(vision_kwargs)

    return QuantitativeMetrics(
        text_data=TextAnalysis(
            text="Nike Just Do It",
            readability_score=75.0,
            extracted_entities=["Nike"],
            suggested_tags=["#justdoit"],
        ),
        vision_data=VisionAnalysis(**vision_kw),
        sem_metrics=SEMMetrics(quality_score=7.5, effective_cpc=0.95, daily_clicks=105),
        resonance_graph=ResonanceGraph(
            nodes=nodes,
            edges=edges,
            composite_resonance_score=composite,
            dominant_signals=dominant_signals,
            resonance_tier=tier,
            node_count=len(nodes),
            edge_count=len(edges),
        ),
        trend_data=trend_data,
        media_decomposition=media_decomp,
        cultural_context=cultural_context,
    )


# ──────────────────────────────────────────────────────────────────
# Group A: _build_signal_brief() — 8 tests
# ──────────────────────────────────────────────────────────────────

class TestBuildSignalBrief:
    def test_campaign_fields(self):
        """brief['campaign'] reflects headline, platform, audience arguments."""
        metrics = make_resonance_metrics()
        brief = _build_signal_brief(metrics, "Nike Just Do It", "Meta", "Athletes 18-35")
        assert brief["campaign"]["headline"] == "Nike Just Do It"
        assert brief["campaign"]["platform"] == "Meta"
        assert brief["campaign"]["audience"] == "Athletes 18-35"

    def test_resonance_fields(self):
        """brief['resonance'] reflects tier, composite_score, dominant_signals."""
        metrics = make_resonance_metrics(
            tier="high", composite=0.71,
            dominant_signals=["Nike", "running"],
        )
        brief = _build_signal_brief(metrics, "headline", "TikTok", "Gen Z")
        assert brief["resonance"]["tier"] == "high"
        assert brief["resonance"]["composite_score"] == pytest.approx(0.71)
        assert brief["resonance"]["dominant_signals"] == ["Nike", "running"]

    def test_high_risk_nodes_flagged(self):
        """Nodes with cultural_risk > 0.5 appear in brief['resonance']['high_risk_nodes']."""
        nodes = [
            SignalNode(entity="X", weight=0.4, cultural_risk=0.72),
            SignalNode(entity="Y", weight=0.3, cultural_risk=0.2),
        ]
        metrics = make_resonance_metrics(nodes=nodes)
        brief = _build_signal_brief(metrics, "h", "Meta", "All")
        high_risk_entities = [n["entity"] for n in brief["resonance"]["high_risk_nodes"]]
        assert "X" in high_risk_entities
        assert "Y" not in high_risk_entities

    def test_no_high_risk_nodes(self):
        """All nodes cultural_risk <= 0.5 → high_risk_nodes == []."""
        nodes = [
            SignalNode(entity="Nike", weight=0.4, cultural_risk=0.1),
            SignalNode(entity="Adidas", weight=0.35, cultural_risk=0.0),
        ]
        metrics = make_resonance_metrics(nodes=nodes)
        brief = _build_signal_brief(metrics, "h", "Meta", "All")
        assert brief["resonance"]["high_risk_nodes"] == []

    def test_signal_clusters_threshold(self):
        """Only edges with similarity >= 0.45 appear in brief['signal_clusters']."""
        edges = [
            SignalEdge(source="a", target="b", similarity=0.30),
            SignalEdge(source="a", target="c", similarity=0.45),
            SignalEdge(source="b", target="c", similarity=0.61),
        ]
        metrics = make_resonance_metrics(edges=edges)
        brief = _build_signal_brief(metrics, "h", "Meta", "All")
        cluster_sims = [c["similarity"] for c in brief["signal_clusters"]]
        assert 0.30 not in cluster_sims
        assert 0.45 in cluster_sims
        assert 0.61 in cluster_sims

    def test_audio_signal_present(self):
        """Song in media_decomposition → brief['audio_signal'] populated."""
        song = SongIdentification(title="Espresso", artist="Sabrina Carpenter", trend_momentum=0.82)
        audio = AudioDescription(has_audio=True, song_id=song)
        md = MediaDecomposition(media_type="video", audio=audio)
        metrics = make_resonance_metrics(media_decomp=md)
        brief = _build_signal_brief(metrics, "h", "TikTok", "Gen Z")
        assert brief["audio_signal"] is not None
        assert brief["audio_signal"]["title"] == "Espresso"
        assert brief["audio_signal"]["artist"] == "Sabrina Carpenter"
        assert brief["audio_signal"]["trend_momentum"] == pytest.approx(0.82)

    def test_audio_signal_absent(self):
        """No media_decomposition → brief['audio_signal'] is None."""
        metrics = make_resonance_metrics(media_decomp=None)
        brief = _build_signal_brief(metrics, "h", "Meta", "All")
        assert brief["audio_signal"] is None

    def test_token_budget_under_3000_chars(self):
        """Full brief JSON serialization should be under 3000 characters."""
        td = TrendAnalysis(
            momentum=0.65,
            related_queries_top=["nike shoes", "running shoes", "air max"],
            related_queries_rising=["nike air max 2026"],
            top_regions=[{"name": "United States", "interest": 100}],
            keywords_searched=["Nike"],
            data_points=91,
            time_series=[50.0] * 91,
        )
        metrics = make_resonance_metrics(trend_data=td)
        brief = _build_signal_brief(metrics, "Nike Just Do It — Summer 2026", "Meta", "Athletes 18-35")
        serialized = json.dumps(brief)
        assert len(serialized) < 3000, f"Brief too large: {len(serialized)} chars"


# ──────────────────────────────────────────────────────────────────
# Group B: generate_executive_diagnostic() — 6 tests
# ──────────────────────────────────────────────────────────────────

class TestGenerateExecutiveDiagnostic:
    def _make_mock_client(self, text):
        """Return a mock gemini_client that returns `text` from generate_content."""
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = _make_mock_gemini_response(text)
        return mock_client

    def test_uses_resonance_prompt_when_graph_present(self):
        """When resonance_graph is present, RESONANCE_SYSTEM_PROMPT is used."""
        metrics = make_resonance_metrics()
        mock_client = self._make_mock_client(MOCK_RESONANCE_DIAGNOSTIC_RESPONSE)
        with patch.object(main, "gemini_client", mock_client):
            generate_executive_diagnostic(metrics, "headline", "Meta", "Athletes")
        call_args = mock_client.models.generate_content.call_args
        contents = call_args.kwargs.get("contents") or call_args.args[0] if call_args.args else call_args.kwargs.get("contents")
        # Contents is positional keyword; check the call was made
        assert mock_client.models.generate_content.called
        # The contents string should include the resonance prompt
        all_content = str(call_args)
        assert "Resonance Overview" in all_content or RESONANCE_SYSTEM_PROMPT[:30] in all_content

    def test_uses_legacy_prompt_when_no_graph(self):
        """When resonance_graph is None, LEGACY_SYSTEM_PROMPT is used."""
        metrics = QuantitativeMetrics(
            text_data=TextAnalysis(
                text="test",
                readability_score=70.0,
                extracted_entities=["test"],
                suggested_tags=["#test"],
            ),
            vision_data=VisionAnalysis(visual_tags=["test"], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=6.0, effective_cpc=1.2, daily_clicks=80),
            resonance_graph=None,
        )
        mock_client = self._make_mock_client(MOCK_DIAGNOSTIC_RESPONSE)
        with patch.object(main, "gemini_client", mock_client):
            generate_executive_diagnostic(metrics, "headline", "Meta", "Athletes")
        assert mock_client.models.generate_content.called
        all_content = str(mock_client.models.generate_content.call_args)
        assert "Performance Summary" in all_content or LEGACY_SYSTEM_PROMPT[:30] in all_content

    def test_returns_stripped_text(self):
        """Extra whitespace in Gemini response is stripped."""
        metrics = make_resonance_metrics()
        mock_client = self._make_mock_client("  \n  some diagnostic text  \n  ")
        with patch.object(main, "gemini_client", mock_client):
            result = generate_executive_diagnostic(metrics, "h", "Meta", "All")
        assert result == "some diagnostic text"

    def test_retry_on_empty_response(self):
        """First call returns empty text → retry → second call succeeds."""
        metrics = make_resonance_metrics()
        empty_resp = _make_mock_gemini_response("")
        real_resp = _make_mock_gemini_response("Diagnostic output")
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [empty_resp, real_resp]
        with patch.object(main, "gemini_client", mock_client):
            with patch("main.time.sleep"):  # skip the wait
                result = generate_executive_diagnostic(metrics, "h", "Meta", "All")
        assert result == "Diagnostic output"
        assert mock_client.models.generate_content.call_count == 2

    def test_retry_on_exception(self):
        """First call raises Exception → retry → second call succeeds."""
        metrics = make_resonance_metrics()
        real_resp = _make_mock_gemini_response("Recovered diagnostic")
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            Exception("Gemini timeout"),
            real_resp,
        ]
        with patch.object(main, "gemini_client", mock_client):
            with patch("main.time.sleep"):
                result = generate_executive_diagnostic(metrics, "h", "Meta", "All")
        assert result == "Recovered diagnostic"

    def test_no_gemini_client_returns_fallback(self):
        """When gemini_client is None, returns the unavailable fallback string immediately."""
        metrics = make_resonance_metrics()
        with patch.object(main, "gemini_client", None):
            result = generate_executive_diagnostic(metrics, "h", "Meta", "All")
        assert "unavailable" in result.lower() or "GEMINI_API_KEY" in result
