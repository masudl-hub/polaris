# Phase 3: Entity Atomization

**Goal**: Replace the averaged batch trend profile with independent per-entity trend profiles. Each entity extracted by spaCy NER gets its own momentum, time series, related queries, and regional interest. This is the signal-density foundation that Phase 5 (Resonance Graph) will assemble into weighted nodes.

**Gemini Model**: No Gemini calls in Phase 3. This is pure pytrends work.

**Prerequisite**: Phase 1 and Phase 2 complete. Phase 3 has no dependency on Phase 2 output but does depend on Phase 1's `MediaDecomposition` existing in `QuantitativeMetrics` (Phase 3 adds another field alongside it).

---

## 1. The Problem with Batch Trend Analysis

### Current behavior (post-Phase 2 baseline)

```python
# backend/main.py — STEP 5 in SSE endpoint
trend_data, evt = await run_step(
    "Trend Forecasting", "Google Trends (pytrends: momentum + related + regions)",
    "Keywords: " + str(entities[:5]) + ", Geo: " + geo,
    lambda: run_trend_analysis(entities, geo),
)
trend_momentum = trend_data.momentum if trend_data else None
```

**Inside `run_trend_analysis(entities, geo)` (lines ~441-540)**:
```python
keywords = entities[:5]
pytrends = _pytrends_with_retry(keywords, geo)

df = pytrends.interest_over_time()
if not df.empty:
    avg_series = df.mean(axis=1)   # <-- ALL keywords averaged together
    recent_7d = avg_series.tail(7).mean()
    recent_30d = avg_series.tail(30).mean()
    momentum = round(1.0 / (1.0 + math.exp(-3.0 * (raw - 1.0))), 4)
```

**The averaging problem**: If entities are `["Nike", "Adidas", "Climate Change", "Paris", "Olympics"]`, pytrends returns a DataFrame with 5 columns. `df.mean(axis=1)` averages all 5 together into a single number. "Nike" at 0.65 and "Climate Change" at 0.81 collapse to a meaningless ~0.72.

**The related-queries problem**: When 5 keywords are batched together, `related_queries()` returns queries for the batch as a whole — often the dominant keyword drowns out the others. "Nike" will generate 8 related queries, "Paris" gets 0.

**What we lose**: Each entity has a distinct signal profile. A brand entity (Nike) has different momentum dynamics than a topical entity (Climate Change) or a location entity (Paris). Averaging destroys this distinction entirely.

### What Phase 3 provides

For entities `["Nike", "Adidas", "Paris"]`:

| Entity | Momentum | Rising Queries | Top Region |
|--------|----------|---------------|-----------|
| Nike | 0.61 | "nike dunk", "air max 2025" | US |
| Adidas | 0.54 | "adidas samba", "adidas originals" | DE |
| Paris | 0.73 | "paris olympics", "paris fashion week" | FR |

Each entity becomes an independent signal node. Phase 5 assembles these into the resonance graph.

---

## 2. Current State — Exact Code Structure

### `run_trend_analysis()` — the function Phase 3 wraps around (NOT replaces)

**Location**: `backend/main.py`, lines ~440–540
**Signature**: `run_trend_analysis(entities: List[str], geo: str) -> Optional[TrendAnalysis]`

Key internals reused by Phase 3:
- `_pytrends_with_retry(keywords, geo)` — the retry helper (lines ~422–438). Phase 3 calls this with a single-element list.
- The momentum sigmoid formula: `round(1.0 / (1.0 + math.exp(-3.0 * (raw - 1.0))), 4)` — Phase 3 uses the **identical formula** for consistency.
- The related-queries fallback (retry with lowercase keywords) — Phase 3 replicates this.

**`run_trend_analysis()` stays 100% unchanged.** It still runs as STEP 5 in both endpoints and still provides `trend_momentum` to the SEM step. It is not refactored. Phase 3 is purely additive.

### `TrendAnalysis` model — unchanged

```python
class TrendAnalysis(BaseModel):
    momentum: Optional[float]
    related_queries_top: List[str]
    related_queries_rising: List[str]
    top_regions: List[dict]
    keywords_searched: List[str]
    data_points: int
    time_series: List[float]
```

