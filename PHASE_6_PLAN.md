# PHASE 6 PLAN: Upgraded Executive Diagnostic

## Overview

Phase 6 rebuilds the internals of `generate_executive_diagnostic()` to consume the Phase 5 `ResonanceGraph` as its primary narrative frame. The function signature, return type, and all call sites remain **completely unchanged** — the upgrade is entirely prompt-engineering and pre-processing logic inside the function.

The core problem with the current implementation: it feeds Gemini a 2,000-token raw JSON dump of `QuantitativeMetrics` and asks it to extract meaning. The model receives equal weight for `landing_page.issues` and `resonance_graph.dominant_signals`, with no signal hierarchy. Phase 6 replaces this with a **curated signal brief** (~600 tokens, ~30% of current input) that pre-interprets the data before Gemini sees it, ordered by analytical importance.

The result: more focused, more actionable diagnostic text in fewer LLM output tokens, with explicit references to named signal nodes, edge clusters, and audio trends that the current flat JSON cannot produce.

---

## Goal

1. Add internal helper `_build_signal_brief()` that converts `QuantitativeMetrics` → a compact structured dict
2. Replace `metrics.model_dump_json(indent=2)` in the user prompt with `json.dumps(_build_signal_brief(metrics), indent=2)`
3. Replace the system prompt's 5-section structure with a **6-section resonance-aware structure**
4. Increase word limit from 400 to 500 (richer input → richer output)
5. Add graceful fallback: if `metrics.resonance_graph` is `None`, fall back to the old full JSON dump path (safe to deploy before Phase 5 is implemented)

---

## No New Dependencies, No Signature Changes

```python
# BEFORE (Phase 0–5):
def generate_executive_diagnostic(
    metrics: QuantitativeMetrics,
    headline: str,
    platform: str,
    audience: str,
) -> str:

# AFTER (Phase 6):
def generate_executive_diagnostic(
    metrics: QuantitativeMetrics,    # same
    headline: str,                   # same
    platform: str,                   # same
    audience: str,                   # same
) -> str:                            # same
```

All 3 call sites (SSE endpoint, sync endpoint, tests) require **zero changes**.

---

## New Internal Helper: `_build_signal_brief()`

**Location**: Immediately above `generate_executive_diagnostic()` in `backend/main.py`.

```python
def _build_signal_brief(
    metrics: QuantitativeMetrics,
    headline: str,
    platform: str,
    audience: str,
) -> dict:
    """
    Distil QuantitativeMetrics into a compact signal brief (~600 tokens) for
    Gemini synthesis. Cherry-picks the highest-signal fields in priority order.
    Called only when metrics.resonance_graph is present.
    """
```

### Structure of the returned dict

```json
{
  "campaign": {
    "headline": "...",
    "platform": "...",
    "audience": "..."
  },
  "resonance": {
    "tier": "moderate",
    "composite_score": 0.43,
    "dominant_signals": ["Nike", "running", "performance"],
    "high_risk_nodes": [
      {"entity": "...", "cultural_risk": 0.72, "cultural_moment": "..."}
    ]
  },
  "signal_clusters": [
    {"source": "Nike", "target": "running", "similarity": 0.61}
  ],
  "quality": {
    "quality_score": 7.5,
    "effective_cpc": 0.95,
    "daily_clicks": 105,
    "industry_verdict": "above_average",
    "industry_avg_cpc": 1.20
  },
  "platform_performance": {
    "platform_fit": "good",
    "platform_fit_score": 8.0,
    "platform_suggestions": "Consider adding a clear CTA button",
    "extracted_text": "Just Do It",
    "brand_detected": "Nike"
  },
  "audio_signal": {
    "title": "Espresso",
    "artist": "Sabrina Carpenter",
    "trend_momentum": 0.82,
    "confidence": 0.91
  },
  "market_context": {
    "momentum": 0.65,
    "related_queries_top": ["nike shoes", "running shoes", "..."],
    "related_queries_rising": ["nike air max 2026"],
    "top_region": "United States",
    "gap_trends": ["trail running", "sustainability"],
    "missing_landing_page_entities": ["sale", "free shipping"]
  },
  "community": {
    "reddit_avg_sentiment": 0.61,
    "reddit_themes": ["value for money", "comfort"],
    "reddit_post_count": 24
  },
  "competitive": {
    "brand": "Adidas",
    "ad_count": 87,
    "avg_longevity_days": 14.3,
    "format_breakdown": {"image": 52, "video": 35}
  }
}
```

### Construction rules (field-by-field)

**`campaign`**: Always populated from function arguments.

