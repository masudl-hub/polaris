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
    ErrorResponse, SongIdentification, AudioDescription,
    EntityNode, EntityAtomization, EntityCulturalContext, CulturalContext,
    SignalNode, SignalEdge, ResonanceGraph, CompositeAdSentiment,
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


# ──────────────────────────────────────────────────────────────────
# SongIdentification (Phase 2)
# ──────────────────────────────────────────────────────────────────

class TestSongIdentification:
    def test_minimal_construction(self):
        song = SongIdentification(title="Bad Guy", artist="Billie Eilish")
        assert song.title == "Bad Guy"
        assert song.artist == "Billie Eilish"
        assert song.album is None
        assert song.trend_momentum is None

    def test_full_construction(self):
        song = SongIdentification(
            title="Blinding Lights",
            artist="The Weeknd",
            album="After Hours",
            release_date="2019-11-29",
            match_timecode="00:00:05",
            song_link="https://open.spotify.com/track/abc",
            trend_momentum=0.85,
        )
        assert song.album == "After Hours"
        assert song.release_date == "2019-11-29"
        assert song.match_timecode == "00:00:05"
        assert song.song_link == "https://open.spotify.com/track/abc"
        assert song.trend_momentum == pytest.approx(0.85)

    def test_momentum_lower_bound(self):
        song = SongIdentification(title="T", artist="A", trend_momentum=0.0)
        assert song.trend_momentum == pytest.approx(0.0)

    def test_momentum_upper_bound(self):
        song = SongIdentification(title="T", artist="A", trend_momentum=1.0)
        assert song.trend_momentum == pytest.approx(1.0)

    def test_momentum_above_one_rejected(self):
        with pytest.raises(ValidationError):
            SongIdentification(title="T", artist="A", trend_momentum=1.1)

    def test_momentum_below_zero_rejected(self):
        with pytest.raises(ValidationError):
            SongIdentification(title="T", artist="A", trend_momentum=-0.01)

    def test_missing_title_rejected(self):
        with pytest.raises(ValidationError):
            SongIdentification(artist="Artist")

    def test_missing_artist_rejected(self):
        with pytest.raises(ValidationError):
            SongIdentification(title="Song")


# ──────────────────────────────────────────────────────────────────
# AudioDescription — song_id extension (Phase 2)
# ──────────────────────────────────────────────────────────────────

class TestAudioDescriptionSongId:
    def test_song_id_defaults_none(self):
        ad = AudioDescription(has_audio=False, description=None)
        assert ad.song_id is None

    def test_song_id_accepts_instance(self):
        song = SongIdentification(title="Track", artist="Band", trend_momentum=0.4)
        ad = AudioDescription(has_audio=True, description="Background track", song_id=song)
        assert ad.song_id is not None
        assert ad.song_id.title == "Track"
        assert ad.song_id.trend_momentum == pytest.approx(0.4)

    def test_song_id_serializes_to_dict(self):
        song = SongIdentification(title="T", artist="A")
        ad = AudioDescription(has_audio=True, description="desc", song_id=song)
        d = ad.model_dump()
        assert d["song_id"]["title"] == "T"
        assert d["song_id"]["trend_momentum"] is None


# ──────────────────────────────────────────────────────────────────
# Phase 3: EntityNode + EntityAtomization models
# ──────────────────────────────────────────────────────────────────