This model stays exactly as-is. `QuantitativeMetrics.trend_data` still holds `TrendAnalysis`. Frontend still receives `trend_data` SSE event. All Phase 0+1+2 tests that use `TrendAnalysis` are untouched.

### Where STEP 5 (Trend) sits in the SSE pipeline (post-Phase 2)

| Step | Name | After Phase 2 |
|------|------|-------------|
| 1 | Visual Analysis + OCR | `run_media_decomposition()` |
| 2 | Audio Intelligence | `run_audio_intelligence()` (video only) |
| 3 | Named Entity Recognition | `run_ner()` |
| 4 | Sentiment Analysis | `run_sentiment()` |
| 5 | Hashtag Expansion | `run_word2vec_expansion()` |
| 6 | Trend Forecasting | `run_trend_analysis(entities, geo)` → `trend_momentum` |
| 7 | SEM Auction Simulation | `calculate_sem_metrics(trend_momentum=trend_momentum, ...)` |
| 8 | Landing Page Coherence | async httpx |
| 9 | Reddit Community Sentiment | async httpx + RoBERTa |
| 10 | Industry Benchmarks | static JSON |
| 11 | Trend-to-Creative Alignment | GloVe cosine |
| 12 | Audience Analysis | sentence-transformers |
| 13 | LinkedIn Analysis | optional |
| 14/13 | Competitor Analysis | Meta Ad Library |
| last | Executive Diagnostic | Gemini 3 Flash |

**Phase 3 adds a new step** — "Entity Atomization" — placed at **Step 8** (between SEM and Landing Page). Rationale: the critical-path steps (NER → Sentiment → Hashtag → Trend → SEM) all complete first without adding latency. Entity atomization (potentially slow, 5 sequential pytrends calls with 2s sleeps) runs while the user sees SEM results populating, well into the pipeline.

**After Phase 3, step sequence**:

| Step | Name |
|------|------|
| 1–7 | unchanged |
| **8** | **Entity Atomization (NEW)** |
| 9+ | Landing Page, Reddit, Benchmarks, ... (shift +1) |

---

## 3. Phase 3 Deliverables

### 3a. New Pydantic Models in `backend/models.py`

Add two new models. Insert **after** `TrendAnalysis` and **before** `IndustryBenchmark`.

#### `EntityNode`

```python
class EntityNode(BaseModel):
    """Per-entity trend profile from a single pytrends query."""
    name: str = Field(description="Entity name as extracted by spaCy NER")
    momentum: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="7d vs 30d momentum (0-1 sigmoid scale). None if pytrends returned no data."
    )
    related_queries_top: List[str] = Field(
        default_factory=list,
        description="Top related search queries for this entity (up to 8)"
    )
    related_queries_rising: List[str] = Field(
        default_factory=list,
        description="Rising/breakout search queries for this entity (up to 5)"
    )
    top_regions: List[dict] = Field(
        default_factory=list,
        description="Top 5 regions for this entity [{name, interest}] — interest is 0-100"
    )
    time_series: List[float] = Field(
        default_factory=list,
        description="Daily interest values over 90 days (0-100 scale, pytrends normalized)"
    )
```

#### `EntityAtomization`

```python
class EntityAtomization(BaseModel):
    """Collection of per-entity trend profiles for all entities found in the ad."""
    nodes: List[EntityNode] = Field(
        description="One EntityNode per entity, ordered by spaCy extraction order"
    )
    aggregate_momentum: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="Median of all node momenta. More robust than mean for heterogeneous entity sets. "
                    "None if no nodes have momentum data."
    )
```

**Why median not mean**: If entities are `["Nike" (0.61), "Paris" (0.73), "Olympics" (0.88)]`, median = 0.73 (the middle signal). Mean = 0.74. For skewed sets where one outlier entity dominates, median is more stable. In Phase 5 (Resonance Graph), individual node momenta matter more than the aggregate anyway.

**Modify `QuantitativeMetrics`** — add one optional field (everything else unchanged):

