"""
Tests for NLP pipeline functions — NER, Sentiment, Word2Vec expansion.
These are unit tests that use the real ML models (spaCy, RoBERTa, GloVe)
since they're deterministic and local.
"""
import pytest
import sys
import os

# Ensure backend is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture(scope="module")
def nlp_models():
    """Load NLP models once per test module (expensive but deterministic)."""
    import spacy
    from transformers import pipeline as hf_pipeline
    import gensim.downloader as gensim_api

    nlp = spacy.load("en_core_web_sm")
    sentiment = hf_pipeline(
        "text-classification",
        model="cardiffnlp/twitter-roberta-base-sentiment",
        top_k=None,
        device=-1,
    )
    w2v = gensim_api.load("glove-twitter-50")

    return {"nlp": nlp, "sentiment": sentiment, "w2v": w2v}


@pytest.fixture(autouse=True)
def patch_globals(nlp_models):
    """Inject loaded models into main module globals."""
    import main
    main.nlp_model = nlp_models["nlp"]
    main.sentiment_analyzer = nlp_models["sentiment"]
    main.word2vec_model = nlp_models["w2v"]
    yield
    # No teardown needed — models stay loaded


# ──────────────────────────────────────────────────────────────────
# NER Tests
# ──────────────────────────────────────────────────────────────────

class TestRunNER:
    def test_extracts_named_entities(self):
        from main import run_ner
        entities = run_ner("Nike launched a new campaign in Portland, Oregon.")
        assert len(entities) > 0
        # Should find at least Nike, Portland, or Oregon
        entity_lower = [e.lower() for e in entities]
        assert any(e in entity_lower for e in ["nike", "portland", "oregon"])

    def test_empty_text_returns_empty(self):
        from main import run_ner
        assert run_ner("") == []
        assert run_ner("  ") == []
        assert run_ner("..") == []

    def test_noun_chunk_fallback(self):
        """When no named entities exist, should fall back to noun chunks."""
        from main import run_ner
        entities = run_ner("The quick brown fox jumps over the lazy dog near the river.")
        # No proper named entities, but should extract nouns like fox, dog, river
        assert len(entities) > 0

    def test_handles_newlines(self):
        from main import run_ner
        entities = run_ner("Nike\nis\ngreat\nin\nPortland")
        # Should still work after newline replacement
        assert isinstance(entities, list)

    def test_short_entities_filtered(self):
        """Entities of 1 character should be filtered out."""
        from main import run_ner
        entities = run_ner("A B C company launched in X city with testing approach")
        for e in entities:
            assert len(e.strip()) > 1


# ──────────────────────────────────────────────────────────────────
# Sentiment Tests
# ──────────────────────────────────────────────────────────────────

class TestRunSentiment:
    def test_positive_text(self):
        from main import run_sentiment
        result = run_sentiment("This is an amazing, wonderful, fantastic product!")
        assert result is not None
        assert "score" in result
        assert "positive" in result
        assert "neutral" in result
        assert "negative" in result
        # Positive text should have high positive probability
        assert result["positive"] > result["negative"]

    def test_negative_text(self):
        from main import run_sentiment
        result = run_sentiment("This is terrible, awful, the worst product ever made.")
        assert result is not None
        assert result["negative"] > result["positive"]

    def test_score_range(self):
        from main import run_sentiment
        result = run_sentiment("A normal sentence about a regular product.")
        assert result is not None
        assert 0.0 <= result["score"] <= 1.0
        assert 0.0 <= result["positive"] <= 1.0
        assert 0.0 <= result["neutral"] <= 1.0
        assert 0.0 <= result["negative"] <= 1.0

    def test_empty_text_returns_none(self):
        from main import run_sentiment
        assert run_sentiment("") is None
        assert run_sentiment("  ") is None
        assert run_sentiment("..") is None

    def test_long_text_truncated(self):
        """Text > 512 chars should still work (truncated internally)."""
        from main import run_sentiment
        long_text = "This is great! " * 100  # ~1500 chars
        result = run_sentiment(long_text)
        assert result is not None
        assert 0.0 <= result["score"] <= 1.0


# ──────────────────────────────────────────────────────────────────
# Word2Vec Expansion Tests
# ──────────────────────────────────────────────────────────────────

class TestRunWord2VecExpansion:
    def test_expands_hashtags(self):
        from main import run_word2vec_expansion
        result = run_word2vec_expansion(["#fitness", "#running"])
        assert result is not None
        assert len(result) > 0
        # All results should be hashtags
        for tag in result:
            assert tag.startswith("#")

    def test_deduplicates_against_input(self):
        from main import run_word2vec_expansion
        result = run_word2vec_expansion(["#sport"])
        if result:
            assert "#sport" not in result

    def test_empty_input_returns_none(self):
        from main import run_word2vec_expansion
        assert run_word2vec_expansion([]) is None

    def test_fallback_words(self):
        """When hashtags are empty, should use fallback words (entities)."""
        from main import run_word2vec_expansion
        result = run_word2vec_expansion([], fallback_words=["technology", "innovation"])
        assert result is not None
        assert len(result) > 0

    def test_unknown_word_handled(self):
        """Words not in GloVe vocab should be skipped, not crash."""
        from main import run_word2vec_expansion
        result = run_word2vec_expansion(["#xyznonexistentword123"])
        # Should return None or empty since the word isn't in vocab
        assert result is None or len(result) == 0

    def test_top_n_limit(self):
        from main import run_word2vec_expansion
        result = run_word2vec_expansion(["#sports", "#fitness"], top_n=3)
        if result:
            assert len(result) <= 3
