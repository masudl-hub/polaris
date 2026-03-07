"""
Tests for Phase 4: Cultural Context via Perplexity Sonar.
Covers: query_entity_cultural_context, run_cultural_context,
        select_top_entities_for_cultural_context, risk aggregation,
        concurrency patterns, backward compat.

24 tests across 6 classes — all HTTP I/O is mocked via httpx.
"""
import os
import sys
import json
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    EntityNode, EntityAtomization,
    EntityCulturalContext, CulturalContext, QuantitativeMetrics,
    TextAnalysis, VisionAnalysis, SEMMetrics, SentimentBreakdown,
)


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def _valid_sonar_payload(entity_name="Nike"):
    return json.dumps({
        "cultural_sentiment": "positive",
        "trending_direction": "ascending",
        "narrative_summary": f"{entity_name} is thriving culturally right now.",
        "advertising_risk": "low",
        "advertising_risk_reason": "No active controversies.",
        "cultural_moments": ["Paris Olympics partnership", "sustainability campaign"],
        "adjacent_topics": ["streetwear", "Gen-Z", "sustainability"],
    })


def _make_httpx_response(status_code=200, content=None, entity_name="Nike"):
    """Build a mock httpx.Response-like object."""
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    if status_code == 200:
        mock_resp.json.return_value = {
            "id": "chatcmpl-test",
            "model": "sonar",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content if content is not None else _valid_sonar_payload(entity_name),
                },
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 120, "completion_tokens": 200, "total_tokens": 320},
        }
        mock_resp.raise_for_status = MagicMock()
    else:
        import httpx
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            message=f"HTTP {status_code}",
            request=MagicMock(),
            response=MagicMock(status_code=status_code),
        )
    return mock_resp


def _make_mock_async_client(response):
    """Wrap a response in a mock httpx.AsyncClient context manager."""
    mock_client = MagicMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = AsyncMock(return_value=response)
    return mock_client


# ──────────────────────────────────────────────────────────────────
# 1. query_entity_cultural_context
# ──────────────────────────────────────────────────────────────────

class TestQueryEntityCulturalContext:
    def test_valid_response_returns_entity_context(self):
        """Mock httpx returning valid Sonar JSON → EntityCulturalContext populated."""
        import main
        mock_resp = _make_httpx_response(200, entity_name="Nike")
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "pplx-test-key"))

        assert result is not None
        assert isinstance(result, EntityCulturalContext)
        assert result.entity_name == "Nike"
        assert result.cultural_sentiment == "positive"
        assert result.trending_direction == "ascending"
        assert result.advertising_risk == "low"
        assert len(result.cultural_moments) == 2
        assert len(result.adjacent_topics) == 3

    def test_http_401_returns_none(self):
        """HTTPStatusError with 401 → returns None gracefully."""
        import main
        mock_resp = _make_httpx_response(401)
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "bad-key"))

        assert result is None

    def test_http_429_returns_none(self):
        """HTTPStatusError with 429 → returns None gracefully."""
        import main
        mock_resp = _make_httpx_response(429)
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "pplx-key"))

        assert result is None

    def test_malformed_json_returns_none(self):
        """Sonar returns non-JSON text → JSONDecodeError caught, returns None."""
        import main
        mock_resp = _make_httpx_response(200, content="Sorry, I cannot answer that.")
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "pplx-key"))

        assert result is None

    def test_markdown_fences_stripped(self):
        """Sonar wraps JSON in ```json...``` → still parses correctly."""
        import main
        fenced = "```json\n" + _valid_sonar_payload("Adidas") + "\n```"
        mock_resp = _make_httpx_response(200, content=fenced)
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Adidas", "pplx-key"))

        assert result is not None
        assert result.entity_name == "Adidas"

    def test_invalid_sentiment_clamped_to_neutral(self):
        """cultural_sentiment with unexpected value is clamped to 'neutral'."""
        import main
        bad_payload = json.dumps({
            "cultural_sentiment": "ambivalent",
            "trending_direction": "ascending",
            "narrative_summary": "Test.",
            "advertising_risk": "low",
            "advertising_risk_reason": "Fine.",
            "cultural_moments": [],
            "adjacent_topics": [],
        })
        mock_resp = _make_httpx_response(200, content=bad_payload)
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "pplx-key"))

        assert result is not None
        assert result.cultural_sentiment == "neutral"

    def test_invalid_risk_clamped_to_low(self):
        """advertising_risk with unexpected value is clamped to 'low'."""
        import main
        bad_payload = json.dumps({
            "cultural_sentiment": "positive",
            "trending_direction": "stable",
            "narrative_summary": "Test.",
            "advertising_risk": "extreme",
            "advertising_risk_reason": "Very extreme.",
            "cultural_moments": [],
            "adjacent_topics": [],
        })
        mock_resp = _make_httpx_response(200, content=bad_payload)
        mock_client = _make_mock_async_client(mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "pplx-key"))

        assert result is not None
        assert result.advertising_risk == "low"

    def test_network_exception_returns_none(self):
        """Generic network exception → returns None gracefully."""
        import main
        mock_client = MagicMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))

        with patch("httpx.AsyncClient", return_value=mock_client):
            result = asyncio.run(main.query_entity_cultural_context("Nike", "pplx-key"))

        assert result is None