```python
class QuantitativeMetrics(BaseModel):
    text_data: TextAnalysis
    vision_data: VisionAnalysis
    media_decomposition: Optional[MediaDecomposition] = ...   # Phase 1
    trend_data: Optional[TrendAnalysis] = ...
    entity_atomization: Optional[EntityAtomization] = Field(  # Phase 3 — NEW
        default=None,
        description="Per-entity trend profiles. Supplements trend_data which is a batch average."
    )
    sem_metrics: SEMMetrics
    # ... rest unchanged
```

**Placement of `entity_atomization` field**: After `trend_data`, before `sem_metrics`. This preserves the narrative order of the pipeline. `EvaluationResponse` stays entirely unchanged.

---

### 3b. New Functions in `backend/main.py`

Insert both functions **between `run_trend_analysis()` and `PLATFORM_CPC_MULTIPLIER`** — i.e., at line ~542 after the `run_trend_analysis()` function body.

Also add `import statistics` to the imports at the top of `backend/main.py`. `statistics` is Python stdlib — no pip install.

---

#### Function 1: `run_entity_trend_profile()`

**Signature**: `run_entity_trend_profile(entity: str, geo: str) -> Optional[EntityNode]`

**Full implementation**:

```python
def run_entity_trend_profile(entity: str, geo: str) -> Optional[EntityNode]:
    """
    Profile a single entity via pytrends: momentum + related queries + regional interest.
    Near-identical logic to run_trend_analysis() but for one entity only.
    Uses _pytrends_with_retry() with a single-element keyword list.
    Uses the same sigmoid formula as run_trend_analysis() for momentum consistency.
    """
    if not entity or not entity.strip():
        return None

    keywords = [entity.strip()]

    try:
        pytrends = _pytrends_with_retry(keywords, geo)

        # 1. Interest over time → momentum (identical formula to run_trend_analysis)
        momentum = None
        df = pytrends.interest_over_time()
        if not df.empty:
            if "isPartial" in df.columns:
                df = df.drop(columns=["isPartial"])
            avg_series = df.mean(axis=1)  # with 1 keyword, mean(axis=1) = the single column
            recent_7d = avg_series.tail(7).mean()
            recent_30d = avg_series.tail(30).mean()
            if recent_30d > 0:
                raw = recent_7d / recent_30d
                momentum = round(1.0 / (1.0 + math.exp(-3.0 * (raw - 1.0))), 4)

        # 2. Related queries
        related_top = []
        related_rising = []
        try:
            rq = pytrends.related_queries()
            for kw, data in rq.items():
                if data.get("top") is not None:
                    related_top.extend(data["top"]["query"].head(8).tolist())
                if data.get("rising") is not None:
                    related_rising.extend(data["rising"]["query"].head(5).tolist())
        except Exception:
            pass

        # Fallback: retry with lowercase if proper noun returned nothing
        if not related_top and not related_rising and entity != entity.lower():
            try:
                pytrends.build_payload([entity.lower()], cat=0, timeframe="today 3-m", geo=geo)
                rq2 = pytrends.related_queries()
                for kw, data in rq2.items():
                    if data.get("top") is not None:
                        related_top.extend(data["top"]["query"].head(8).tolist())
                    if data.get("rising") is not None:
                        related_rising.extend(data["rising"]["query"].head(5).tolist())
            except Exception:
                pass

        # 3. Interest by region
        top_regions = []
        try:
            ibr = pytrends.interest_by_region(resolution="COUNTRY", inc_low_vol=False)
            if not ibr.empty:
                avg_interest = ibr.mean(axis=1)
                top5 = avg_interest.nlargest(5)
                top_regions = [{"name": name, "interest": int(val)} for name, val in top5.items() if val > 0]
        except Exception:
            pass

        # Deduplicate
        related_top = list(dict.fromkeys(related_top))[:8]
        related_rising = list(dict.fromkeys(related_rising))[:5]

        # Time series for sparkline
        time_series = []
        if not df.empty:
            avg_series = df.mean(axis=1)
            time_series = [round(float(v), 1) for v in avg_series.tolist()]

        return EntityNode(
            name=entity,
            momentum=momentum,
            related_queries_top=related_top,
            related_queries_rising=related_rising,
            top_regions=top_regions,
            time_series=time_series,
        )

    except Exception as e:
        print(f"Entity trend profile error for '{entity}': {e}")
        return None
```

