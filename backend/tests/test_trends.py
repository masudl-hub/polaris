"""
Tests for Trend Analysis pipeline — Google Trends integration,
momentum calculation, and related queries.
pytrends is always mocked (no real Google calls).
"""
import pytest
import math
import os
import sys
from unittest.mock import MagicMock, patch
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ──────────────────────────────────────────────────────────────────
# Trend Analysis
# ──────────────────────────────────────────────────────────────────

class TestRunTrendAnalysis:
    def test_returns_trend_analysis_with_momentum(self, mock_pytrends):
        """Valid entities + mocked pytrends → TrendAnalysis with momentum."""
        import main
        with patch("main._pytrends_with_retry", return_value=mock_pytrends):
            result = main.run_trend_analysis(["technology", "AI"], "US")

        assert result is not None
        assert result.momentum is not None
        assert 0.0 <= result.momentum <= 1.0
        assert result.data_points == 91
        assert len(result.keywords_searched) == 2

    def test_returns_related_queries(self, mock_pytrends):
        """Should extract top and rising related queries."""
        import main
        with patch("main._pytrends_with_retry", return_value=mock_pytrends):
            result = main.run_trend_analysis(["technology"], "US")

        assert len(result.related_queries_top) > 0
        assert len(result.related_queries_rising) > 0

    def test_returns_top_regions(self, mock_pytrends):
        """Should extract top regions with interest scores."""
        import main
        with patch("main._pytrends_with_retry", return_value=mock_pytrends):
            result = main.run_trend_analysis(["technology"], "US")

        assert len(result.top_regions) > 0
        for region in result.top_regions:
            assert "name" in region
            assert "interest" in region

    def test_returns_time_series(self, mock_pytrends):
        """Should return time series data for sparkline rendering."""
        import main
        with patch("main._pytrends_with_retry", return_value=mock_pytrends):
            result = main.run_trend_analysis(["technology"], "US")

        assert len(result.time_series) > 0
        for val in result.time_series:
            assert isinstance(val, float)

    def test_empty_entities_returns_none(self):
        """No entities → None."""
        import main
        result = main.run_trend_analysis([], "US")
        assert result is None

    def test_max_5_keywords(self, mock_pytrends):
        """Should only send first 5 entities to pytrends."""
        import main
        entities = ["a", "b", "c", "d", "e", "f", "g"]
        with patch("main._pytrends_with_retry", return_value=mock_pytrends):
            result = main.run_trend_analysis(entities, "US")

        assert len(result.keywords_searched) == 5

    def test_pytrends_failure_returns_none(self):
        """When pytrends raises, should return None (not crash)."""
        import main
        with patch("main._pytrends_with_retry", side_effect=Exception("429 Too Many Requests")):
            result = main.run_trend_analysis(["technology"], "US")
        assert result is None

    def test_empty_dataframe_no_momentum(self):
        """When pytrends returns empty DataFrame, momentum should be None."""
        import main
        mock = MagicMock()
        mock.interest_over_time.return_value = pd.DataFrame()
        mock.related_queries.return_value = {}
        mock.interest_by_region.return_value = pd.DataFrame()

        with patch("main._pytrends_with_retry", return_value=mock):
            result = main.run_trend_analysis(["obscure_term"], "US")

        assert result is not None
        assert result.momentum is None
        assert result.data_points == 0


# ──────────────────────────────────────────────────────────────────
# Momentum Calculation
# ──────────────────────────────────────────────────────────────────

class TestMomentumCalculation:
    """Verify the sigmoid momentum mapping: 7d/30d ratio → 0-1 score."""

    def test_flat_trend_around_05(self):
        """When 7d avg ≈ 30d avg (ratio ≈ 1.0), momentum should be ~0.5."""
        raw_ratio = 1.0
        momentum = 1.0 / (1.0 + math.exp(-3.0 * (raw_ratio - 1.0)))
        assert abs(momentum - 0.5) < 0.01

    def test_growing_trend_above_05(self):
        """When 7d > 30d (ratio > 1.0), momentum should be > 0.5."""
        raw_ratio = 1.5  # 50% growth
        momentum = 1.0 / (1.0 + math.exp(-3.0 * (raw_ratio - 1.0)))
        assert momentum > 0.7

    def test_declining_trend_below_05(self):
        """When 7d < 30d (ratio < 1.0), momentum should be < 0.5."""
        raw_ratio = 0.5  # 50% decline
        momentum = 1.0 / (1.0 + math.exp(-3.0 * (raw_ratio - 1.0)))
        assert momentum < 0.3

    def test_doubling_trend_near_1(self):
        """When trend doubles (ratio = 2.0), momentum should be near 1.0."""
        raw_ratio = 2.0
        momentum = 1.0 / (1.0 + math.exp(-3.0 * (raw_ratio - 1.0)))
        assert momentum > 0.9

    def test_near_zero_interest_near_0(self):
        """When interest drops to near zero (ratio → 0), momentum should be near 0."""
        raw_ratio = 0.1
        momentum = 1.0 / (1.0 + math.exp(-3.0 * (raw_ratio - 1.0)))
        assert momentum < 0.1


# ──────────────────────────────────────────────────────────────────
# SEM Cost Engine
# ──────────────────────────────────────────────────────────────────

