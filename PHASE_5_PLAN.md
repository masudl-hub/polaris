# PHASE 5 PLAN: Resonance Graph Assembly

## Overview

Phase 5 introduces the **Resonance Graph** — a composite signal aggregation layer that converges all outputs from Phases 1–4 (and the baseline pipeline) into a single weighted graph structure. Each named entity becomes a `SignalNode` carrying four orthogonal signal dimensions: momentum, cultural safety, sentiment, and platform affinity. Edges connect nodes by semantic similarity. A `composite_resonance_score` distils the full graph into a single float that Phase 6 will use as the narrative anchor for the upgraded executive diagnostic.

This is a **pure-computation, no-I/O step** — all input data is already computed by earlier pipeline stages. No new external API calls. No new pip packages (all math is done with `numpy`, already installed, and `word2vec_model`, already loaded).

---

## Goal

Produce a `ResonanceGraph` Pydantic model containing:
- `nodes: List[SignalNode]` — one per entity, carrying four signal weights
- `edges: List[SignalEdge]` — GloVe cosine similarity links between node pairs (threshold ≥ 0.30)
- `composite_resonance_score: float` — holistic score (0.0–1.0)
- `dominant_signals: List[str]` — top-3 entities by node `weight`
- `resonance_tier: str` — `"high"` / `"moderate"` / `"low"`

---

## Background: Why a Graph?

The current pipeline computes ~12 independent metrics with no shared coordinate system. The Executive Diagnostic (Step 13 currently) receives a 2,000-token JSON dump and must mentally integrate everything. Phase 5 pre-integrates them into a shared representational space so Phase 6 can narrate a far richer story: "Your top resonance node is *Nike* (momentum 0.87, zero cultural risk, sentiment 0.79, high platform fit) — it forms a semantic cluster with *running* and *performance* with similarity 0.61…"

---

## New Dependency: None

`networkx` was considered and explicitly rejected to avoid a new pip dependency. The graph is implemented as plain Python lists of `SignalNode` and `SignalEdge` Pydantic objects. All numeric operations use `numpy` (already installed as `numpy>=1.26.0,<2.0`). Semantic similarity between entity names uses the already-loaded `word2vec_model` (GloVe Twitter 50d, resident in memory since server start).

---

## New Models (`backend/models.py`)

### `SignalNode`

```python
class SignalNode(BaseModel):
    """A single entity in the resonance graph with four orthogonal signal dimensions."""
    entity: str = Field(description="Entity name (from NER output)")
    node_type: str = Field(default="topic", description="brand | person | location | event | audio | topic")
    momentum_score: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Trend momentum (0-1). From Phase 3 EntityAtomization if available, else Phase 0 TrendAnalysis.momentum, else 0.5 neutral.")
    cultural_risk: float = Field(ge=0.0, le=1.0, default=0.0,
        description="Cultural safety risk (0=safe, 1=high risk). From Phase 4 CulturalContext per-entity. Default 0.0.")
    sentiment_signal: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Sentiment alignment (0-1). Global RoBERTa sentiment_score applied uniformly across nodes (entity-level NLP is not run).")
    platform_affinity: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Platform fit (0-1). From vision platform_fit_score (1-10 → 0-1) if media present, else 0.5.")
    weight: float = Field(ge=0.0, le=1.0, default=0.5,
        description="Composite node weight = momentum * (1 - cultural_risk) * sentiment_signal * platform_affinity. Normalised to [0,1].")
```

**Weight formula** (per node $i$):

$$w_i = \text{momentum}_i \times (1 - \text{cultural\_risk}_i) \times \text{sentiment}_i \times \text{platform\_affinity}_i$$

No post-normalisation needed — the product of four values already clamped to [0,1] is already in [0,1]. However, a floor of `0.01` is applied so no node fully disappears (avoids zero-weight ghost nodes that still appear in the graph).

### `SignalEdge`

```python
class SignalEdge(BaseModel):
    """A weighted edge between two SignalNodes."""
    source: str = Field(description="Source entity name")
    target: str = Field(description="Target entity name")
    similarity: float = Field(ge=0.0, le=1.0,
        description="GloVe cosine similarity between entity embeddings. 0.0 if either entity OOV.")
```

Edges are **undirected** (stored once, `source < target` lexicographically to prevent duplicates). Minimum threshold: `similarity >= 0.30`. Only entity pairs where both have a GloVe vector are considered. OOV entity names (e.g. proper nouns with no GloVe entry) produce no edge.