**Why it mirrors `run_trend_analysis()` so closely**: Consistency is intentional. Both use the exact same sigmoid formula so that momentum values from `EntityNode.momentum` and `TrendAnalysis.momentum` are directly comparable. If a downstream consumer (Phase 5 resonance graph) compares node momentum to the aggregate trend momentum, they're on the same scale.

---

#### Function 2: `run_entity_atomization()`

**Signature**: `run_entity_atomization(entities: List[str], geo: str) -> Optional[EntityAtomization]`

**Full implementation**:

```python
def run_entity_atomization(entities: List[str], geo: str) -> Optional[EntityAtomization]:
    """
    Profile each entity independently via pytrends (up to 5 entities).
    Sequential calls with 2s sleep between each to respect pytrends rate limits.
    Returns EntityAtomization with per-entity nodes + aggregate median momentum.
    
    Note: This function can take up to 40 seconds (5 entities × ~8s each).
    It is called in an asyncio.to_thread() executor to avoid blocking the event loop.
    """
    if not entities:
        return None

    nodes = []
    for i, entity in enumerate(entities[:5]):  # max 5 to cap latency
        if i > 0:
            time.sleep(2)  # 2s throttle between requests — prevents 429 from Google Trends
        node = run_entity_trend_profile(entity, geo)
        if node is not None:
            nodes.append(node)

    if not nodes:
        return None

    # Aggregate momentum: median of nodes that have non-None momentum
    # Requires stdlib statistics (imported at top)
    momenta = [n.momentum for n in nodes if n.momentum is not None]
    agg_momentum = round(statistics.median(momenta), 4) if len(momenta) >= 1 else None

    return EntityAtomization(nodes=nodes, aggregate_momentum=agg_momentum)
```

**Import needed**: `import statistics` — add to `backend/main.py` imports. Python stdlib, no pip install.

**Why `time.sleep(2)` between calls**: 
- pytrends rate limits are enforced per IP by Google Trends. In production, consecutive calls within ~1 second consistently trigger 429s. 
- The existing `_pytrends_with_retry()` handles 429s with exponential backoff, but it's better to not trigger them in the first place. 2 seconds has been empirically reliable.
- Total worst-case: 5 entities × (pytrends call ~3s + sleep 2s) = ~25 seconds. Acceptable for this pipeline position (after SEM, before the async steps).

---

### 3c. Wire into SSE Endpoint (`evaluate_ad_stream`)

**Location**: `backend/main.py`, inside `event_stream()`.

**Placement**: After STEP 7 (SEM), before STEP 8 (Landing Page). Insert:

```python
# STEP 8: Entity Atomization (per-entity trend profiles)
yield send_starting("Entity Atomization", "Google Trends (pytrends, per-entity)", total_steps)
entity_atomization, evt = await run_step(
    "Entity Atomization", "Google Trends (pytrends, per-entity — 1 call per entity)",
    "Entities: " + str(entities[:5]) + ", Geo: " + geo,
    lambda: run_entity_atomization(entities, geo),
)
yield evt
if entity_atomization is not None:
    yield "data: " + _json.dumps({
        "type": "entity_atomization_data",
        "data": entity_atomization.model_dump()
    }) + "\n\n"
```

**Update `total_steps`**: Add 1. Before Phase 3: `total_steps = 13` (or 14 for LinkedIn). After Phase 3:

```python
total_steps = 14
if platform.lower() == "linkedin" and post_type:
    total_steps += 1
```

**The old STEP 8–onwards**: Landing Page becomes STEP 9, Reddit becomes STEP 10, etc. The `step_num` counter handles this automatically — no manual renumbering required since it increments via `send_step()`.

---

### 3d. Wire into Sync Endpoint (`evaluate_ad`)

**Location**: `backend/main.py`, sync endpoint, after STEP 5 (Trend Forecasting), before STEP 6 (SEM).