class TestEntityAtomizationModels:
    def test_entity_node_all_fields(self):
        """EntityNode accepts all fields with valid data."""
        node = EntityNode(
            name="Nike",
            momentum=0.75,
            related_queries_top=["air max", "dunk"],
            related_queries_rising=["breakout"],
            top_regions=[{"name": "United States", "interest": 90}],
            time_series=[50.0, 55.0, 60.0],
        )
        assert node.name == "Nike"
        assert node.momentum == pytest.approx(0.75)
        assert node.related_queries_top == ["air max", "dunk"]
        assert node.related_queries_rising == ["breakout"]
        assert node.top_regions == [{"name": "United States", "interest": 90}]
        assert node.time_series == [50.0, 55.0, 60.0]

    def test_entity_node_defaults(self):
        """EntityNode with only name field uses correct defaults."""
        node = EntityNode(name="Nike")
        assert node.momentum is None
        assert node.related_queries_top == []
        assert node.related_queries_rising == []
        assert node.top_regions == []
        assert node.time_series == []

    def test_entity_node_momentum_ge_0(self):
        """momentum < 0 raises ValidationError."""
        with pytest.raises(ValidationError):
            EntityNode(name="Nike", momentum=-0.1)

    def test_entity_node_momentum_le_1(self):
        """momentum > 1 raises ValidationError."""
        with pytest.raises(ValidationError):
            EntityNode(name="Nike", momentum=1.1)

    def test_entity_atomization_construction(self):
        """EntityAtomization accepts a list of EntityNode objects."""
        nodes = [
            EntityNode(name="Nike", momentum=0.6),
            EntityNode(name="Adidas", momentum=0.5),
            EntityNode(name="Paris", momentum=0.7),
        ]
        ea = EntityAtomization(nodes=nodes, aggregate_momentum=0.6)
        assert len(ea.nodes) == 3
        assert ea.aggregate_momentum == pytest.approx(0.6)

    def test_entity_atomization_empty_nodes(self):
        """EntityAtomization with an empty nodes list is valid."""
        ea = EntityAtomization(nodes=[])
        assert ea.nodes == []

    def test_entity_atomization_aggregate_none(self):
        """aggregate_momentum=None is valid."""
        ea = EntityAtomization(nodes=[], aggregate_momentum=None)
        assert ea.aggregate_momentum is None

    def test_entity_atomization_aggregate_range(self):
        """aggregate_momentum=0.5 is within valid [0, 1] range."""
        ea = EntityAtomization(nodes=[], aggregate_momentum=0.5)
        assert ea.aggregate_momentum == pytest.approx(0.5)

    def test_quant_metrics_accepts_entity_atomization(self):
        """QuantitativeMetrics properly stores entity_atomization."""
        node = EntityNode(name="Nike", momentum=0.7)
        ea = EntityAtomization(nodes=[node], aggregate_momentum=0.7)
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(
                extracted_entities=[], sentiment_score=0.5,
                suggested_tags=[],
                sentiment_breakdown=SentimentBreakdown(
                    positive=0.5, neutral=0.3, negative=0.2
                ),
            ),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
            entity_atomization=ea,
        )
        assert qm.entity_atomization is not None
        assert len(qm.entity_atomization.nodes) == 1
        assert qm.entity_atomization.nodes[0].name == "Nike"

    def test_quant_metrics_entity_atomization_defaults_none(self):
        """QuantitativeMetrics without entity_atomization defaults to None."""
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(
                extracted_entities=[], sentiment_score=0.5,
                suggested_tags=[],
                sentiment_breakdown=SentimentBreakdown(
                    positive=0.5, neutral=0.3, negative=0.2
                ),
            ),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
        )
        assert qm.entity_atomization is None


# ──────────────────────────────────────────────────────────────────
# Phase 4: EntityCulturalContext + CulturalContext models
# ──────────────────────────────────────────────────────────────────