### `ResonanceGraph`

```python
class ResonanceGraph(BaseModel):
    """Converged signal graph combining all pipeline outputs."""
    nodes: List[SignalNode] = Field(default_factory=list)
    edges: List[SignalEdge] = Field(default_factory=list)
    composite_resonance_score: float = Field(ge=0.0, le=1.0, default=0.0,
        description="Macro score = mean(node weights). 0.0 if no nodes.")
    dominant_signals: List[str] = Field(default_factory=list,
        description="Top-3 entity names sorted by node weight descending.")
    resonance_tier: str = Field(default="low",
        description="high (>=0.60) | moderate (>=0.35) | low (<0.35)")
    node_count: int = Field(default=0, description="Total number of signal nodes.")
    edge_count: int = Field(default=0, description="Total number of edges above similarity threshold.")
```

**Tier thresholds** (calibrated against the existing QS scale where 7–10 = high):
- `composite_resonance_score >= 0.60` → `"high"`
- `0.35 <= composite_resonance_score < 0.60` → `"moderate"`
- `composite_resonance_score < 0.35` → `"low"`

### `QuantitativeMetrics` update

Add one new Optional field (consistent with Phase 1–4 pattern):

```python
resonance_graph: Optional[ResonanceGraph] = Field(
    default=None,
    description="Resonance graph assembling all pipeline signals (Phase 5)"
)
```

---

## New Function: `assemble_resonance_graph()`

**Location**: `backend/main.py`, after `generate_executive_diagnostic()` and before the `# MAIN API ENDPOINT` comment block.

```python
def assemble_resonance_graph(
    entities: List[str],
    entity_atomization: Optional["EntityAtomization"],   # Phase 3
    cultural_context: Optional["CulturalContext"],        # Phase 4
    vision_analysis: Optional[VisionAnalysis],
    sentiment_score: Optional[float],
    geo: str = "US",
) -> ResonanceGraph:
    """
    Assemble the Resonance Graph from all prior pipeline signals.
    Pure computation — no I/O, no ML inference, no external calls.
    """
```

### Signal sourcing rules (priority order)

| Signal | Primary source | Fallback |
|--------|---------------|---------|
| `momentum_score` per entity | `entity_atomization.nodes[entity].momentum` (Phase 3) | `0.5` (neutral) |
| `cultural_risk` per entity | `cultural_context.entities[entity].risk_score` (Phase 4) | `0.0` (safe) |
| `sentiment_signal` | Global `sentiment_score` from RoBERTa (same value applied to all nodes) | `0.5` |
| `platform_affinity` | `(vision_analysis.platform_fit_score - 1.0) / 9.0` → [0,1] | `0.5` if score absent or no media |
| `node_type` | Inferred from spaCy entity label if available; else `"topic"` | `"topic"` |

### Entity-to-`node_type` mapping

```python
ENTITY_TYPE_MAP = {
    "ORG": "brand",
    "PRODUCT": "brand",
    "PERSON": "person",
    "GPE": "location",
    "LOC": "location",
    "EVENT": "event",
    "WORK_OF_ART": "topic",
    "NORP": "topic",
    "FAC": "location",
}
```

Since the function receives only the string entity names (NER labels are not carried forward), the default falls to `"topic"` for all. A future enhancement (Phase 6 or beyond) could pass the raw spaCy `Doc` to infer types. For now: all nodes are `"topic"` unless the entity perfectly matches a known brand pattern (heuristic: first letter capitalised, no spaces → `"brand"`; single word all-caps → `"brand"`).

### Edge computation

For all pairs `(a, b)` where `a < b` lexicographically:

```python
def _glove_cosine(word_a: str, word_b: str) -> float:
    """Return GloVe cosine similarity. 0.0 if either word OOV."""
    if word2vec_model is None:
        return 0.0
    a_lower = word_a.lower()
    b_lower = word_b.lower()
    if a_lower not in word2vec_model or b_lower not in word2vec_model:
        return 0.0
    va = word2vec_model[a_lower]
    vb = word2vec_model[b_lower]
    denom = (np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0:
        return 0.0
    return float(np.dot(va, vb) / denom)
```

Threshold: `similarity >= 0.30`. Multi-word entity names (e.g. "New York") use the first token only for GloVe lookup (GloVe Twitter 50d is unigram). If the lookup fails, the pair produces no edge.

### Composite score formula