Wait — in the **sync endpoint**, SEM is STEP 6 and comes immediately after Trend (STEP 5). Entity atomization must also insert between them. Use the sync `_step()` helper:

```python
# STEP between Trend and SEM in sync endpoint:
entity_atomization = _step(
    "Entity Atomization", "Google Trends (pytrends, per-entity)",
    f"Entities: {entities[:5]}, Geo: {geo}",
    lambda: run_entity_atomization(entities, geo),
)
```

**Note on sync endpoint**: It uses synchronous `_step()` which calls `fn()` directly (no asyncio executor). `run_entity_atomization()` is synchronous, so this is fine — the sync endpoint is already blocking.

---

### 3e. Update `QuantitativeMetrics(...)` instantiation

Both endpoints build a `QuantitativeMetrics` object. Add the new field in both places:

**SSE endpoint** (around line ~1800, post-Phase 2):
```python
quant_metrics = QuantitativeMetrics(
    text_data=text_analysis,
    vision_data=vision_analysis,
    media_decomposition=media_decomp,       # Phase 1
    trend_data=trend_data,
    entity_atomization=entity_atomization,  # Phase 3 (NEW)
    sem_metrics=sem_metrics,
    industry_benchmark=benchmark_data,
    landing_page=lp_data,
    reddit_sentiment=reddit_data,
    creative_alignment=alignment_data,
    audience_analysis=audience_data,
    linkedin_analysis=linkedin_data,
    competitor_intel=competitor_data,
)
```

**Sync endpoint**: Same addition.

---

## 4. Testing Strategy

### New Test File: `backend/tests/test_entity_atomization.py`
~250 lines, 20 tests, 5 classes.

**Class: `TestRunEntityTrendProfile`** (7 tests)

| Test | What it validates |
|------|------------------|
| `test_empty_entity_returns_none` | `run_entity_trend_profile("", geo)` → `None` |
| `test_whitespace_entity_returns_none` | `run_entity_trend_profile("  ", geo)` → `None` |
| `test_valid_entity_returns_entity_node` | Mock pytrends → returns `EntityNode` with correct `name` field |
| `test_momentum_computed_from_mock_data` | Mock DataFrame with known 7d/30d values → `momentum` matches expected sigmoid output |
| `test_momentum_none_when_no_data` | Empty DataFrame from pytrends → `momentum=None`, no crash |
| `test_related_queries_populated` | Mock related_queries returns data → `related_queries_top` populated |
| `test_pytrends_exception_returns_none` | `_pytrends_with_retry` raises → returns `None`, no crash |

**Class: `TestRunEntityAtomization`** (6 tests)

| Test | What it validates |
|------|------------------|
| `test_empty_entities_returns_none` | `run_entity_atomization([], geo)` → `None` |
| `test_single_entity_returns_one_node` | 1 entity → `EntityAtomization` with 1 node |
| `test_multiple_entities_returns_multiple_nodes` | 3 entities → 3 `EntityNode` objects |
| `test_max_five_entities_capped` | 7 entities passed → only 5 profiled |
| `test_all_nodes_fail_returns_none` | All `run_entity_trend_profile` calls return `None` → `run_entity_atomization` returns `None` |
| `test_partial_failure_skips_failed_nodes` | 3 entities, 1 fails → 2 nodes returned (not 3) |

**Class: `TestAggregatesMomentum`** (4 tests)

| Test | What it validates |
|------|------------------|
| `test_aggregate_momentum_is_median` | 3 nodes with momenta [0.3, 0.7, 0.5] → `aggregate_momentum=0.5` |
| `test_aggregate_momentum_odd_count` | 3 nodes with momenta [0.1, 0.9, 0.5] → `aggregate_momentum=0.5` |
| `test_aggregate_momentum_none_when_all_none` | All nodes have `momentum=None` → `aggregate_momentum=None` |
| `test_aggregate_ignores_none_momenta` | Nodes [0.4, None, 0.8] → median of [0.4, 0.8] = 0.6 |

**Class: `TestSleepThrottling`** (2 tests)

