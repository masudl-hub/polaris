"""
Tests for Pydantic models — validate that every model accepts valid data,
rejects invalid data, and handles edge cases correctly.
"""
import pytest
from models import (
    PipelineStep, SentimentBreakdown, TextAnalysis, VisionAnalysis,
    SEMMetrics, TrendAnalysis, IndustryBenchmark, LandingPageCoherence,
    RedditSentiment, CreativeAlignment, LinkedInPostAnalysis,
    AudienceAnalysis, CompetitorIntel, QuantitativeMetrics, EvaluationResponse,
    ErrorResponse,
)
from pydantic import ValidationError


# ──────────────────────────────────────────────────────────────────
# PipelineStep
# ──────────────────────────────────────────────────────────────────

class TestPipelineStep:
    def test_valid_construction(self):
        step = PipelineStep(
            step=1, name="Visual Analysis", model="Gemini 3 Flash",
            input_summary="File: test.jpg", output_summary="Tags: [shoe, person]",
            duration_ms=1200, status="ok",
        )
        assert step.step == 1
        assert step.name == "Visual Analysis"
        assert step.duration_ms == 1200
        assert step.note is None

    def test_with_error_note(self):
        step = PipelineStep(
            step=2, name="NER", model="spaCy",
            input_summary="text", output_summary="(failed)",
            duration_ms=50, status="error", note="spaCy model not loaded",
        )
        assert step.status == "error"
        assert "spaCy" in step.note

    def test_missing_required_field(self):
        with pytest.raises(ValidationError):
            PipelineStep(step=1, name="test")  # missing model, input_summary, etc.


# ──────────────────────────────────────────────────────────────────
# SentimentBreakdown
# ──────────────────────────────────────────────────────────────────

class TestSentimentBreakdown:
    def test_valid(self):
        sb = SentimentBreakdown(positive=0.7, neutral=0.2, negative=0.1)
        assert sb.positive == 0.7

    def test_all_zero(self):
        sb = SentimentBreakdown(positive=0.0, neutral=0.0, negative=0.0)
        assert sb.positive == 0.0


# ──────────────────────────────────────────────────────────────────
# TextAnalysis
# ──────────────────────────────────────────────────────────────────

class TestTextAnalysis:
    def test_valid(self, sample_text_analysis_data):
        ta = TextAnalysis(**sample_text_analysis_data)
        assert len(ta.extracted_entities) == 3
        assert ta.sentiment_score == 0.72
        assert len(ta.suggested_tags) == 3

    def test_sentiment_out_of_range(self):
        with pytest.raises(ValidationError):
            TextAnalysis(
                extracted_entities=["test"],
                sentiment_score=1.5,  # > 1.0
                suggested_tags=["#tag"],
            )

    def test_no_sentiment(self):
        ta = TextAnalysis(
            extracted_entities=["entity"],
            sentiment_score=None,
            sentiment_breakdown=None,
            suggested_tags=["#tag"],
        )
        assert ta.sentiment_score is None

    def test_empty_entities_and_tags(self):
        ta = TextAnalysis(
            extracted_entities=[],
            suggested_tags=[],
        )
        assert ta.extracted_entities == []


# ──────────────────────────────────────────────────────────────────
# VisionAnalysis
# ──────────────────────────────────────────────────────────────────

class TestVisionAnalysis:
    def test_valid(self, sample_vision_analysis_data):
        va = VisionAnalysis(**sample_vision_analysis_data)
        assert va.brand_detected == "Nike"
        assert va.platform_fit_score == 8.0

    def test_minimal(self):
        va = VisionAnalysis(visual_tags=["object"], is_cluttered=False)
        assert va.extracted_text is None
        assert va.platform_fit_score is None

    def test_platform_fit_score_bounds(self):
        with pytest.raises(ValidationError):
            VisionAnalysis(visual_tags=["tag"], is_cluttered=False, platform_fit_score=0.5)  # < 1.0

        with pytest.raises(ValidationError):
            VisionAnalysis(visual_tags=["tag"], is_cluttered=False, platform_fit_score=11.0)  # > 10.0


# ──────────────────────────────────────────────────────────────────
# SEMMetrics
# ──────────────────────────────────────────────────────────────────