$$\text{composite\_resonance\_score} = \frac{1}{N} \sum_{i=1}^{N} w_i$$

where $N$ is the number of nodes and $w_i$ is each node's `weight`. Empty entity list → score `0.0`, tier `"low"`.

### Full algorithm (pseudocode)

```
1. If no entities → return empty ResonanceGraph(composite=0.0, tier="low")

2. Build momentum_map: {entity → float} from entity_atomization.nodes if available
3. Build risk_map: {entity → float} from cultural_context.entities if available
4. Resolve platform_affinity (one value, shared across all nodes)
5. Resolve sentiment_signal (one value, shared across all nodes)
6. For each entity:
   a. momentum = momentum_map.get(entity, 0.5)
   b. risk = risk_map.get(entity, 0.0)
   c. weight = max(momentum * (1 - risk) * sentiment_signal * platform_affinity, 0.01)
   d. node_type = heuristic_type(entity)
   e. Append SignalNode(...)
7. Sort nodes by weight descending
8. dominant_signals = [n.entity for n in nodes[:3]]
9. composite_resonance_score = mean([n.weight for n in nodes])
10. resonance_tier = "high" if score>=0.60 else "moderate" if score>=0.35 else "low"
11. Compute edges: for all pairs (a,b), sim=_glove_cosine(a,b), if sim>=0.30 → SignalEdge
12. Return ResonanceGraph(nodes, edges, composite_resonance_score, dominant_signals, resonance_tier,
                          node_count=len(nodes), edge_count=len(edges))
```

---

## SSE Pipeline Integration

### New step position

Resonance Graph Assembly runs **after all per-step analytics** and **immediately before the Executive Diagnostic** — so it has access to all computed signals.

```
Step 1:  Visual Analysis + OCR          (Phase 1)
Step 2:  Audio Intelligence              (Phase 2)
Step 3:  Named Entity Recognition
Step 4:  Sentiment Analysis
Step 5:  Hashtag Expansion
Step 6:  Trend Forecasting
Step 7:  SEM Auction Simulation
Step 8:  Entity Atomization              (Phase 3)
Step 9:  Cultural Context                (Phase 4)
Step 10: Landing Page Coherence
Step 11: Reddit Community Sentiment
Step 12: Industry Benchmarks
Step 13: Trend-to-Creative Alignment
Step 14: Audience Alignment
Step 15: Competitor Analysis
Step 16: Resonance Graph Assembly        ← NEW Phase 5
Step 17: Executive Diagnostic
```

`total_steps` becomes `16` base (+1 for LinkedIn → 17).

### SSE code block (inserted before Step 17)

```python
# STEP 16: Resonance Graph Assembly (pure computation)
resonance_graph, evt = await run_step(
    "Resonance Graph Assembly",
    "GloVe cosine + multi-signal weighted fusion",
    "Entities: " + str(entities[:5]) + ", Phases: atomization=" + str(entity_atomization is not None)
    + ", cultural=" + str(cultural_context is not None),
    lambda: assemble_resonance_graph(
        entities=entities,
        entity_atomization=entity_atomization,
        cultural_context=cultural_context,
        vision_analysis=vision_analysis,
        sentiment_score=sentiment,
        geo=geo,
    ),
)
yield evt
if resonance_graph:
    yield "data: " + _json.dumps({'type': 'resonance_graph', 'data': resonance_graph.model_dump()}) + "\n\n"
```

`assemble_resonance_graph()` is synchronous → called via `run_step` → `asyncio.to_thread()`. This is consistent with all other sync steps (NER, Sentiment, Hashtag, Trend, SEM, etc.).

### `entity_atomization` and `cultural_context` variable wiring

In the current SSE endpoint, after Phases 3 and 4 are added, two new local variables will exist:
- `entity_atomization` — result of `run_entity_atomization()` (Phase 3), `None` if it failed
- `cultural_context` — result of `run_cultural_context()` (Phase 4), `None` if it failed

Both default to `None` safely — `assemble_resonance_graph()` handles `None` inputs gracefully.

### `QuantitativeMetrics` construction update

```python
quant_metrics = QuantitativeMetrics(
    text_data=text_analysis,
    vision_data=vision_analysis,
    trend_data=trend_data,
    sem_metrics=sem_metrics,
    industry_benchmark=benchmark_data,
    landing_page=lp_data,
    reddit_sentiment=reddit_data,
    creative_alignment=alignment_data,
    audience_analysis=audience_data,
    linkedin_analysis=linkedin_data,
    competitor_intel=competitor_data,
    media_decomposition=media_decomp,          # Phase 1
    entity_atomization=entity_atomization,     # Phase 3
    cultural_context=cultural_context,         # Phase 4
    resonance_graph=resonance_graph,           # Phase 5  ← NEW
)
```