class TestCulturalContextModels:
    def _minimal_text(self):
        return TextAnalysis(
            extracted_entities=[], sentiment_score=0.5, suggested_tags=[],
            sentiment_breakdown=SentimentBreakdown(positive=0.5, neutral=0.3, negative=0.2),
        )

    def test_entity_cultural_context_all_fields(self):
        """Full valid EntityCulturalContext construction."""
        ctx = EntityCulturalContext(
            entity_name="Nike",
            cultural_sentiment="positive",
            trending_direction="ascending",
            narrative_summary="Nike is culturally thriving right now.",
            advertising_risk="low",
            advertising_risk_reason="No active controversies.",
            cultural_moments=["Paris Olympics", "sustainability push"],
            adjacent_topics=["streetwear", "Gen-Z"],
        )
        assert ctx.entity_name == "Nike"
        assert ctx.cultural_sentiment == "positive"
        assert ctx.advertising_risk == "low"
        assert len(ctx.cultural_moments) == 2

    def test_entity_cultural_context_optional_fields(self):
        """advertising_risk_reason=None is valid."""
        ctx = EntityCulturalContext(
            entity_name="Adidas",
            cultural_sentiment="neutral",
            trending_direction="stable",
            narrative_summary="Adidas is holding steady.",
            advertising_risk="medium",
            advertising_risk_reason=None,
        )
        assert ctx.advertising_risk_reason is None

    def test_entity_cultural_context_empty_lists(self):
        """cultural_moments=[] and adjacent_topics=[] are valid (default)."""
        ctx = EntityCulturalContext(
            entity_name="Paris",
            cultural_sentiment="mixed",
            trending_direction="descending",
            narrative_summary="Mixed signals.",
            advertising_risk="high",
        )
        assert ctx.cultural_moments == []
        assert ctx.adjacent_topics == []

    def test_cultural_context_construction(self):
        """Valid CulturalContext with 3 entity contexts."""
        contexts = [
            EntityCulturalContext(
                entity_name=name, cultural_sentiment="positive",
                trending_direction="ascending", narrative_summary="Test.",
                advertising_risk="low",
            )
            for name in ["Nike", "Adidas", "Paris"]
        ]
        cc = CulturalContext(entity_contexts=contexts, overall_advertising_risk="low")
        assert len(cc.entity_contexts) == 3
        assert cc.overall_advertising_risk == "low"

    def test_cultural_context_overall_risk_values(self):
        """overall_advertising_risk accepts 'low', 'medium', 'high'."""
        for risk in ["low", "medium", "high"]:
            cc = CulturalContext(entity_contexts=[], overall_advertising_risk=risk)
            assert cc.overall_advertising_risk == risk

    def test_cultural_context_single_entity(self):
        """CulturalContext with one entity context is valid."""
        ctx = EntityCulturalContext(
            entity_name="Nike", cultural_sentiment="positive",
            trending_direction="viral", narrative_summary="Going viral.",
            advertising_risk="low",
        )
        cc = CulturalContext(entity_contexts=[ctx], overall_advertising_risk="low")
        assert len(cc.entity_contexts) == 1

    def test_cultural_context_empty_contexts(self):
        """CulturalContext with empty entity_contexts list is valid."""
        cc = CulturalContext(entity_contexts=[], overall_advertising_risk="low")
        assert cc.entity_contexts == []

    def test_quant_metrics_accepts_cultural_context(self):
        """QuantitativeMetrics properly stores cultural_context."""
        ctx = EntityCulturalContext(
            entity_name="Nike", cultural_sentiment="positive",
            trending_direction="ascending", narrative_summary="Thriving.",
            advertising_risk="low",
        )
        cc = CulturalContext(entity_contexts=[ctx], overall_advertising_risk="low")
        qm = QuantitativeMetrics(
            text_data=self._minimal_text(),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
            cultural_context=cc,
        )
        assert qm.cultural_context is not None
        assert qm.cultural_context.entity_contexts[0].entity_name == "Nike"

    def test_quant_metrics_cultural_context_defaults_none(self):
        """QuantitativeMetrics without cultural_context → None."""
        qm = QuantitativeMetrics(
            text_data=self._minimal_text(),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
        )
        assert qm.cultural_context is None

    def test_evaluation_response_unchanged(self):
        """EvaluationResponse still constructs without cultural_context changes."""
        from models import EvaluationResponse, PipelineStep
        qm = QuantitativeMetrics(
            text_data=self._minimal_text(),
            vision_data=VisionAnalysis(visual_tags=[], is_cluttered=False),
            sem_metrics=SEMMetrics(quality_score=5.0, effective_cpc=1.5, daily_clicks=10),
        )
        er = EvaluationResponse(
            quantitative_metrics=qm,
            executive_diagnostic="Test diagnostic.",
            pipeline_trace=[],
        )
        assert er.status == "success"


# ──────────────────────────────────────────────────────────────────
# Phase 5: ResonanceGraph model tests
# ──────────────────────────────────────────────────────────────────

class TestResonanceGraphModels:
    def test_signal_node_weight_field_bounds(self):
        """weight must be ge=0.0, le=1.0."""
        node = SignalNode(entity="Nike", weight=0.5)
        assert 0.0 <= node.weight <= 1.0

    def test_signal_node_weight_clamp_raises(self):
        """weight > 1.0 should raise ValidationError."""
        with pytest.raises(ValidationError):
            SignalNode(entity="Nike", weight=1.5)

    def test_signal_edge_similarity_bounds(self):
        """similarity must be ge=0.0, le=1.0."""
        edge = SignalEdge(source="Nike", target="running", similarity=0.65)
        assert 0.0 <= edge.similarity <= 1.0

    def test_signal_edge_similarity_invalid(self):
        """similarity > 1.0 raises ValidationError."""
        with pytest.raises(ValidationError):
            SignalEdge(source="a", target="b", similarity=1.5)

    def test_resonance_graph_default_construction(self):
        """ResonanceGraph() should produce valid defaults without error."""
        rg = ResonanceGraph()
        assert rg.nodes == []
        assert rg.edges == []
        assert rg.composite_resonance_score == 0.0
        assert rg.resonance_tier == "low"
        assert rg.node_count == 0
        assert rg.edge_count == 0

    def test_resonance_graph_with_nodes_and_edges(self):
        """Full construction with nodes + edges round-trips through JSON."""
        node = SignalNode(
            entity="Nike", node_type="brand",
            momentum_score=0.8, cultural_risk=0.1,
            sentiment_signal=0.7, platform_affinity=0.75,
            weight=0.378,
        )
        edge = SignalEdge(source="Nike", target="running", similarity=0.61)
        rg = ResonanceGraph(
            nodes=[node], edges=[edge],
            composite_resonance_score=0.378,
            dominant_signals=["Nike"],
            resonance_tier="moderate",
            node_count=1, edge_count=1,
        )
        dumped = rg.model_dump()
        assert dumped["nodes"][0]["entity"] == "Nike"
        assert dumped["edges"][0]["similarity"] == 0.61

    def test_quantitative_metrics_resonance_graph_defaults_none(self, sample_text_analysis_data, sample_vision_analysis_data, sample_sem_metrics_data):
        """QuantitativeMetrics.resonance_graph defaults to None."""
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(**sample_text_analysis_data),
            vision_data=VisionAnalysis(**sample_vision_analysis_data),
            sem_metrics=SEMMetrics(**sample_sem_metrics_data),
        )
        assert qm.resonance_graph is None

    def test_quantitative_metrics_accepts_resonance_graph(self, sample_text_analysis_data, sample_vision_analysis_data, sample_sem_metrics_data):
        """QuantitativeMetrics accepts a populated ResonanceGraph without error."""
        rg = ResonanceGraph(
            nodes=[SignalNode(entity="Adidas", weight=0.45)],
            edges=[],
            composite_resonance_score=0.45,
            dominant_signals=["Adidas"],
            resonance_tier="moderate",
            node_count=1, edge_count=0,
        )
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(**sample_text_analysis_data),
            vision_data=VisionAnalysis(**sample_vision_analysis_data),
            sem_metrics=SEMMetrics(**sample_sem_metrics_data),
            resonance_graph=rg,
        )
        assert qm.resonance_graph is not None
        assert qm.resonance_graph.resonance_tier == "moderate"


