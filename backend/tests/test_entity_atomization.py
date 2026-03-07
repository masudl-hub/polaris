"""
Tests for Phase 3 Entity Atomization pipeline.
Covers: run_entity_trend_profile, run_entity_atomization, throttling, models.

20 tests across 5 classes — all external pytrends I/O is mocked.
"""
import os
import sys
import math
import pytest
from unittest.mock import patch, MagicMock, call

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import EntityNode, EntityAtomization, QuantitativeMetrics


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def _make_pytrends_mock(
    interest_df=None,
    related_top=None,
    related_rising=None,
    region_df=None,
):
    """Build a pytrends mock with realistic return values."""
    import pandas as pd
    import numpy as np

    if interest_df is None:
        dates = pd.date_range(end="2026-03-01", periods=91, freq="D")
        values = np.linspace(50, 75, 91)
        interest_df = pd.DataFrame(
            {"Nike": values, "isPartial": [False] * 91}, index=dates
        )

    mock = MagicMock()
    mock.interest_over_time.return_value = interest_df

    top_data = related_top if related_top is not None else ["air max 2025", "nike dunk"]
    rising_data = related_rising if related_rising is not None else ["breakout term"]

    mock.related_queries.return_value = {
        "Nike": {
            "top": pd.DataFrame({"query": top_data}),
            "rising": pd.DataFrame({"query": rising_data}),
        }
    }

    if region_df is None:
        region_df = pd.DataFrame(
            {"Nike": [90, 70, 60, 50, 40]},
            index=["United States", "United Kingdom", "Canada", "Australia", "Germany"],
        )
    mock.interest_by_region.return_value = region_df

    return mock


def _expected_momentum(values_7d, values_30d):
    """Compute expected sigmoid momentum given recent trends."""
    recent_7 = sum(values_7d) / len(values_7d)
    recent_30 = sum(values_30d) / len(values_30d)
    if recent_30 == 0:
        return None
    raw = recent_7 / recent_30
    return round(1.0 / (1.0 + math.exp(-3.0 * (raw - 1.0))), 4)


# ──────────────────────────────────────────────────────────────────
# 1. run_entity_trend_profile
# ──────────────────────────────────────────────────────────────────

class TestRunEntityTrendProfile:
    def test_empty_entity_returns_none(self):
        """Empty string entity returns None without calling pytrends."""
        import main
        with patch("main._pytrends_with_retry") as mock_pt:
            result = main.run_entity_trend_profile("", "US")
        assert result is None
        mock_pt.assert_not_called()

    def test_whitespace_entity_returns_none(self):
        """Whitespace-only entity returns None without calling pytrends."""
        import main
        with patch("main._pytrends_with_retry") as mock_pt:
            result = main.run_entity_trend_profile("   ", "US")
        assert result is None
        mock_pt.assert_not_called()

    def test_valid_entity_returns_entity_node(self):
        """Valid entity with mock pytrends returns correctly named EntityNode."""
        import main
        mock_pt = _make_pytrends_mock()
        with patch("main._pytrends_with_retry", return_value=mock_pt):
            result = main.run_entity_trend_profile("Nike", "US")
        assert result is not None
        assert isinstance(result, EntityNode)
        assert result.name == "Nike"

    def test_momentum_computed_from_mock_data(self):
        """Momentum is computed using the same sigmoid formula as run_trend_analysis."""
        import pandas as pd
        import numpy as np
        import main

        # Construct data where 7d mean > 30d mean (upward trend)
        dates = pd.date_range(end="2026-03-01", periods=91, freq="D")
        values = np.linspace(40, 90, 91)  # steadily rising; 7d >> 30d
        df = pd.DataFrame({"Nike": values, "isPartial": [False] * 91}, index=dates)

        mock_pt = _make_pytrends_mock(interest_df=df)
        with patch("main._pytrends_with_retry", return_value=mock_pt):
            result = main.run_entity_trend_profile("Nike", "US")

        assert result is not None
        assert result.momentum is not None
        # Rising trend → momentum > 0.5
        assert result.momentum > 0.5

    def test_momentum_none_when_empty_dataframe(self):
        """When pytrends returns an empty DataFrame, momentum should be None."""
        import pandas as pd
        import main

        empty_df = pd.DataFrame()
        mock_pt = _make_pytrends_mock(interest_df=empty_df)
        mock_pt.interest_over_time.return_value = empty_df
        with patch("main._pytrends_with_retry", return_value=mock_pt):
            result = main.run_entity_trend_profile("Nike", "US")

        assert result is not None
        assert result.momentum is None

    def test_related_queries_populated(self):
        """Related queries from mock pytrends are populated in result."""
        import main
        mock_pt = _make_pytrends_mock(
            related_top=["air max 2025", "nike dunk", "nike sb"],
            related_rising=["nike dunk low"],
        )
        with patch("main._pytrends_with_retry", return_value=mock_pt):
            result = main.run_entity_trend_profile("Nike", "US")

        assert result is not None
        assert "air max 2025" in result.related_queries_top
        assert "nike dunk low" in result.related_queries_rising

    def test_pytrends_exception_returns_none(self):
        """If _pytrends_with_retry raises an exception, returns None gracefully."""
        import main
        with patch("main._pytrends_with_retry", side_effect=Exception("pytrends 429")):
            result = main.run_entity_trend_profile("Nike", "US")
        assert result is None