### SSE event emitted

```json
{
  "type": "resonance_graph",
  "data": {
    "nodes": [
      {
        "entity": "Nike",
        "node_type": "brand",
        "momentum_score": 0.87,
        "cultural_risk": 0.0,
        "sentiment_signal": 0.72,
        "platform_affinity": 0.78,
        "weight": 0.487
      }
    ],
    "edges": [
      {
        "source": "Nike",
        "target": "running",
        "similarity": 0.61
      }
    ],
    "composite_resonance_score": 0.43,
    "dominant_signals": ["Nike", "running", "performance"],
    "resonance_tier": "moderate",
    "node_count": 5,
    "edge_count": 3
  }
}
```

---

## Sync Endpoint (`evaluate_ad`) Changes

The sync endpoint (`evaluate_ad`) must mirror the SSE changes:

```python
# After computing entity_atomization (Phase 3) and cultural_context (Phase 4):
resonance_graph = _step(
    "Resonance Graph Assembly",
    "GloVe cosine + multi-signal weighted fusion",
    "Entities: " + str(entities[:5]),
    lambda: assemble_resonance_graph(
        entities=entities,
        entity_atomization=entity_atomization,
        cultural_context=cultural_context,
        vision_analysis=vision_analysis,
        sentiment_score=sentiment,
        geo=geo,
    ),
)
```

And add `resonance_graph=resonance_graph` to the `QuantitativeMetrics(...)` constructor call.

---

## Helper Function: `_glove_cosine()`

**Location**: Add immediately above `assemble_resonance_graph()`.

```python
def _glove_cosine(word_a: str, word_b: str) -> float:
    """
    Return cosine similarity between two GloVe Twitter 50d vectors.
    Returns 0.0 if either word is out-of-vocabulary or the model is unavailable.
    Multi-word inputs: only the first whitespace-delimited token is used.
    """
    if word2vec_model is None:
        return 0.0
    a_key = word_a.split()[0].lower() if word_a else ""
    b_key = word_b.split()[0].lower() if word_b else ""
    if not a_key or not b_key or a_key not in word2vec_model or b_key not in word2vec_model:
        return 0.0
    va = word2vec_model[a_key]
    vb = word2vec_model[b_key]
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0
```

**Note**: `word2vec_model` is a `gensim.models.KeyedVectors` instance already loaded at startup (used by `run_word2vec_expansion()`). The `in` operator checks vocabulary membership in O(1).

---

## Imports Required

No new imports needed. The following are already present in `backend/main.py`:
- `import numpy as np` — already used? If not present: add to existing import block (numpy is installed).
- `word2vec_model` — module-level global, already loaded at line ~100 (`gensim.downloader.load('glove-twitter-50')`).

Verify `numpy` import is present via `grep "import numpy"`. If absent, add `import numpy as np` alongside the other stdlib/third-party imports at the top.

---

## Tests

### Test File: `backend/tests/test_phase5_resonance_graph.py`

**Target: 28 new tests**

#### Group A: Core function — basic entity handling (8 tests)

```
test_assemble_empty_entities_returns_empty_graph
  → entities=[] → ResonanceGraph(node_count=0, edge_count=0, composite_resonance_score=0.0, tier="low")

test_assemble_single_entity_no_phases
  → entities=["Nike"], no atomization/cultural context → 1 node, weight computed from defaults

test_assemble_single_entity_default_signals
  → verify default: momentum=0.5, risk=0.0, sentiment=0.5, affinity=0.5 → weight=0.5*1.0*0.5*0.5=0.125

test_assemble_uses_atomization_momentum
  → inject mock EntityAtomization with entity momentum=0.9 → node.momentum_score == 0.9

test_assemble_uses_cultural_risk
  → inject mock CulturalContext with entity risk_score=0.8 → node.cultural_risk == 0.8

test_assemble_cultural_risk_penalizes_weight
  → risk=0.8 reduces weight vs risk=0.0 (same entity, same other signals)

test_assemble_platform_affinity_from_vision
  → VisionAnalysis(platform_fit_score=8.0) → platform_affinity = (8.0-1.0)/9.0 ≈ 0.778

test_assemble_platform_affinity_no_vision
  → vision_analysis=None → platform_affinity == 0.5 (neutral default)
```