**`resonance`**: From `metrics.resonance_graph`
- `tier`, `composite_score` → direct fields
- `dominant_signals` → `resonance_graph.dominant_signals[:3]`
- `high_risk_nodes` → nodes where `cultural_risk > 0.5`, merged with `cultural_context.entities` to add `cultural_moment` text if available. Capped at 3 nodes.

**`signal_clusters`**: From `resonance_graph.edges` filtered to `similarity >= 0.45` (strong connections only), capped at 5 edges. If no edges ≥ 0.45 threshold: empty list (Gemini will note the fragmentation).

**`quality`**: From `metrics.sem_metrics` + `metrics.industry_benchmark`
- If `industry_benchmark` present: include `industry_verdict`, `industry_avg_cpc`, `cpc_delta_pct`
- Else: only `quality_score`, `effective_cpc`, `daily_clicks`

**`platform_performance`**: From `metrics.vision_data`
- Include only: `platform_fit`, `platform_fit_score`, `platform_suggestions`, `extracted_text`, `brand_detected`, `is_cluttered`
- Omit `visual_tags` (noisy, ~10 items) and `style_assessment` (low signal)

**`audio_signal`**: From `metrics.media_decomposition.audio.song_id` (Phase 2)
- If not present or no confidence > 0.5: `null`
- Include: `title`, `artist`, `trend_momentum`, `confidence`

**`market_context`**: Mixed sources
- `momentum` → `metrics.trend_data.momentum`
- `related_queries_top` → top 5 only (current prompt sends all)
- `related_queries_rising` → top 3 only
- `top_region` → `metrics.trend_data.top_regions[0]["name"]` if available
- `gap_trends` → `metrics.creative_alignment.gap_trends[:5]` if available
- `missing_landing_page_entities` → `metrics.landing_page.missing_entities` if available

**`community`**: From `metrics.reddit_sentiment`
- Include: `avg_sentiment`, `themes[:5]`, `post_count`
- If absent: omit key entirely

**`competitive`**: From `metrics.competitor_intel`
- Include: `brand`, `ad_count`, `avg_longevity_days`, `format_breakdown`
- If absent or status != "ok": omit key entirely

### Token budget

| Field | Approx tokens |
|-------|--------------|
| campaign | 20 |
| resonance | 90 |
| signal_clusters | 50 |
| quality | 40 |
| platform_performance | 60 |
| audio_signal | 30 |
| market_context | 80 |
| community | 40 |
| competitive | 40 |
| **Total** | **~450 tokens** |

vs current `metrics.model_dump_json(indent=2)` which typically runs 1,800–2,400 tokens depending on how many optional fields are populated.

---

## Updated System Prompt (6 Sections)

```python
RESONANCE_SYSTEM_PROMPT = """You are a senior media-buying strategist writing an executive diagnostic for an ad creative.

You will receive a compact signal brief extracted from a multi-model ML pipeline. Your job:
- Narrate and interpret the REAL numbers — do NOT invent statistics
- Be platform-specific: reference the target platform's norms and best practices
- Reference named entities, signal nodes, and semantic clusters from the resonance data explicitly
- If a field is null or absent, acknowledge the gap honestly

Write exactly 6 sections:

**Resonance Overview**: Open with the resonance tier verdict (HIGH / MODERATE / LOW) and composite score. Name the top 3 signal nodes and explain what their combined weight means for this campaign's cultural footing. If any nodes carry elevated cultural risk (>0.5), flag them immediately here.

**Creative & Platform Fit**: What the vision pipeline found — brand detection, extracted text, platform fit score, clutter assessment. Is this creative fit-for-purpose on this platform? If landing page coherence data is available (missing_landing_page_entities), mention the entity gap rate.

**Market & Audio Signals**: What the momentum data shows — is the topic trending up or down? Reference the top related queries and rising queries for content angle ideas. If an audio signal is present (song title + artist + trend_momentum), cite it explicitly as a cultural timing indicator.

**Semantic Coherence**: Look at the signal_clusters field. If strong edges exist (similarity ≥ 0.45), note which entities form a coherent semantic cluster and what message this cluster reinforces. If signal_clusters is empty, flag the fragmented brand vocabulary as a strategic risk.

**Competitive & Community Intelligence**: If competitor data is available, reference ad volume, format breakdown, and longevity. If Reddit sentiment is available, cite the community sentiment score and top themes. If neither is available, skip this section.

**3 Resonance-Optimized Improvements**: Three concrete, actionable changes, each explicitly referencing a specific data point from the signal brief. Format: "Signal: [source] → Improvement: [action]." Examples: "Signal: cultural_risk 0.72 on node [X] → Improvement: replace X with [Y] to avoid [cultural_moment]" or "Signal: signal_cluster Nike↔running (sim 0.61) → Improvement: reinforce the running message with a distance/time stat to deepen semantic resonance."

Keep it under 500 words. Be direct, specific, and platform-aware."""
```