| Test | What it validates |
|------|------------------|
| `test_sleep_called_between_entities` | Mock `time.sleep` — called `len(entities)-1` times |
| `test_no_sleep_for_single_entity` | 1 entity → `time.sleep` NOT called |

**Class: `TestModelBackwardCompat`** (1 test)

| Test | What it validates |
|------|------------------|
| `test_quant_metrics_without_entity_atomization` | `QuantitativeMetrics(entity_atomization=None, ...)` → valid (backward compat) |

---

### Updates to Existing Test Files

**`backend/tests/test_models.py`** — Add `TestEntityAtomizationModels` class (10 tests):

| Test | What it validates |
|------|------------------|
| `test_entity_node_all_fields` | Valid `EntityNode` construction with all fields |
| `test_entity_node_defaults` | `EntityNode(name="Nike")` → `momentum=None`, empty lists |
| `test_entity_node_momentum_ge_0` | `momentum=-0.1` → `ValidationError` |
| `test_entity_node_momentum_le_1` | `momentum=1.1` → `ValidationError` |
| `test_entity_atomization_construction` | Valid `EntityAtomization` with 3 nodes |
| `test_entity_atomization_empty_nodes` | `EntityAtomization(nodes=[])` → valid (empty is allowed) |
| `test_entity_atomization_aggregate_none` | `aggregate_momentum=None` is valid |
| `test_entity_atomization_aggregate_range` | `aggregate_momentum=0.5` — in range [0, 1] |
| `test_quant_metrics_accepts_entity_atomization` | `QuantitativeMetrics(entity_atomization=EntityAtomization(...), ...)` → valid |
| `test_quant_metrics_entity_atomization_defaults_none` | Construct `QuantitativeMetrics` without `entity_atomization` → field is `None` |

**`backend/tests/test_api_stream.py`** — Add 2 tests:

| Test | What it validates |
|------|------------------|
| `test_entity_atomization_event_in_stream` | With mocked pytrends → `entity_atomization_data` event appears in SSE stream |
| `test_entity_atomization_absent_for_no_entities` | Empty ad text → no entities → `entity_atomization_data` event absent (or present with empty nodes) |

**Expected test counts**:
- 214 baseline (after Phase 2)
- 20 new `test_entity_atomization.py` tests
- 10 new `test_models.py` tests
- 2 new `test_api_stream.py` tests
- **Total: 214 + 32 = 246 tests passing**

---

## 5. Frontend Changes

### `frontend-react/src/hooks/useAnalysis.js`

**Add `entityAtomization: null` to `INITIAL_STORE`**:
```javascript
const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  mediaDecomposition: null,     // Phase 1
  audioIntelligence: null,      // Phase 2
  entityAtomization: null,      // Phase 3 (NEW)
  sentiment: null,
  trends: null,
  // ...rest unchanged
}
```

**Add handler in SSE event loop**:
```javascript
} else if (evt.type === 'entity_atomization_data') {
  setStore(prev => ({ ...prev, entityAtomization: evt.data }))
}
```

### `frontend-react/src/components/results/EntityAtomizationSection.jsx` (NEW)

Per-entity trend cards — the first preview of what becomes nodes in Phase 7:

```jsx
import React from 'react'

function MomentumBar({ value }) {
  if (value == null) return <span className="ea-momentum-na">No data</span>
  const pct = Math.round(value * 100)
  return (
    <div className="ea-momentum-bar">
      <div className="ea-momentum-fill" style={{ width: `${pct}%` }} />
      <span className="ea-momentum-label">{pct}%</span>
    </div>
  )
}

export function EntityAtomizationSection({ data }) {
  if (!data || !data.nodes || data.nodes.length === 0) return null

  return (
    <div className="entity-atomization-section">
      <h3>Entity Signal Profiles</h3>
      {data.aggregate_momentum != null && (
        <div className="ea-aggregate">
          Aggregate Momentum: {Math.round(data.aggregate_momentum * 100)}%
        </div>
      )}
      <div className="ea-nodes">
        {data.nodes.map((node) => (
          <div key={node.name} className="ea-node-card">
            <div className="ea-node-name">{node.name}</div>
            <MomentumBar value={node.momentum} />
            {node.related_queries_rising.length > 0 && (
              <div className="ea-rising">
                Rising: {node.related_queries_rising.slice(0, 3).join(', ')}
              </div>
            )}
            {node.top_regions.length > 0 && (
              <div className="ea-regions">
                Top region: {node.top_regions[0].name}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Note**: No sparkline charts yet — Phase 7 will build the full visualization. Phase 3 frontend is intentionally minimal. The `time_series` data is stored in `store.entityAtomization` but not rendered yet.

### `frontend-react/src/components/Results.jsx`

```jsx
import { EntityAtomizationSection } from './results/EntityAtomizationSection'