# ──────────────────────────────────────────────────────────────────
# 2. run_entity_atomization
# ──────────────────────────────────────────────────────────────────

class TestRunEntityAtomization:
    def test_empty_entities_returns_none(self):
        """Empty entity list returns None."""
        import main
        result = main.run_entity_atomization([], "US")
        assert result is None

    def test_single_entity_returns_one_node(self):
        """Single entity → EntityAtomization with exactly one node."""
        import main
        mock_node = EntityNode(name="Nike", momentum=0.6)
        with patch("main.run_entity_trend_profile", return_value=mock_node), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["Nike"], "US")

        assert result is not None
        assert isinstance(result, EntityAtomization)
        assert len(result.nodes) == 1
        assert result.nodes[0].name == "Nike"

    def test_multiple_entities_returns_multiple_nodes(self):
        """Three entities → three EntityNodes."""
        import main
        nodes = [
            EntityNode(name="Nike", momentum=0.6),
            EntityNode(name="Adidas", momentum=0.5),
            EntityNode(name="Paris", momentum=0.7),
        ]
        call_count = [0]

        def mock_profile(entity, geo):
            node = nodes[call_count[0]]
            call_count[0] += 1
            return node

        with patch("main.run_entity_trend_profile", side_effect=mock_profile), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["Nike", "Adidas", "Paris"], "US")

        assert result is not None
        assert len(result.nodes) == 3

    def test_max_five_entities_capped(self):
        """More than 5 entities → only first 5 are profiled."""
        import main
        mock_node = EntityNode(name="X", momentum=0.5)
        with patch("main.run_entity_trend_profile", return_value=mock_node) as mock_fn, \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(
                ["A", "B", "C", "D", "E", "F", "G"], "US"
            )

        assert mock_fn.call_count == 5

    def test_all_nodes_fail_returns_none(self):
        """If all entity profiles return None, returns None."""
        import main
        with patch("main.run_entity_trend_profile", return_value=None), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["A", "B"], "US")
        assert result is None

    def test_partial_failure_skips_failed_nodes(self):
        """If one entity profile fails (None), others still returned."""
        import main
        nodes = [EntityNode(name="Nike", momentum=0.6), None, EntityNode(name="Paris", momentum=0.7)]
        call_count = [0]

        def mock_profile(entity, geo):
            node = nodes[call_count[0]]
            call_count[0] += 1
            return node

        with patch("main.run_entity_trend_profile", side_effect=mock_profile), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["Nike", "Adidas", "Paris"], "US")

        assert result is not None
        assert len(result.nodes) == 2


# ──────────────────────────────────────────────────────────────────
# 3. Aggregate momentum computation
# ──────────────────────────────────────────────────────────────────