### Fallback system prompt (unchanged from current, used when `resonance_graph` is None):

The existing prompt is preserved verbatim as `LEGACY_SYSTEM_PROMPT`. No changes to the fallback path.

---

## Updated `generate_executive_diagnostic()` Logic

```python
def generate_executive_diagnostic(
    metrics: QuantitativeMetrics,
    headline: str,
    platform: str,
    audience: str,
) -> str:
    if not gemini_client:
        return (
            "LLM synthesis unavailable (GEMINI_API_KEY not configured). "
            "Review the quantitative metrics above for your analysis."
        )

    # Phase 6: use signal brief if resonance graph is available
    if metrics.resonance_graph is not None:
        system_prompt = RESONANCE_SYSTEM_PROMPT
        brief = _build_signal_brief(metrics, headline, platform, audience)
        user_prompt = (
            f"Ad Headline: {headline}\n"
            f"Platform: {platform}\n"
            f"Target Audience: {audience}\n\n"
            f"Signal Brief (pre-interpreted pipeline outputs):\n"
            f"{json.dumps(brief, indent=2)}"
        )
    else:
        # Graceful fallback: full JSON dump (legacy path)
        system_prompt = LEGACY_SYSTEM_PROMPT
        metrics_payload = metrics.model_dump_json(indent=2)
        user_prompt = (
            f"Ad Headline: {headline}\n"
            f"Platform: {platform}\n"
            f"Target Audience: {audience}\n\n"
            f"Pre-computed Metrics (DO NOT recalculate — just narrate):\n"
            f"{metrics_payload}"
        )

    # Retry logic unchanged (3 attempts, exponential backoff)
    max_retries = 3
    last_error = None
    for attempt in range(max_retries):
        try:
            response = gemini_client.models.generate_content(
                model="gemini-3-flash-preview",
                contents=f"{system_prompt}\n\n{user_prompt}",
            )
            text = response.text
            if text:
                return text.strip()
            reason = response.candidates[0].finish_reason if response.candidates else 'unknown'
            print(f'Gemini returned no text (attempt {attempt + 1}). Finish reason: {reason}')
            if attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                time.sleep(wait)
                continue
            return 'LLM synthesis returned empty. The quantitative metrics above are still valid.'
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                time.sleep(wait)
            else:
                return f"LLM synthesis failed: {str(last_error)}. Review the quantitative metrics above."
```

The retry loop and Gemini call are **identical** to the current implementation. The only changes are the prompt construction above the loop.

---

## Constants Placement

Add two module-level constants immediately above `_build_signal_brief()`:

```python
# ==========================================
# DIAGNOSTIC PROMPT CONSTANTS
# ==========================================
RESONANCE_SYSTEM_PROMPT = """..."""  # 6-section resonance-aware prompt (Phase 6)
LEGACY_SYSTEM_PROMPT = """..."""     # Original 5-section prompt (fallback when no resonance_graph)
```

`LEGACY_SYSTEM_PROMPT` is **moved verbatim** from the current inline string in `generate_executive_diagnostic()` — no content changes.

---

## `json` Import