// After TrendsSection:
{store.entityAtomization && <EntityAtomizationSection data={store.entityAtomization} />}
```

### Frontend Tests

Add 2 tests to `useAnalysis.test.js`:
- `test_initial_store_has_entity_atomization_null` — `store.entityAtomization` starts as `null`
- `test_entity_atomization_event_populates_store` — `entity_atomization_data` SSE event → `store.entityAtomization` populated

---

## 6. Full Execution Checklist

### Backend (in order)
- [ ] Add `import statistics` to `backend/main.py` imports (~line 10)
- [ ] Add `EntityNode` model to `backend/models.py` (after `TrendAnalysis`, before `IndustryBenchmark`)
- [ ] Add `EntityAtomization` model to `backend/models.py` (after `EntityNode`)
- [ ] Add `entity_atomization: Optional[EntityAtomization]` field to `QuantitativeMetrics`
- [ ] Write `backend/tests/test_entity_atomization.py` (20 tests) — **tests first**
- [ ] Add 10 model tests to `backend/tests/test_models.py`
- [ ] Run `make test-unit` — confirm model tests and entity atomization tests pass
- [ ] Implement `run_entity_trend_profile()` in `backend/main.py` (after `run_trend_analysis()`)
- [ ] Implement `run_entity_atomization()` in `backend/main.py` (after `run_entity_trend_profile()`)
- [ ] Insert Entity Atomization step into SSE endpoint (new STEP 8)
- [ ] Update `total_steps` in SSE endpoint (+1)
- [ ] Insert Entity Atomization step into sync endpoint (after Trend, before SEM)
- [ ] Add `entity_atomization=entity_atomization` to both `QuantitativeMetrics(...)` instantiations
- [ ] Add 2 tests to `test_api_stream.py`
- [ ] Run `make test` — target: **246 tests, 0 failures**

### Frontend (in order)
- [ ] Add `entityAtomization: null` to `INITIAL_STORE` in `useAnalysis.js`
- [ ] Add `entity_atomization_data` SSE event handler in `useAnalysis.js`
- [ ] Create `frontend-react/src/components/results/EntityAtomizationSection.jsx`
- [ ] Import and render `<EntityAtomizationSection>` in `Results.jsx`
- [ ] Add 2 tests to `useAnalysis.test.js`
- [ ] Run `npm test` — all passing

### Integration (manual)
- [ ] Submit ad with known entities (e.g., "Nike summer campaign" with Nike logo)
- [ ] Confirm `entity_atomization_data` event in SSE stream
- [ ] Confirm each `EntityNode` in `nodes` array has independent momentum values (different from each other)
- [ ] Compare batch `trend_data.momentum` with `entity_atomization.aggregate_momentum` — they should be close but not identical (aggregate uses median, batch uses average)
- [ ] Submit with no entities (empty text, image only) — confirm `entity_atomization_data` is absent OR has empty `nodes` array

---

## 7. Success Criteria

| Criterion | How to verify |
|-----------|---------------|
| 214 existing Phase 2 tests green | `make test` before Phase 3 code |
| 32 new Phase 3 tests pass | `make test` output shows 246 total |
| `TrendAnalysis` / `trend_data` completely unchanged | `grep "TrendAnalysis" backend/models.py` → model unchanged |
| Each entity has independent `momentum` value | Check `entity_atomization.nodes[i].momentum` differ per entity in integration test |
| Related queries per entity differ | "Nike" nodes has "air max" queries; "Paris" has "paris fashion" queries |
| `aggregate_momentum` is median not mean | Unit test + manual check: [0.3, 0.7, 0.5] → 0.5 |
| `QuantitativeMetrics.entity_atomization` in response | Check API response JSON contains field |
| `entity_atomization_data` SSE event emitted | SSE stream test + browser network tab |
| Backend smoke test: no 429s on real data | Test with a known good GEMINI_API_KEY + real entity set |
| Frontend renders entity cards | Browser inspection — no console errors |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| pytrends 429 from 5 consecutive calls | Medium | Medium | 2s sleep between entities (same pattern that Phase 2 song trend call uses); `_pytrends_with_retry()` handles residual 429s |
| Entity atomization adds ~25s to pipeline | High (by design) | Low | Placed AFTER SEM — user already sees quality score before this step runs; pipeline trace shows timing |
| One entity with no pytrends data | Medium | None | `run_entity_trend_profile` returns `None` for that entity; `run_entity_atomization` skips it; partial results still valid |
| Location entities (GPE) have high interest but irrelevant queries | Medium | Low | Acceptable — GPE entities are filtered by spaCy; "Paris" queries still yield useful cultural context for Phase 5 |
| 5-entity cap misses important long-tail entities | Low | Low | Phase 5 resonance graph can use all `TextAnalysis.extracted_entities` for weight; 5 is sufficient for trend API |
| `statistics.median` raises `StatisticsError` on empty list | Low | Low | Guard: `if len(momenta) >= 1` before calling `statistics.median` |

---

## 9. Key File Locations (quick reference)

| What | File | Where |
|------|------|-------|
| `EntityNode` model — NEW | `backend/models.py` | After `TrendAnalysis`, before `IndustryBenchmark` |
| `EntityAtomization` model — NEW | `backend/models.py` | After `EntityNode` |
| `QuantitativeMetrics.entity_atomization` — ADD | `backend/models.py` | Within `QuantitativeMetrics`, after `trend_data` |
| `run_entity_trend_profile()` — NEW | `backend/main.py` | After `run_trend_analysis()` (~line 542) |
| `run_entity_atomization()` — NEW | `backend/main.py` | After `run_entity_trend_profile()` |
| `import statistics` — ADD | `backend/main.py` | Line ~10 (imports section) |
| SSE Entity Atomization step — INSERT | `backend/main.py` | After SEM step, before Landing Page |
| `total_steps` update | `backend/main.py` | Before `event_stream()` yield loop |
| Sync endpoint Entity Atomization step | `backend/main.py` | After Trend STEP 5, before SEM STEP 6 |
| `INITIAL_STORE` update | `frontend-react/src/hooks/useAnalysis.js` | ~line 3–20 |
| SSE event loop update | `frontend-react/src/hooks/useAnalysis.js` | ~line 130+ |
| `EntityAtomizationSection.jsx` — NEW | `frontend-react/src/components/results/` | New file |
| `Results.jsx` render update | `frontend-react/src/components/Results.jsx` | After TrendsSection |

---

## 10. Why Phase 3 Feeds Phase 5 (Resonance Graph Preview)

Each `EntityNode` is a proto-signal-node. In Phase 5:

```
ResononanceGraph
  ├── SignalNode(name="Nike", type="brand", momentum=0.61, ...)    ← from EntityNode
  ├── SignalNode(name="Adidas", type="brand", momentum=0.54, ...)  ← from EntityNode
  ├── SignalNode(name="Paris", type="location", momentum=0.73, ...) ← from EntityNode
  ├── SignalNode(name="Blinding Lights", type="audio", momentum=0.71, ...) ← from Phase 2 SongIdentification
  └── ... edges weighted by co-occurrence and semantic similarity
```

Phase 3's `EntityNode.related_queries_top` and `EntityNode.related_queries_rising` become edge candidates in the graph — queries that appear in multiple nodes' lists get higher edge weights. Phase 3's `time_series` data becomes the temporal signal for each node's momentum trajectory.

The data model designed in Phase 3 is deliberately forward-compatible with Phase 5's `SignalNode` concept — they share `name`, `momentum`, `time_series`, and `top_regions` fields.