#### Group B: Composite score + tier (7 tests)

```
test_composite_score_is_mean_of_weights
  → 3 nodes with known weights → verify score = mean(weights)

test_composite_score_clamped_0_to_1
  → pathological inputs can't produce score > 1.0 or < 0.0

test_resonance_tier_high
  → force all nodes to produce mean weight >= 0.60 → tier == "high"

test_resonance_tier_moderate
  → force mean weight in [0.35, 0.60) → tier == "moderate"

test_resonance_tier_low
  → force mean weight < 0.35 → tier == "low"

test_dominant_signals_are_top_3
  → 6 nodes → dominant_signals contains the 3 highest-weight entity names

test_dominant_signals_fewer_than_3_nodes
  → 2 nodes → dominant_signals has length 2 (no padding)
```

#### Group C: Edge computation (7 tests)

```
test_no_edges_when_model_unavailable
  → mock word2vec_model=None → edges == []

test_no_edges_all_oov_entities
  → entities entirely absent from GloVe vocabulary → edges == []

test_edge_created_above_threshold
  → two entities with known GloVe sim > 0.30 → edge created with correct similarity

test_no_edge_below_threshold
  → mock _glove_cosine to return 0.25 for a pair → no edge created

test_edges_are_deduplicated
  → n entities → at most n*(n-1)/2 edges (no duplicate pairs)

test_edge_source_lt_target_lexicographic
  → edges always stored with source < target lexicographically

test_edge_count_matches_edges_list_length
  → resonance_graph.edge_count == len(resonance_graph.edges)
```

#### Group D: Model validation (6 tests, added to existing `test_models.py`)

```
test_signal_node_weight_field_bounds
  → weight must be ge=0.0, le=1.0

test_signal_edge_similarity_bounds
  → similarity must be ge=0.0, le=1.0

test_resonance_graph_default_construction
  → ResonanceGraph() → all defaults valid, no ValidationError

test_resonance_graph_with_nodes_and_edges
  → full construction with nodes + edges → round-trip JSON

test_quantitative_metrics_resonance_graph_field
  → QuantitativeMetrics(text_data=..., vision_data=..., sem_metrics=...) → resonance_graph defaults to None

test_quantitative_metrics_accepts_resonance_graph
  → Pass populated ResonanceGraph → no ValidationError
```

**Total new tests: 28**
**Running total after Phase 5: 282 + 28 = 310 tests**

---

## Fixtures Required

### In `conftest.py` — two new fixtures

```python
@pytest.fixture
def sample_resonance_graph_data():
    return {
        "nodes": [
            {
                "entity": "Nike",
                "node_type": "brand",
                "momentum_score": 0.75,
                "cultural_risk": 0.1,
                "sentiment_signal": 0.70,
                "platform_affinity": 0.80,
                "weight": 0.378,
            }
        ],
        "edges": [],
        "composite_resonance_score": 0.378,
        "dominant_signals": ["Nike"],
        "resonance_tier": "moderate",
        "node_count": 1,
        "edge_count": 0,
    }

@pytest.fixture
def mock_word2vec_model():
    """Minimal GloVe-like mock with 50d vectors for test entities."""
    class MockKeyedVectors:
        def __contains__(self, key):
            return key in {"nike", "running", "performance", "sport"}
        def __getitem__(self, key):
            import numpy as np
            rng = {"nike": 0, "running": 1, "performance": 2, "sport": 3}
            np.random.seed(rng.get(key, 99))
            return np.random.rand(50).astype(np.float32)
    return MockKeyedVectors()
```

### Mock patching pattern for GloVe

In tests that need to test edge computation without the real 150MB GloVe model:

```python
with patch("main.word2vec_model", mock_word2vec_model):
    result = assemble_resonance_graph(entities=["Nike", "running"], ...)
```

---

## Implementation Notes

### 1. Handling Phase 3 `EntityAtomization` data

After Phase 3 is implemented, `run_entity_atomization()` returns an `EntityAtomization` with `nodes: List[EntityNode]`. The `momentum_map` lookup is:

```python
momentum_map: Dict[str, float] = {}
if entity_atomization and entity_atomization.nodes:
    for node in entity_atomization.nodes:
        momentum_map[node.entity] = node.momentum_score if node.momentum_score is not None else 0.5
```

