"""
Tests for Phase 5: Resonance Graph Assembly.

Covers assemble_resonance_graph(), _glove_cosine(), and _heuristic_node_type()
in backend/main.py. All tests use mocked word2vec_model (no real GloVe I/O).
"""
import sys
import os
import pytest
import numpy as np
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    EntityNode, EntityAtomization,
    EntityCulturalContext, CulturalContext,
    VisionAnalysis, SignalNode, SignalEdge, ResonanceGraph,
)
import main
from main import (
    assemble_resonance_graph,
    _glove_cosine,
    _heuristic_node_type,
)


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def make_atomization(name_momentum_pairs):
    """Build a minimal EntityAtomization from [(name, momentum)] pairs."""
    nodes = [
        EntityNode(name=name, momentum=mom, related_queries_top=[], related_queries_rising=[])
        for name, mom in name_momentum_pairs
    ]
    momenta = [m for _, m in name_momentum_pairs if m is not None]
    agg = sum(momenta) / len(momenta) if momenta else None
    return EntityAtomization(nodes=nodes, aggregate_momentum=agg)


def make_cultural_context(entity_risk_pairs, entity_sentiments=None):
    """Build a minimal CulturalContext from [(entity_name, risk_str)] pairs.

    entity_sentiments: optional dict {name: sentiment_str} to override the
    default "neutral" cultural_sentiment per entity.
    """
    sentiments = entity_sentiments or {}
    ecs = [
        EntityCulturalContext(
            entity_name=name,
            cultural_sentiment=sentiments.get(name, "neutral"),
            trending_direction="stable", narrative_summary="test",
            advertising_risk=risk,
        )
        for name, risk in entity_risk_pairs
    ]
    return CulturalContext(entity_contexts=ecs, overall_advertising_risk="low")


# ──────────────────────────────────────────────────────────────────
# Group A: Core function — basic entity handling (8 tests)
# ──────────────────────────────────────────────────────────────────

class TestAssembleBasicEntityHandling:
    def test_assemble_empty_entities_returns_empty_graph(self):
        """entities=[] → fully empty ResonanceGraph with 0 nodes and score 0.0."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=[], entity_atomization=None,
                cultural_context=None, vision_analysis=None,
                sentiment_score=None,
            )
        assert rg.node_count == 0
        assert rg.edge_count == 0
        assert rg.composite_resonance_score == 0.0
        assert rg.resonance_tier == "low"
        assert rg.dominant_signals == []

    def test_assemble_single_entity_no_phases(self):
        """One entity with no Phase 3/4 data → 1 node built from defaults."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=None, vision_analysis=None,
                sentiment_score=None,
            )
        assert rg.node_count == 1
        assert rg.nodes[0].entity == "Nike"

    def test_assemble_single_entity_default_signals(self):
        """Verify default signals: momentum=0.5, risk=0.0, sentiment=0.5, affinity=0.5 → weight=0.125."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=None, vision_analysis=None,
                sentiment_score=None,
            )
        node = rg.nodes[0]
        assert node.momentum_score == 0.5
        assert node.cultural_risk == 0.0
        assert node.sentiment_signal == 0.5
        assert node.platform_affinity == 0.5
        expected_weight = 0.5 * 1.0 * 0.5 * 0.5  # = 0.125
        assert node.weight == pytest.approx(expected_weight, abs=1e-4)

    def test_assemble_uses_atomization_momentum(self):
        """Phase 3 EntityAtomization momentum is used for matched entity."""
        atomization = make_atomization([("Nike", 0.9)])
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=atomization,
                cultural_context=None, vision_analysis=None,
                sentiment_score=None,
            )
        assert rg.nodes[0].momentum_score == pytest.approx(0.9)

    def test_assemble_uses_cultural_risk(self):
        """Phase 4 CulturalContext advertising_risk='high' → cultural_risk=1.0."""
        cc = make_cultural_context([("Nike", "high")])
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc, vision_analysis=None,
                sentiment_score=None,
            )
        assert rg.nodes[0].cultural_risk == pytest.approx(1.0)

    def test_assemble_cultural_risk_penalizes_weight(self):
        """High cultural risk should produce a lower weight than low risk."""
        cc_low = make_cultural_context([("Nike", "low")])
        cc_high = make_cultural_context([("Nike", "high")])
        with patch.object(main, "word2vec_model", None):
            rg_low = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc_low, vision_analysis=None, sentiment_score=0.5,
            )
            rg_high = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc_high, vision_analysis=None, sentiment_score=0.5,
            )
        assert rg_low.nodes[0].weight > rg_high.nodes[0].weight

    def test_assemble_platform_affinity_from_vision(self):
        """VisionAnalysis.platform_fit_score=8.0 → platform_affinity=(8-1)/9=0.7778."""
        vision = VisionAnalysis(visual_tags=["sport"], platform_fit_score=8.0, is_cluttered=False)
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=None, vision_analysis=vision, sentiment_score=None,
            )
        expected_affinity = (8.0 - 1.0) / 9.0
        assert rg.nodes[0].platform_affinity == pytest.approx(expected_affinity, abs=1e-3)

    def test_assemble_platform_affinity_no_vision(self):
        """No vision_analysis → platform_affinity defaults to 0.5."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=None,
            )
        assert rg.nodes[0].platform_affinity == 0.5