class TestSEMMetrics:
    def test_valid(self, sample_sem_metrics_data):
        sem = SEMMetrics(**sample_sem_metrics_data)
        assert sem.quality_score == 7.5
        assert sem.daily_clicks == 105

    def test_quality_score_bounds(self):
        with pytest.raises(ValidationError):
            SEMMetrics(quality_score=0.5, effective_cpc=1.0, daily_clicks=10)  # < 1.0

        with pytest.raises(ValidationError):
            SEMMetrics(quality_score=11.0, effective_cpc=1.0, daily_clicks=10)  # > 10.0


# ──────────────────────────────────────────────────────────────────
# TrendAnalysis
# ──────────────────────────────────────────────────────────────────

class TestTrendAnalysis:
    def test_valid(self, sample_trend_analysis_data):
        ta = TrendAnalysis(**sample_trend_analysis_data)
        assert ta.momentum == 0.65
        assert len(ta.related_queries_top) == 2
        assert len(ta.top_regions) == 2
        assert len(ta.time_series) == 91

    def test_empty_defaults(self):
        ta = TrendAnalysis()
        assert ta.momentum is None
        assert ta.related_queries_top == []
        assert ta.related_queries_rising == []
        assert ta.data_points == 0


# ──────────────────────────────────────────────────────────────────
# IndustryBenchmark
# ──────────────────────────────────────────────────────────────────

class TestIndustryBenchmark:
    def test_valid(self):
        ib = IndustryBenchmark(
            industry="e-commerce", platform="Meta",
            avg_cpc=1.72, avg_ctr=0.9, avg_cvr=2.8, avg_cpa=45.0,
            user_ecpc=1.50, cpc_delta_pct=-12.8, verdict="average",
        )
        assert ib.verdict == "average"

    def test_no_comparison(self):
        ib = IndustryBenchmark(
            industry="tech", platform="Google",
            avg_cpc=2.50, avg_ctr=1.2, avg_cvr=1.5, avg_cpa=60.0,
        )
        assert ib.user_ecpc is None
        assert ib.verdict is None


# ──────────────────────────────────────────────────────────────────
# LandingPageCoherence
# ──────────────────────────────────────────────────────────────────

class TestLandingPageCoherence:
    def test_valid(self):
        lpc = LandingPageCoherence(
            url="https://example.com", coherence_score=0.85,
            matched_entities=["Nike", "shoes"], missing_entities=["Portland"],
            sentiment_alignment=0.9, headline_found=True, issues=[],
        )
        assert lpc.coherence_score == 0.85
        assert lpc.headline_found is True

    def test_failed_fetch(self):
        lpc = LandingPageCoherence(
            url="https://broken.com", coherence_score=0.0,
            issues=["Failed to fetch: timeout"],
        )
        assert lpc.coherence_score == 0.0
        assert len(lpc.issues) == 1


# ──────────────────────────────────────────────────────────────────
# RedditSentiment
# ──────────────────────────────────────────────────────────────────

class TestRedditSentiment:
    def test_valid(self):
        rs = RedditSentiment(
            query="Nike shoes", post_count=25,
            avg_sentiment=0.65,
            themes=["running", "fitness"],
            top_subreddits=["running", "fitness"],
        )
        assert rs.post_count == 25

    def test_no_results(self):
        rs = RedditSentiment(query="obscure term", post_count=0)
        assert rs.avg_sentiment is None
        assert rs.themes == []


# ──────────────────────────────────────────────────────────────────
# CreativeAlignment
# ──────────────────────────────────────────────────────────────────

class TestCreativeAlignment:
    def test_valid(self):
        ca = CreativeAlignment(
            alignment_score=0.6,
            matched_trends=["running shoes", "marathon"],
            gap_trends=["trail running"],
            creative_angles=["Incorporate 'trail running'"],
        )
        assert ca.alignment_score == 0.6

    def test_no_matches(self):
        ca = CreativeAlignment(alignment_score=0.0, gap_trends=["everything missed"])
        assert ca.matched_trends == []


# ──────────────────────────────────────────────────────────────────
# AudienceAnalysis
# ──────────────────────────────────────────────────────────────────