class TestAggregatesMomentum:
    def test_aggregate_momentum_is_median(self):
        """aggregate_momentum is the median of node momenta, not the mean."""
        import main
        nodes = [
            EntityNode(name="A", momentum=0.3),
            EntityNode(name="B", momentum=0.7),
            EntityNode(name="C", momentum=0.5),
        ]
        call_count = [0]

        def mock_profile(entity, geo):
            node = nodes[call_count[0]]
            call_count[0] += 1
            return node

        with patch("main.run_entity_trend_profile", side_effect=mock_profile), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["A", "B", "C"], "US")

        assert result is not None
        assert result.aggregate_momentum == pytest.approx(0.5)

    def test_aggregate_momentum_odd_count(self):
        """Median of [0.1, 0.5, 0.9] = 0.5."""
        import main
        nodes = [
            EntityNode(name="A", momentum=0.1),
            EntityNode(name="B", momentum=0.9),
            EntityNode(name="C", momentum=0.5),
        ]
        call_count = [0]

        def mock_profile(entity, geo):
            node = nodes[call_count[0]]
            call_count[0] += 1
            return node

        with patch("main.run_entity_trend_profile", side_effect=mock_profile), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["A", "B", "C"], "US")

        assert result is not None
        assert result.aggregate_momentum == pytest.approx(0.5)

    def test_aggregate_momentum_none_when_all_none(self):
        """aggregate_momentum=None when all nodes have momentum=None."""
        import main
        nodes = [EntityNode(name="A", momentum=None), EntityNode(name="B", momentum=None)]
        call_count = [0]

        def mock_profile(entity, geo):
            node = nodes[call_count[0]]
            call_count[0] += 1
            return node

        with patch("main.run_entity_trend_profile", side_effect=mock_profile), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["A", "B"], "US")

        assert result is not None
        assert result.aggregate_momentum is None

    def test_aggregate_ignores_none_momenta(self):
        """aggregate_momentum is computed from non-None momenta only."""
        import main
        nodes = [
            EntityNode(name="A", momentum=0.4),
            EntityNode(name="B", momentum=None),
            EntityNode(name="C", momentum=0.8),
        ]
        call_count = [0]

        def mock_profile(entity, geo):
            node = nodes[call_count[0]]
            call_count[0] += 1
            return node

        with patch("main.run_entity_trend_profile", side_effect=mock_profile), \
             patch("main.time.sleep"):
            result = main.run_entity_atomization(["A", "B", "C"], "US")

        assert result is not None
        # median([0.4, 0.8]) = 0.6
        assert result.aggregate_momentum == pytest.approx(0.6)


# ──────────────────────────────────────────────────────────────────
# 4. Throttle / sleep timing
# ──────────────────────────────────────────────────────────────────

class TestSleepThrottling:
    def test_sleep_called_between_entities(self):
        """time.sleep(2) is called N-1 times for N entities."""
        import main
        mock_node = EntityNode(name="X", momentum=0.5)

        with patch("main.run_entity_trend_profile", return_value=mock_node), \
             patch("main.time.sleep") as mock_sleep:
            main.run_entity_atomization(["A", "B", "C"], "US")

        assert mock_sleep.call_count == 2
        mock_sleep.assert_called_with(2)

    def test_no_sleep_for_single_entity(self):
        """time.sleep is NOT called when there is only one entity."""
        import main
        mock_node = EntityNode(name="Nike", momentum=0.5)

        with patch("main.run_entity_trend_profile", return_value=mock_node), \
             patch("main.time.sleep") as mock_sleep:
            main.run_entity_atomization(["Nike"], "US")

        mock_sleep.assert_not_called()


# ──────────────────────────────────────────────────────────────────
# 5. Backward compatibility
# ──────────────────────────────────────────────────────────────────

class TestModelBackwardCompat:
    def test_quant_metrics_without_entity_atomization(self):
        """QuantitativeMetrics is valid without entity_atomization (defaults to None)."""
        from pydantic import ValidationError
        from models import (
            QuantitativeMetrics, TextAnalysis, VisionAnalysis, SEMMetrics,
            SentimentBreakdown,
        )
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(
                extracted_entities=[], sentiment_score=0.5,
                suggested_tags=[], sentiment_breakdown=SentimentBreakdown(
                    positive=0.5, neutral=0.3, negative=0.2
                ),
            ),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
        )
        assert qm.entity_atomization is None