class TestCalculateSEMMetrics:
    def test_all_signals_present(self):
        """With all 3 signals, should produce valid QS, eCPC, daily clicks."""
        import main
        result = main.calculate_sem_metrics(
            sentiment_score=0.8,
            trend_momentum=0.7,
            visual_authenticity=0.9,
            base_cpc=1.50,
            daily_budget=100.0,
            platform="Meta",
            geo="US",
        )
        assert 1.0 <= result.quality_score <= 10.0
        assert result.effective_cpc > 0
        assert result.daily_clicks >= 1

    def test_no_signals_minimum_qs(self):
        """With no signals (all None), QS should be minimum (1.0)."""
        import main
        result = main.calculate_sem_metrics(
            sentiment_score=None,
            trend_momentum=None,
            visual_authenticity=None,
            base_cpc=1.50,
            daily_budget=100.0,
        )
        assert result.quality_score == 1.0

    def test_higher_qs_lower_cpc(self):
        """Higher quality score should produce lower effective CPC."""
        import main
        high_qs = main.calculate_sem_metrics(0.9, 0.9, 0.9, 1.50, 100.0)
        low_qs = main.calculate_sem_metrics(0.1, 0.1, 0.1, 1.50, 100.0)
        assert high_qs.effective_cpc < low_qs.effective_cpc

    def test_platform_multiplier(self):
        """LinkedIn (2.4x) should produce higher CPC than TikTok (0.7x)."""
        import main
        linkedin = main.calculate_sem_metrics(0.5, 0.5, 0.5, 1.50, 100.0, platform="LinkedIn")
        tiktok = main.calculate_sem_metrics(0.5, 0.5, 0.5, 1.50, 100.0, platform="TikTok")
        assert linkedin.effective_cpc > tiktok.effective_cpc

    def test_geo_competition(self):
        """US (1.0) should produce higher CPC than IN (0.40)."""
        import main
        us = main.calculate_sem_metrics(0.5, 0.5, 0.5, 1.50, 100.0, geo="US")
        india = main.calculate_sem_metrics(0.5, 0.5, 0.5, 1.50, 100.0, geo="IN")
        assert us.effective_cpc > india.effective_cpc

    def test_partial_signals(self):
        """With only sentiment (no trend/visual), should still compute valid QS."""
        import main
        result = main.calculate_sem_metrics(
            sentiment_score=0.7,
            trend_momentum=None,
            visual_authenticity=None,
            base_cpc=1.50,
            daily_budget=100.0,
        )
        assert 1.0 <= result.quality_score <= 10.0
        assert result.daily_clicks >= 1

    def test_daily_clicks_minimum_1(self):
        """Daily clicks should never go below 1, even with terrible QS."""
        import main
        result = main.calculate_sem_metrics(0.01, 0.01, 0.01, 50.0, 1.0)
        assert result.daily_clicks >= 1


# ──────────────────────────────────────────────────────────────────
# Industry Benchmarks
# ──────────────────────────────────────────────────────────────────

class TestIndustryBenchmarks:
    def test_valid_industry_platform(self):
        """Known industry + platform should return benchmark data."""
        import main
        result = main.run_industry_benchmark("e-commerce", "Meta")
        if result:  # depends on benchmarks.json having this data
            assert result.industry == "e-commerce"
            assert result.avg_cpc > 0

    def test_unknown_industry_returns_none(self):
        """Unknown industry should return None."""
        import main
        result = main.run_industry_benchmark("underwater_basket_weaving", "Meta")
        assert result is None

    def test_empty_industry_returns_none(self):
        import main
        result = main.run_industry_benchmark("", "Meta")
        assert result is None

    def test_verdict_calculation(self):
        """User eCPC much lower than avg → above_average verdict."""
        import main
        result = main.run_industry_benchmark("e-commerce", "Meta", user_ecpc=0.50)
        if result and result.avg_cpc > 0.50:
            assert result.verdict == "above_average"


# ──────────────────────────────────────────────────────────────────
# Creative Alignment
# ──────────────────────────────────────────────────────────────────

class TestCreativeAlignment:
    @pytest.fixture(autouse=True)
    def load_w2v(self):
        """Ensure word2vec model is loaded."""
        import main
        import gensim.downloader as gensim_api
        if main.word2vec_model is None:
            main.word2vec_model = gensim_api.load("glove-twitter-50")
        yield

    def test_alignment_with_matching_terms(self):
        """Ad text closely related to trending queries → high alignment."""
        from models import TrendAnalysis
        import main

        trend = TrendAnalysis(
            momentum=0.7,
            related_queries_top=["running shoes", "marathon training"],
            related_queries_rising=["trail running"],
            keywords_searched=["running"],
        )
        result = main.run_creative_alignment(
            trend, "Get the best running shoes for your marathon", ["running", "shoes"],
        )
        assert result is not None
        assert result.alignment_score > 0

    def test_no_trend_data_returns_none(self):
        import main
        result = main.run_creative_alignment(None, "some ad text", ["entity"])
        assert result is None

    def test_no_trending_queries_returns_none(self):
        from models import TrendAnalysis
        import main

        trend = TrendAnalysis(momentum=0.5)  # No related queries
        result = main.run_creative_alignment(trend, "ad text", ["entity"])
        assert result is None