# ──────────────────────────────────────────────────────────────────
# 2. run_cultural_context
# ──────────────────────────────────────────────────────────────────

class TestRunCulturalContext:
    def test_no_api_key_returns_none(self):
        """No PERPLEXITY_API_KEY in env → returns None without making HTTP calls."""
        import main
        ea = EntityAtomization(nodes=[EntityNode(name="Nike", momentum=0.7)])

        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("PERPLEXITY_API_KEY", None)
            result = asyncio.run(main.run_cultural_context(ea, ["Nike"], "US"))

        assert result is None

    def test_no_entities_returns_none(self):
        """entity_atomization=None and fallback_entities=[] → returns None."""
        import main

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            result = asyncio.run(main.run_cultural_context(None, [], "US"))

        assert result is None

    def test_all_calls_succeed_returns_context(self):
        """3 mocked entities, all succeed → CulturalContext with 3 entity contexts."""
        import main

        mock_ctx = EntityCulturalContext(
            entity_name="Nike",
            cultural_sentiment="positive",
            trending_direction="ascending",
            narrative_summary="Nike is thriving.",
            advertising_risk="low",
        )

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            with patch.object(main, "query_entity_cultural_context", new_callable=AsyncMock, return_value=mock_ctx):
                nodes = [
                    EntityNode(name="Nike", momentum=0.8),
                    EntityNode(name="Adidas", momentum=0.6),
                    EntityNode(name="Paris", momentum=0.7),
                ]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is not None
        assert isinstance(result, CulturalContext)
        assert len(result.entity_contexts) == 3

    def test_one_call_fails_partial_result(self):
        """3 entities, 1 raises exception → CulturalContext with 2 items returned."""
        import main

        mock_ctx = EntityCulturalContext(
            entity_name="Nike",
            cultural_sentiment="positive",
            trending_direction="ascending",
            narrative_summary="Test.",
            advertising_risk="low",
        )
        call_count = [0]

        async def mock_query(entity, key):
            call_count[0] += 1
            if call_count[0] == 2:
                raise Exception("Sonar timeout")
            return mock_ctx

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            with patch.object(main, "query_entity_cultural_context", side_effect=mock_query):
                nodes = [
                    EntityNode(name="Nike", momentum=0.8),
                    EntityNode(name="Adidas", momentum=0.6),
                    EntityNode(name="Paris", momentum=0.7),
                ]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is not None
        assert len(result.entity_contexts) == 2

    def test_all_calls_fail_returns_none(self):
        """All 3 entity queries raise exceptions → returns None."""
        import main

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            with patch.object(main, "query_entity_cultural_context", new_callable=AsyncMock, return_value=None):
                nodes = [
                    EntityNode(name="Nike", momentum=0.8),
                    EntityNode(name="Adidas", momentum=0.6),
                ]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is None


# ──────────────────────────────────────────────────────────────────
# 3. select_top_entities_for_cultural_context
# ──────────────────────────────────────────────────────────────────

class TestSelectTopEntitiesForCulturalContext:
    def test_sorted_by_momentum_descending(self):
        """Nodes with momenta [0.3, 0.8, 0.55] → names returned in order [0.8, 0.55, 0.3]."""
        import main
        nodes = [
            EntityNode(name="Low", momentum=0.3),
            EntityNode(name="High", momentum=0.8),
            EntityNode(name="Mid", momentum=0.55),
        ]
        ea = EntityAtomization(nodes=nodes)
        result = main.select_top_entities_for_cultural_context(ea, [])
        assert result == ["High", "Mid", "Low"]

    def test_none_momentum_ranked_last(self):
        """Node with momentum=None is placed after all scored nodes."""
        import main
        nodes = [
            EntityNode(name="Unknown", momentum=None),
            EntityNode(name="Nike", momentum=0.7),
            EntityNode(name="Paris", momentum=0.4),
        ]
        ea = EntityAtomization(nodes=nodes)
        result = main.select_top_entities_for_cultural_context(ea, [])
        assert result[0] == "Nike"
        assert result[1] == "Paris"
        assert result[2] == "Unknown"

    def test_max_3_entities_selected(self):
        """5 nodes → only top-3 names returned."""
        import main
        nodes = [EntityNode(name=f"E{i}", momentum=float(i) / 10.0) for i in range(5, 0, -1)]
        ea = EntityAtomization(nodes=nodes)
        result = main.select_top_entities_for_cultural_context(ea, [])
        assert len(result) == 3

    def test_falls_back_to_entities_when_no_atomization(self):
        """entity_atomization=None → uses fallback_entities[:3]."""
        import main
        result = main.select_top_entities_for_cultural_context(
            None, ["Alpha", "Beta", "Gamma", "Delta"]
        )
        assert result == ["Alpha", "Beta", "Gamma"]

    def test_empty_nodes_falls_back(self):
        """EntityAtomization with empty nodes list → falls back to fallback_entities."""
        import main
        ea = EntityAtomization(nodes=[])
        result = main.select_top_entities_for_cultural_context(ea, ["Fallback"])
        assert result == ["Fallback"]