### 2. Handling Phase 4 `CulturalContext` data

After Phase 4 is implemented, `run_cultural_context()` returns a `CulturalContext` with `entities: List[EntityCulturalContext]`. The `risk_map` lookup is:

```python
risk_map: Dict[str, float] = {}
if cultural_context and cultural_context.entities:
    for ec in cultural_context.entities:
        risk_map[ec.entity] = ec.risk_score if ec.risk_score is not None else 0.0
```

### 3. GloVe OOV behaviour

GloVe Twitter 50d contains ~1.2 million tokens. Proper nouns (brand names, celebrities, locations) are often present in lowercase form. The `.lower()` normalisation before lookup significantly increases hit rate. Expected hit rate: ~60–70% of extracted NER entities. OOV entities simply produce no edges, which is the correct graceful degradation.

### 4. Weight floor

`weight = max(computed_weight, 0.01)` prevents zero-weight nodes from silently disappearing. A node with `weight=0.01` still appears in the graph (and in the SSE payload) but will not appear in `dominant_signals` unless all other nodes are also near zero.

### 5. Phase 5 does NOT change `EvaluationResponse`.

`ResonanceGraph` is a field on `QuantitativeMetrics` (consistent with Phases 1–4 pattern). `EvaluationResponse` remains unchanged:

```python
class EvaluationResponse(BaseModel):
    status: str = "success"
    quantitative_metrics: QuantitativeMetrics   # now carries resonance_graph
    executive_diagnostic: str
    pipeline_trace: List[PipelineStep]
```

Phase 6 does not need to change `EvaluationResponse` either — the diagnostic is already a plain `str` field that Phase 6 will improve by enriching what Gemini is given.

---

## Full `QuantitativeMetrics` Evolution (all 5 phases)

| Phase | New field |
|-------|-----------|
| 0 (baseline) | `text_data`, `vision_data`, `trend_data`, `sem_metrics`, `industry_benchmark`, `landing_page`, `reddit_sentiment`, `creative_alignment`, `audience_analysis`, `linkedin_analysis`, `competitor_intel` |
| 1 | `media_decomposition: Optional[MediaDecomposition]` |
| 2 | *(no new field — SongIdentification lives inside `media_decomposition.audio`)* |
| 3 | `entity_atomization: Optional[EntityAtomization]` |
| 4 | `cultural_context: Optional[CulturalContext]` |
| **5** | **`resonance_graph: Optional[ResonanceGraph]`** |

---

## Files Changed

| File | Change |
|------|--------|
| `backend/models.py` | Add `SignalNode`, `SignalEdge`, `ResonanceGraph`; add `resonance_graph` field to `QuantitativeMetrics` |
| `backend/main.py` | Add `_glove_cosine()`, `assemble_resonance_graph()`; integrate as Step 16 in SSE + sync; update `total_steps`; update `QuantitativeMetrics(...)` constructor call |
| `backend/tests/test_phase5_resonance_graph.py` | **New file** — 22 tests |
| `backend/tests/test_models.py` | +6 model tests |
| `backend/tests/conftest.py` | +2 fixtures: `sample_resonance_graph_data`, `mock_word2vec_model` |

---

## Test Count Summary

| Location | New Tests |
|----------|-----------|
| `test_phase5_resonance_graph.py` (new file) | 22 |
| `test_models.py` additions | 6 |
| **Total new** | **28** |
| Previous total (end of Phase 4) | 282 |
| **Running total after Phase 5** | **310** |

---

## What Phase 6 Unlocks

The `ResonanceGraph` on `quant_metrics` gives Phase 6's upgraded `generate_executive_diagnostic()` a dramatically richer input:

- **Dominant signals** → Gemini narrates the top-3 nodes by name, citing their weight and tier
- **Resonance tier** → Gemini opens with "This campaign's resonance is classified as **moderate**…"
- **Edge structure** → Gemini identifies semantic clusters ("Nike and running are closely linked with similarity 0.61, suggesting a coherent brand-sport message that will resonate well with your audience")
- **Cultural risk nodes** → Gemini can say "The entity [X] carries elevated cultural risk (0.72); consider replacing or reframing"
- **Comparison to platform norms** → Combined with `platform_fit_score`, Gemini links visual performance to signal weight

This structured, pre-interpreted graph replaces the current 2,000-token raw JSON dump with a ~300-token dense signal summary, enabling Gemini to write a more focused, more actionable diagnostic in ~30% fewer output tokens.