The `_build_signal_brief()` function returns a `dict` and uses `json.dumps()` in the diagnostic. Check that `import json` is present at the top of `main.py`. It currently is (used in the SSE endpoint's `_json` alias: `import json as _json`). Add a top-level `import json` if the module-level alias isn't sufficient — or reuse `_json` alias. In practice, `import json` is almost certainly already a standard import.

---

## Tests

### Test File: `backend/tests/test_phase6_diagnostic.py`

**Target: 16 new tests**

#### Group A: `_build_signal_brief()` — 7 tests

```
test_build_signal_brief_campaign_fields
  → Verify "campaign.headline", "campaign.platform", "campaign.audience" all populated correctly.

test_build_signal_brief_resonance_fields
  → Inject ResonanceGraph(tier="high", composite_score=0.71, dominant_signals=["Nike","running"])
    → brief["resonance"]["tier"] == "high"
    → brief["resonance"]["dominant_signals"] == ["Nike", "running"]

test_build_signal_brief_high_risk_nodes_flagged
  → ResonanceGraph with one node having cultural_risk=0.72
    → brief["resonance"]["high_risk_nodes"] contains that entity

test_build_signal_brief_no_high_risk_nodes
  → All nodes cultural_risk <= 0.5 → brief["resonance"]["high_risk_nodes"] == []

test_build_signal_brief_signal_clusters_threshold
  → Edges with similarity [0.30, 0.45, 0.61] → only the 0.45 and 0.61 edges appear in
    brief["signal_clusters"] (threshold >= 0.45)

test_build_signal_brief_audio_signal_present
  → MediaDecomposition with song_id.confidence=0.85 → brief["audio_signal"] populated
    with title, artist, trend_momentum

test_build_signal_brief_audio_signal_absent
  → No media_decomposition → brief["audio_signal"] is None

test_build_signal_brief_token_budget
  → len(json.dumps(brief)) < 3000 chars on a fully-populated QuantitativeMetrics
```

(8 tests — counting token_budget test)

#### Group B: `generate_executive_diagnostic()` — 6 tests

```
test_diagnostic_uses_resonance_prompt_when_graph_present
  → Verify gemini_client.models.generate_content was called with RESONANCE_SYSTEM_PROMPT
    text in the contents string (not LEGACY)

test_diagnostic_uses_legacy_prompt_when_no_graph
  → metrics.resonance_graph = None → verify LEGACY_SYSTEM_PROMPT was used

test_diagnostic_returns_stripped_text
  → Mock returns "  \n  some text  \n  " → returned value == "some text"

test_diagnostic_retry_on_empty_response
  → First call returns response.text="" (empty), second call returns real text
    → function eventually succeeds after retry

test_diagnostic_retry_on_exception
  → First call raises Exception, second call returns real text
    → function eventually succeeds

test_diagnostic_no_gemini_client
  → gemini_client = None → returns the "unavailable" fallback string immediately
```

#### Group C: SSE integration — 2 tests

```
test_stream_emits_diagnostic_event
  → Full SSE stream completes → event list contains {"type": "diagnostic"} event

test_stream_diagnostic_with_resonance_graph_uses_new_prompt
  → Patch _build_signal_brief to return known dict
    → Verify gemini received signal brief (not full JSON) in its call
```

**Total new tests: 16**
**Running total after Phase 6: 310 + 16 = 326 tests**

---

## Fixtures Required

### In `conftest.py` — one new fixture

```python
@pytest.fixture
def sample_resonance_aware_metrics(
    sample_text_analysis_data,
    sample_vision_analysis_data,
    sample_sem_metrics_data,
):
    """A fully-populated QuantitativeMetrics including a ResonanceGraph (for Phase 6 tests)."""
    from models import (
        QuantitativeMetrics, TextAnalysis, VisionAnalysis, SEMMetrics,
        ResonanceGraph, SignalNode,
    )
    return QuantitativeMetrics(
        text_data=TextAnalysis(**sample_text_analysis_data),
        vision_data=VisionAnalysis(**sample_vision_analysis_data),
        sem_metrics=SEMMetrics(**sample_sem_metrics_data),
        resonance_graph=ResonanceGraph(
            nodes=[
                SignalNode(
                    entity="Nike", node_type="brand",
                    momentum_score=0.75, cultural_risk=0.1,
                    sentiment_signal=0.70, platform_affinity=0.80,
                    weight=0.378,
                )
            ],
            edges=[],
            composite_resonance_score=0.378,
            dominant_signals=["Nike"],
            resonance_tier="moderate",
            node_count=1,
            edge_count=0,
        ),
    )
```

### In `helpers.py` — update `MOCK_DIAGNOSTIC_RESPONSE`

Add a resonance-aware variant to `helpers.py`:

```python
MOCK_RESONANCE_DIAGNOSTIC_RESPONSE = (
    "**Resonance Overview**: This campaign achieves MODERATE resonance (0.43).\n\n"
    "**Creative & Platform Fit**: The creative scores 8.0/10 for platform fit.\n\n"
    "**Market & Audio Signals**: Trend momentum is 0.65 — topic is growing.\n\n"
    "**Semantic Coherence**: Nike↔running cluster (0.61) reinforces the sport message.\n\n"
    "**Competitive & Community Intelligence**: No competitor data available.\n\n"
    "**3 Resonance-Optimized Improvements**: 1. Signal: cultural_risk 0.1 on Nike → "
    "maintain current framing. 2. Add trending query 'trail running'. 3. Test video."
)
```

This is used by the updated `mock_gemini_client` fixture to distinguish resonance-path calls from legacy-path calls. The fixture already uses content inspection to route; a 6-section response pattern can be added without breaking existing tests.

---

## Implementation Notes

### 1. `_build_signal_brief()` handles all `None` gracefully

Every field access uses `.get()` or `getattr(..., None)` with conditional inclusion:

```python
brief = {
    "campaign": {...},
    "resonance": {...},  # populated regardless (resonance_graph is guaranteed non-None here)
}

if metrics.trend_data:
    brief["market_context"] = {
        "momentum": metrics.trend_data.momentum,
        "related_queries_top": metrics.trend_data.related_queries_top[:5],
        ...
    }

if (metrics.media_decomposition and
    metrics.media_decomposition.audio and
    metrics.media_decomposition.audio.song_id and
    metrics.media_decomposition.audio.song_id.confidence >= 0.5):
    brief["audio_signal"] = {
        "title": metrics.media_decomposition.audio.song_id.title,
        ...
    }
else:
    brief["audio_signal"] = None
```

### 2. `RESONANCE_SYSTEM_PROMPT` and `LEGACY_SYSTEM_PROMPT` as module constants

Moving the system prompt out of the function body into module-level constants enables:
- Direct assertion in tests (`assert RESONANCE_SYSTEM_PROMPT in call_args`)
- Future hot-reload without server restart (they're just strings)
- Clear separation between Phase 6 path and legacy path

### 3. `json` aliasing

The SSE endpoint already does `import json as _json` at the top of `event_stream()`. The `_build_signal_brief()` function uses the top-level `json` module which should already be imported. If it isn't, add `import json` to the top-of-file imports alongside `import os`, `import time`, etc.

### 4. High-risk node merging with cultural context

The `high_risk_nodes` list in the signal brief is enriched with `cultural_moment` text from Phase 4's `CulturalContext` model:

```python
high_risk = []
if metrics.resonance_graph:
    risk_map = {}
    if metrics.cultural_context and metrics.cultural_context.entities:
        risk_map = {ec.entity: ec.cultural_moment
                    for ec in metrics.cultural_context.entities}
    for node in metrics.resonance_graph.nodes:
        if node.cultural_risk > 0.5:
            high_risk.append({
                "entity": node.entity,
                "cultural_risk": node.cultural_risk,
                "cultural_moment": risk_map.get(node.entity, None),
            })
high_risk = high_risk[:3]  # cap at 3
```

This is the first place in the codebase where Phase 3, 4, and 5 outputs are **explicitly synthesised together** in a single narrative-ready structure, before Gemini ever sees the data.

### 5. Edge cluster threshold (0.45 vs Phase 5's 0.30)

Phase 5 stores all edges with similarity ≥ 0.30. Phase 6's `_build_signal_brief()` only includes edges with similarity ≥ 0.45 in the `signal_clusters` field sent to Gemini. The looser threshold ensures graph density for visualization (Phase 7), while the tighter threshold ensures only strong connections are narrated (high narrative value, avoids noise).

---

## Files Changed

| File | Change |
|------|--------|
| `backend/main.py` | Add `RESONANCE_SYSTEM_PROMPT`, `LEGACY_SYSTEM_PROMPT` constants; add `_build_signal_brief()`; update `generate_executive_diagnostic()` branch logic; add `import json` if missing |
| `backend/tests/test_phase6_diagnostic.py` | **New file** — 14 tests |
| `backend/tests/test_phase6_sse.py` | **New file** — 2 SSE integration tests |
| `backend/tests/conftest.py` | +1 fixture: `sample_resonance_aware_metrics` |
| `backend/tests/helpers.py` | +1 constant: `MOCK_RESONANCE_DIAGNOSTIC_RESPONSE` |

---

## Test Count Summary

| Location | New Tests |
|----------|-----------|
| `test_phase6_diagnostic.py` (new file) | 14 |
| `test_phase6_sse.py` (new file) | 2 |
| **Total new** | **16** |
| Previous total (end of Phase 5) | 310 |
| **Running total after Phase 6** | **326** |

---

## What Phase 7 Unlocks

With the backend fully assembled (Phases 1–6), Phase 7 can build the frontend `ResonanceSection.jsx` with confidence:

- **SSE event `resonance_graph`** is now emitted by Step 16 and fully structured
- **`dominant_signals` + `resonance_tier`** provide the macro-level badge/headline
- **`nodes`** provide per-entity bubble data (size = weight, colour = cultural_risk)
- **`edges`** provide semantic link lines between bubbles
- **`composite_resonance_score`** feeds directly into a `ScoreRing` reuse
- All data arrives as a single SSE event, no additional polling or HTTP calls needed

The visualization layer (Phase 7) is entirely a frontend concern — no backend changes required after Phase 6 is implemented.