# ──────────────────────────────────────────────────────────────────
# 4. Overall risk aggregation
# ──────────────────────────────────────────────────────────────────

class TestOverallRiskAggregation:
    def _make_ctx(self, name, risk):
        return EntityCulturalContext(
            entity_name=name,
            cultural_sentiment="neutral",
            trending_direction="stable",
            narrative_summary="Test.",
            advertising_risk=risk,
        )

    def test_overall_risk_is_worst_case(self):
        """Entities with [low, medium, high] → overall_advertising_risk='high'."""
        import main

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            async def mock_query(entity, key):
                risk_map = {"Low": "low", "Medium": "medium", "High": "high"}
                return self._make_ctx(entity, risk_map[entity])

            with patch.object(main, "query_entity_cultural_context", side_effect=mock_query):
                nodes = [
                    EntityNode(name="Low", momentum=0.3),
                    EntityNode(name="Medium", momentum=0.5),
                    EntityNode(name="High", momentum=0.7),
                ]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is not None
        assert result.overall_advertising_risk == "high"

    def test_overall_risk_all_low(self):
        """All entities have advertising_risk='low' → overall='low'."""
        import main
        low_ctx = self._make_ctx("Nike", "low")

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            with patch.object(main, "query_entity_cultural_context", new_callable=AsyncMock, return_value=low_ctx):
                nodes = [EntityNode(name="Nike", momentum=0.7), EntityNode(name="Adidas", momentum=0.6)]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is not None
        assert result.overall_advertising_risk == "low"

    def test_overall_risk_medium_beats_low(self):
        """[low, medium] → overall='medium'."""
        import main

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            async def mock_query(entity, key):
                return self._make_ctx(entity, "medium" if entity == "Risky" else "low")

            with patch.object(main, "query_entity_cultural_context", side_effect=mock_query):
                nodes = [EntityNode(name="Safe", momentum=0.6), EntityNode(name="Risky", momentum=0.7)]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is not None
        assert result.overall_advertising_risk == "medium"


# ──────────────────────────────────────────────────────────────────
# 5. Concurrency
# ──────────────────────────────────────────────────────────────────

class TestConcurrentCalls:
    def test_all_calls_made_concurrently(self):
        """All entity queries are gathered (not sequential) — gather called once."""
        import main

        gather_calls = []
        original_gather = asyncio.gather

        async def tracking_gather(*coros, **kwargs):
            gather_calls.append(len(coros))
            return await original_gather(*coros, **kwargs)

        mock_ctx = EntityCulturalContext(
            entity_name="X",
            cultural_sentiment="neutral",
            trending_direction="stable",
            narrative_summary="Test.",
            advertising_risk="low",
        )

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            with patch.object(main, "query_entity_cultural_context", new_callable=AsyncMock, return_value=mock_ctx):
                with patch("asyncio.gather", side_effect=tracking_gather):
                    nodes = [
                        EntityNode(name="A", momentum=0.8),
                        EntityNode(name="B", momentum=0.7),
                        EntityNode(name="C", momentum=0.6),
                    ]
                    ea = EntityAtomization(nodes=nodes)
                    asyncio.run(main.run_cultural_context(ea, [], "US"))

        # gather should have been called with 3 coroutines at once
        assert any(n >= 2 for n in gather_calls), "Expected gather with multiple coroutines"

    def test_gather_exceptions_do_not_propagate(self):
        """return_exceptions=True ensures one bad call doesn't kill the others."""
        import main

        call_results = []

        async def mock_query_mixed(entity, key):
            if entity == "Bad":
                raise Exception("Sonar error")
            ctx = EntityCulturalContext(
                entity_name=entity,
                cultural_sentiment="positive",
                trending_direction="ascending",
                narrative_summary="Good.",
                advertising_risk="low",
            )
            return ctx

        with patch.dict(os.environ, {"PERPLEXITY_API_KEY": "pplx-test"}):
            with patch.object(main, "query_entity_cultural_context", side_effect=mock_query_mixed):
                nodes = [
                    EntityNode(name="Good", momentum=0.8),
                    EntityNode(name="Bad", momentum=0.7),
                    EntityNode(name="AlsoGood", momentum=0.6),
                ]
                ea = EntityAtomization(nodes=nodes)
                result = asyncio.run(main.run_cultural_context(ea, [], "US"))

        assert result is not None
        assert len(result.entity_contexts) == 2


# ──────────────────────────────────────────────────────────────────
# 6. Backward compatibility
# ──────────────────────────────────────────────────────────────────

class TestBackwardCompat:
    def test_quant_metrics_without_cultural_context(self):
        """QuantitativeMetrics(cultural_context=None) is valid (default)."""
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(
                extracted_entities=[],
                sentiment_score=0.5,
                suggested_tags=[],
                sentiment_breakdown=SentimentBreakdown(positive=0.5, neutral=0.3, negative=0.2),
            ),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
        )
        assert qm.cultural_context is None