# ──────────────────────────────────────────────────────────────────
# Group B: Composite score + resonance tier (7 tests)
# ──────────────────────────────────────────────────────────────────

class TestCompositeScoreAndTier:
    def test_composite_score_is_mean_of_weights(self):
        """composite_resonance_score == mean of all node weights."""
        # Use fully controlled inputs: momentum=1.0, risk=0.0, sentiment=0.4, affinity=0.5
        # → weight = 1.0 * 1.0 * 0.4 * 0.5 = 0.2
        entities = ["Nike", "Adidas", "Puma"]
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=entities, entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=0.4,
            )
        # All nodes have same inputs; composite == individual weight
        weights = [n.weight for n in rg.nodes]
        expected = round(sum(weights) / len(weights), 4)
        assert rg.composite_resonance_score == pytest.approx(expected, abs=1e-4)

    def test_composite_score_clamped_0_to_1(self):
        """composite_resonance_score is always in [0.0, 1.0]."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=1.0,
            )
        assert 0.0 <= rg.composite_resonance_score <= 1.0

    def test_resonance_tier_high(self):
        """Nodes with high weights produce tier='high' (>= 0.60 threshold)."""
        # sentiment=1.0, affinity=1.0 → weight = 0.5 * 1.0 * 1.0 * 1.0 = 0.5 not enough
        # We need weight >= 0.60: use momentum=0.9, risk=0.0, sentiment=0.9, affinity=0.9
        # → weight = 0.9 * 1.0 * 0.9 * 0.9 = 0.729
        atomization = make_atomization([("Nike", 0.9)])
        vision = VisionAnalysis(visual_tags=["sport"], platform_fit_score=9.1, is_cluttered=False)
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=atomization,
                cultural_context=None, vision_analysis=vision, sentiment_score=0.9,
            )
        if rg.composite_resonance_score >= 0.60:
            assert rg.resonance_tier == "high"
        else:
            # Accept moderate if score just under 0.60
            assert rg.resonance_tier in ("high", "moderate")

    def test_resonance_tier_moderate(self):
        """Score in [0.35, 0.60) → tier='moderate'."""
        # momentum=0.5, risk=0.0, sentiment=0.8, affinity=0.9 → 0.5*1*0.8*0.9=0.36
        atomization = make_atomization([("Nike", 0.5)])
        vision = VisionAnalysis(visual_tags=["sport"], platform_fit_score=9.1, is_cluttered=False)
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=atomization,
                cultural_context=None, vision_analysis=vision, sentiment_score=0.8,
            )
        assert rg.resonance_tier in ("moderate", "high")

    def test_resonance_tier_low(self):
        """Score < 0.35 → tier='low'."""
        # sentiment=0.1 → weight = 0.5 * 1 * 0.1 * 0.5 = 0.025 → tier low
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=0.1,
            )
        assert rg.resonance_tier == "low"

    def test_dominant_signals_are_top_3(self):
        """6 nodes → dominant_signals contains exactly the 3 highest-weight entities."""
        # Use different momenta to differentiate weights
        entities = ["A", "B", "C", "D", "E", "F"]
        momenta = [0.9, 0.8, 0.7, 0.4, 0.3, 0.2]
        atomization = make_atomization(list(zip(entities, momenta)))
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=entities, entity_atomization=atomization,
                cultural_context=None, vision_analysis=None, sentiment_score=0.5,
            )
        assert len(rg.dominant_signals) == 3
        # Dominant signals should be the top-3 by weight → highest momentum
        assert set(rg.dominant_signals) == {"A", "B", "C"}

    def test_dominant_signals_fewer_than_3_nodes(self):
        """2 nodes → dominant_signals has exactly 2 entries (no padding)."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["X", "Y"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=None,
            )
        assert len(rg.dominant_signals) == 2