# ──────────────────────────────────────────────────────────────────
# CompositeAdSentiment
# ──────────────────────────────────────────────────────────────────

class TestCompositeAdSentiment:
    def test_minimal_construction(self):
        """CompositeAdSentiment with only required fields."""
        cs = CompositeAdSentiment(composite_score=0.72, signals_available=1)
        assert cs.composite_score == pytest.approx(0.72)
        assert cs.signals_available == 1
        assert cs.ad_copy_score is None
        assert cs.cultural_score is None
        assert cs.reddit_score is None
        assert cs.landing_score is None
        assert cs.effective_weights == {}

    def test_full_construction(self):
        """CompositeAdSentiment with all optional fields populated."""
        cs = CompositeAdSentiment(
            composite_score=0.65,
            ad_copy_score=0.80,
            cultural_score=0.55,
            reddit_score=0.40,
            landing_score=0.70,
            signals_available=4,
            effective_weights={"ad_copy": 0.35, "cultural": 0.30, "reddit": 0.20, "landing": 0.15},
        )
        assert cs.composite_score == pytest.approx(0.65)
        assert cs.ad_copy_score == pytest.approx(0.80)
        assert cs.cultural_score == pytest.approx(0.55)
        assert cs.reddit_score == pytest.approx(0.40)
        assert cs.landing_score == pytest.approx(0.70)
        assert cs.signals_available == 4
        assert cs.effective_weights["ad_copy"] == pytest.approx(0.35)

    def test_composite_score_boundary_zero(self):
        """composite_score=0.0 is valid."""
        cs = CompositeAdSentiment(composite_score=0.0, signals_available=1)
        assert cs.composite_score == 0.0

    def test_composite_score_boundary_one(self):
        """composite_score=1.0 is valid."""
        cs = CompositeAdSentiment(composite_score=1.0, signals_available=4)
        assert cs.composite_score == 1.0

    def test_signals_available_zero(self):
        """signals_available=0 is allowed (degenerate case)."""
        cs = CompositeAdSentiment(composite_score=0.5, signals_available=0)
        assert cs.signals_available == 0

    def test_effective_weights_defaults_empty(self):
        """effective_weights defaults to an empty dict when not provided."""
        cs = CompositeAdSentiment(composite_score=0.5, signals_available=1)
        assert isinstance(cs.effective_weights, dict)
        assert len(cs.effective_weights) == 0

    def test_quant_metrics_accepts_composite_sentiment(
        self, sample_text_analysis_data, sample_vision_analysis_data, sample_sem_metrics_data
    ):
        """QuantitativeMetrics accepts a CompositeAdSentiment object."""
        cs = CompositeAdSentiment(
            composite_score=0.68,
            ad_copy_score=0.75,
            signals_available=2,
        )
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(**sample_text_analysis_data),
            vision_data=VisionAnalysis(**sample_vision_analysis_data),
            sem_metrics=SEMMetrics(**sample_sem_metrics_data),
            composite_sentiment=cs,
        )
        assert qm.composite_sentiment is not None
        assert qm.composite_sentiment.composite_score == pytest.approx(0.68)

    def test_quant_metrics_composite_sentiment_defaults_none(
        self, sample_text_analysis_data, sample_vision_analysis_data, sample_sem_metrics_data
    ):
        """QuantitativeMetrics.composite_sentiment defaults to None when not provided."""
        qm = QuantitativeMetrics(
            text_data=TextAnalysis(**sample_text_analysis_data),
            vision_data=VisionAnalysis(**sample_vision_analysis_data),
            sem_metrics=SEMMetrics(**sample_sem_metrics_data),
        )
        assert qm.composite_sentiment is None