class TestAudienceAnalysis:
    def test_valid(self):
        aa = AudienceAnalysis(
            selected_tag="Gen-Z (18-24)",
            alignment_score=0.85,
            top_audiences=[
                {"tag": "Gen-Z (18-24)", "score": 0.85},
                {"tag": "Tech Enthusiasts", "score": 0.72},
            ],
        )
        assert aa.alignment_score == 0.85

    def test_score_bounds(self):
        with pytest.raises(ValidationError):
            AudienceAnalysis(selected_tag="test", alignment_score=1.5, top_audiences=[])


# ──────────────────────────────────────────────────────────────────
# LinkedInPostAnalysis
# ──────────────────────────────────────────────────────────────────

class TestLinkedInPostAnalysis:
    def test_valid(self):
        li = LinkedInPostAnalysis(
            quality_score=75,
            quality_breakdown={"hooks": 8, "readability": 9},
            suggestions=["Add more hashtags"],
            predicted_impressions=5000,
            predicted_reactions=250,
            predicted_comments=30,
            predicted_shares=15,
            predicted_engagement_rate=0.059,
            impression_range={"low": 3000, "high": 7000},
        )
        assert li.quality_score == 75

    def test_score_bounds(self):
        with pytest.raises(ValidationError):
            LinkedInPostAnalysis(
                quality_score=101,  # > 100
                quality_breakdown={}, suggestions=[],
                predicted_impressions=0, predicted_reactions=0,
                predicted_comments=0, predicted_shares=0,
                predicted_engagement_rate=0.0,
                impression_range={"low": 0, "high": 0},
            )


# ──────────────────────────────────────────────────────────────────
# CompetitorIntel
# ──────────────────────────────────────────────────────────────────

class TestCompetitorIntel:
    def test_valid(self):
        ci = CompetitorIntel(
            brand="Nike", ad_count=42,
            avg_longevity_days=28.5,
            format_breakdown={"text": 10, "link": 25, "other": 7},
        )
        assert ci.ad_count == 42

    def test_skipped(self):
        ci = CompetitorIntel(brand="Nike", status="skipped", note="No API token")
        assert ci.ad_count == 0


# ──────────────────────────────────────────────────────────────────
# QuantitativeMetrics (composite)
# ──────────────────────────────────────────────────────────────────

class TestQuantitativeMetrics:
    def test_minimal(self):
        """QuantitativeMetrics with only required fields (text + vision + sem)."""
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(extracted_entities=["test"], suggested_tags=["#tag"]),
            vision_data=VisionAnalysis(visual_tags=["object"], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.50, daily_clicks=66),
        )
        assert qm.trend_data is None
        assert qm.landing_page is None
        assert qm.reddit_sentiment is None

    def test_full(self, sample_text_analysis_data, sample_vision_analysis_data, sample_sem_metrics_data, sample_trend_analysis_data):
        """QuantitativeMetrics with all optional fields populated."""
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(**sample_text_analysis_data),
            vision_data=VisionAnalysis(**sample_vision_analysis_data),
            sem_metrics=SEMMetrics(**sample_sem_metrics_data),
            trend_data=TrendAnalysis(**sample_trend_analysis_data),
        )
        assert qm.trend_data.momentum == 0.65


# ──────────────────────────────────────────────────────────────────
# EvaluationResponse
# ──────────────────────────────────────────────────────────────────

class TestEvaluationResponse:
    def test_valid(self):
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(extracted_entities=["test"], suggested_tags=["#tag"]),
            vision_data=VisionAnalysis(visual_tags=["object"], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.50, daily_clicks=66),
        )
        resp = EvaluationResponse(
            quantitative_metrics=qm,
            executive_diagnostic="Your ad scored well.",
            pipeline_trace=[
                PipelineStep(
                    step=1, name="Test", model="test",
                    input_summary="in", output_summary="out",
                    duration_ms=100,
                ),
            ],
        )
        assert resp.status == "success"


# ──────────────────────────────────────────────────────────────────
# ErrorResponse
# ──────────────────────────────────────────────────────────────────

class TestErrorResponse:
    def test_valid(self):
        er = ErrorResponse(detail="Something went wrong")
        assert er.status == "error"
        assert er.detail == "Something went wrong"