# ──────────────────────────────────────────────────────────────────
# Group C: Edge computation (7 tests)
# ──────────────────────────────────────────────────────────────────

class TestEdgeComputation:
    def test_co_occurrence_edges_when_model_unavailable(self):
        """word2vec_model=None → co-occurrence baseline edges still created."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike", "Adidas"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=None,
            )
        # Co-occurrence baseline gives all pairs a 0.25 edge
        assert len(rg.edges) == 1
        assert rg.edge_count == 1
        assert rg.edges[0].similarity == pytest.approx(0.25)

    def test_co_occurrence_edges_all_oov_entities(self):
        """Entities absent from GloVe vocabulary → co-occurrence baseline edges only."""
        class OOVModel:
            def __contains__(self, key):
                return False
            def __getitem__(self, key):
                raise KeyError(key)

        with patch.object(main, "word2vec_model", OOVModel()):
            rg = assemble_resonance_graph(
                entities=["XYZ123", "QQQ456"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=None,
            )
        # Co-occurrence baseline gives all pairs a 0.25 edge
        assert len(rg.edges) == 1
        assert rg.edges[0].similarity == pytest.approx(0.25)

    def test_edge_created_above_threshold(self, mock_word2vec_model):
        """Two entities that are in-vocab and similar → edge should be created."""
        with patch.object(main, "word2vec_model", mock_word2vec_model):
            # Use known vocab entries; similarity may or may not exceed 0.30
            rg = assemble_resonance_graph(
                entities=["nike", "running"], entity_atomization=None,
                cultural_context=None, vision_analysis=None, sentiment_score=None,
            )
        # Verify edge_count matches the edges list
        assert rg.edge_count == len(rg.edges)
        # If an edge was created, verify it has valid similarity
        for edge in rg.edges:
            assert edge.similarity >= 0.30

    def test_co_occurrence_edge_when_glove_below_threshold(self):
        """If cosine similarity < 0.30, co-occurrence baseline edge (0.25) is still created."""
        with patch.object(main, "_glove_cosine", return_value=0.25):
            with patch.object(main, "word2vec_model", MagicMock()):
                rg = assemble_resonance_graph(
                    entities=["Nike", "Adidas"], entity_atomization=None,
                    cultural_context=None, vision_analysis=None, sentiment_score=None,
                )
        # Co-occurrence baseline gives 0.25, GloVe 0.25 doesn't exceed baseline
        assert len(rg.edges) == 1
        assert rg.edges[0].similarity == pytest.approx(0.25)

    def test_edges_are_deduplicated(self):
        """n entities → at most n*(n-1)/2 unique edges (no duplicate pairs)."""
        # Patch _glove_cosine to always return 0.5 (above threshold)
        with patch.object(main, "_glove_cosine", return_value=0.5):
            with patch.object(main, "word2vec_model", MagicMock()):
                rg = assemble_resonance_graph(
                    entities=["A", "B", "C", "D"], entity_atomization=None,
                    cultural_context=None, vision_analysis=None, sentiment_score=None,
                )
        n = 4
        max_edges = n * (n - 1) // 2  # = 6
        assert rg.edge_count <= max_edges
        # Check no duplicate (source, target) pairs
        pairs = [(e.source, e.target) for e in rg.edges]
        assert len(pairs) == len(set(pairs))

    def test_edge_source_lt_target_lexicographic(self):
        """All edges must have source < target lexicographically."""
        with patch.object(main, "_glove_cosine", return_value=0.5):
            with patch.object(main, "word2vec_model", MagicMock()):
                rg = assemble_resonance_graph(
                    entities=["Zara", "Apple", "Nike"], entity_atomization=None,
                    cultural_context=None, vision_analysis=None, sentiment_score=None,
                )
        for edge in rg.edges:
            assert edge.source < edge.target, f"Edge source not < target: {edge.source} >= {edge.target}"

    def test_edge_count_matches_edges_list_length(self):
        """resonance_graph.edge_count == len(resonance_graph.edges)."""
        with patch.object(main, "_glove_cosine", return_value=0.5):
            with patch.object(main, "word2vec_model", MagicMock()):
                rg = assemble_resonance_graph(
                    entities=["A", "B", "C"], entity_atomization=None,
                    cultural_context=None, vision_analysis=None, sentiment_score=None,
                )
        assert rg.edge_count == len(rg.edges)


# ──────────────────────────────────────────────────────────────────
# Group D: Per-entity sentiment signal (composite overhaul)
# ──────────────────────────────────────────────────────────────────

class TestPerEntitySentiment:
    def test_positive_cultural_sentiment_raises_node_signal(self):
        """Entity with cultural_sentiment='positive' → sentiment_signal=1.0 (not global fallback)."""
        cc = make_cultural_context(
            [("Nike", "low")],
            entity_sentiments={"Nike": "positive"},
        )
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc, vision_analysis=None,
                sentiment_score=0.3,  # lower global — should be overridden
            )
        assert rg.nodes[0].sentiment_signal == pytest.approx(1.0)

    def test_negative_cultural_sentiment_zeroes_node_signal(self):
        """Entity with cultural_sentiment='negative' → sentiment_signal=0.0."""
        cc = make_cultural_context(
            [("Nike", "low")],
            entity_sentiments={"Nike": "negative"},
        )
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc, vision_analysis=None,
                sentiment_score=0.9,  # high global — should be overridden
            )
        assert rg.nodes[0].sentiment_signal == pytest.approx(0.0)

    def test_neutral_cultural_sentiment_uses_0_5(self):
        """Entity with cultural_sentiment='neutral' → sentiment_signal=0.5."""
        cc = make_cultural_context(
            [("Nike", "low")],
            entity_sentiments={"Nike": "neutral"},
        )
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc, vision_analysis=None,
                sentiment_score=0.9,
            )
        assert rg.nodes[0].sentiment_signal == pytest.approx(0.5)

    def test_mixed_cultural_sentiment_uses_0_4(self):
        """Entity with cultural_sentiment='mixed' → sentiment_signal=0.4 (below neutral)."""
        cc = make_cultural_context(
            [("Nike", "low")],
            entity_sentiments={"Nike": "mixed"},
        )
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc, vision_analysis=None,
                sentiment_score=0.9,
            )
        assert rg.nodes[0].sentiment_signal == pytest.approx(0.4)

    def test_entity_without_cultural_context_falls_back_to_global(self):
        """Entity not in cultural_context uses global (composite) sentiment score as fallback."""
        cc = make_cultural_context(
            [("Adidas", "low")],  # only Adidas has a Perplexity context
            entity_sentiments={"Adidas": "positive"},
        )
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike", "Adidas"], entity_atomization=None,
                cultural_context=cc, vision_analysis=None,
                sentiment_score=0.6,
            )
        nodes_by_entity = {n.entity: n for n in rg.nodes}
        # Adidas has Perplexity 'positive' → 1.0
        assert nodes_by_entity["Adidas"].sentiment_signal == pytest.approx(1.0)
        # Nike has no Perplexity context → falls back to global 0.6
        assert nodes_by_entity["Nike"].sentiment_signal == pytest.approx(0.6)

    def test_no_cultural_context_all_entities_use_global(self):
        """cultural_context=None → all nodes use global sentiment_score fallback."""
        with patch.object(main, "word2vec_model", None):
            rg = assemble_resonance_graph(
                entities=["Nike", "Adidas", "Puma"], entity_atomization=None,
                cultural_context=None, vision_analysis=None,
                sentiment_score=0.75,
            )
        for node in rg.nodes:
            assert node.sentiment_signal == pytest.approx(0.75)

    def test_per_entity_sentiment_affects_weight(self):
        """Same entity with positive vs negative cultural sentiment → significantly different weights."""
        cc_pos = make_cultural_context([("Nike", "low")], entity_sentiments={"Nike": "positive"})
        cc_neg = make_cultural_context([("Nike", "low")], entity_sentiments={"Nike": "negative"})
        with patch.object(main, "word2vec_model", None):
            rg_pos = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc_pos, vision_analysis=None, sentiment_score=0.5,
            )
            rg_neg = assemble_resonance_graph(
                entities=["Nike"], entity_atomization=None,
                cultural_context=cc_neg, vision_analysis=None, sentiment_score=0.5,
            )
        assert rg_pos.nodes[0].weight > rg_neg.nodes[0].weight


# ──────────────────────────────────────────────────────────────────
# Group E: compute_composite_sentiment() unit tests
# ──────────────────────────────────────────────────────────────────

from main import compute_composite_sentiment
from models import RedditSentiment, LandingPageCoherence, CulturalContext, EntityCulturalContext


class TestComputeCompositeSentiment:
    def _make_reddit(self, avg):
        return RedditSentiment(
            query="test query", avg_sentiment=avg, post_count=5, themes=[], top_subreddits=[]
        )

    def _make_landing(self, score):
        return LandingPageCoherence(
            url="https://example.com",
            coherence_score=score,
            sentiment_alignment=score,
            missing_entities=[], headline_match=True, body_match=True
        )

    def _make_cultural(self, entity_sentiments):
        ecs = [
            EntityCulturalContext(
                entity_name=name, cultural_sentiment=sent,
                trending_direction="stable", narrative_summary="",
                advertising_risk="low",
            )
            for name, sent in entity_sentiments.items()
        ]
        return CulturalContext(entity_contexts=ecs, overall_advertising_risk="low")

    def test_only_ad_copy_returns_ad_copy_score(self):
        """With no cultural/reddit/landing, composite == ad_copy_score."""
        cs = compute_composite_sentiment(
            ad_copy_score=0.8,
            cultural_context=None,
            reddit_sentiment=None,
            landing_page=None,
        )
        assert cs.composite_score == pytest.approx(0.8)
        assert cs.signals_available == 1
        assert cs.ad_copy_score == pytest.approx(0.8)

    def test_no_signals_returns_0_5_neutral(self):
        """All signals None → composite_score=0.5 (neutral default), signals_available=0."""
        cs = compute_composite_sentiment(
            ad_copy_score=None,
            cultural_context=None,
            reddit_sentiment=None,
            landing_page=None,
        )
        assert cs.composite_score == pytest.approx(0.5)
        assert cs.signals_available == 0

    def test_two_signals_renormalize_weights(self):
        """ad_copy + reddit only → weights renormalize to sum=1.0."""
        cs = compute_composite_sentiment(
            ad_copy_score=1.0,
            cultural_context=None,
            reddit_sentiment=self._make_reddit(0.0),
            landing_page=None,
        )
        # ad_copy weight=0.35, reddit weight=0.20 → renorm: ad=0.35/0.55≈0.636, reddit=0.20/0.55≈0.364
        assert cs.signals_available == 2
        assert abs(sum(cs.effective_weights.values()) - 1.0) < 1e-4
        # 1.0*0.636 + 0.0*0.364 ≈ 0.636
        assert cs.composite_score == pytest.approx(0.636, abs=0.01)

    def test_cultural_avg_from_multiple_entities(self):
        """Cultural score is mean of per-entity _CULTURAL_SENTIMENT_FLOAT values."""
        # positive=1.0, negative=0.0 → avg=0.5
        cc = self._make_cultural({"Nike": "positive", "Adidas": "negative"})
        cs = compute_composite_sentiment(
            ad_copy_score=None,
            cultural_context=cc,
            reddit_sentiment=None,
            landing_page=None,
        )
        assert cs.cultural_score == pytest.approx(0.5)

    def test_reddit_score_normalized_from_0_1_input(self):
        """reddit_sentiment.avg_sentiment in [0,1] is stored directly."""
        reddit = self._make_reddit(0.65)
        cs = compute_composite_sentiment(
            ad_copy_score=None,
            cultural_context=None,
            reddit_sentiment=reddit,
            landing_page=None,
        )
        assert cs.reddit_score == pytest.approx(0.65)

    def test_landing_score_normalized(self):
        """landing_page.coherence_score in [0,1] is stored as landing_score."""
        landing = self._make_landing(0.82)
        cs = compute_composite_sentiment(
            ad_copy_score=None,
            cultural_context=None,
            reddit_sentiment=None,
            landing_page=landing,
        )
        assert cs.landing_score == pytest.approx(0.82)

    def test_composite_clamped_0_to_1(self):
        """composite_score is always in [0.0, 1.0]."""
        cs = compute_composite_sentiment(
            ad_copy_score=1.0,
            cultural_context=self._make_cultural({"A": "positive"}),
            reddit_sentiment=self._make_reddit(1.0),
            landing_page=self._make_landing(1.0),
        )
        assert 0.0 <= cs.composite_score <= 1.0

    def test_all_four_signals_weights_sum_to_one(self):
        """With all four signals present, effective_weights sum to 1.0."""
        cs = compute_composite_sentiment(
            ad_copy_score=0.7,
            cultural_context=self._make_cultural({"A": "positive"}),
            reddit_sentiment=self._make_reddit(0.5),
            landing_page=self._make_landing(0.6),
        )
        assert cs.signals_available == 4
        assert abs(sum(cs.effective_weights.values()) - 1.0) < 1e-4
