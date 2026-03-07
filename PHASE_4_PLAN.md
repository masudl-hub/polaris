# Phase 4: Cultural Context via Perplexity Sonar

**Goal**: For the top-3 highest-momentum entities from Phase 3, call Perplexity Sonar (a web-search-augmented LLM) to get live cultural context: what narrative surrounds this entity right now? What cultural moments are tied to it? Is it controversial? Is it ascending or fading culturally? Feed this into the executive diagnostic in Phase 6 and the resonance graph nodes in Phase 5.

**LLM Used**: Perplexity Sonar (`sonar` model) — web-search-augmented, live web knowledge. NOT Gemini. Gemini 3 Flash is NOT used in Phase 4.

**Prerequisite**: Phase 3 complete. Phase 4 consumes `EntityAtomization.nodes` sorted by momentum. It can also fall back to raw `entities` from `TextAnalysis` if Phase 3 produced no nodes.

**API Note**: `PERPLEXITY_API_KEY` is already stubbed in `backend/tests/conftest.py` (`mock_env` fixture, line 121). The infrastructure exists — Phase 4 is the first phase to actually use it.

---

## 1. Why Perplexity Sonar (Not Gemini)

Gemini 3 Flash is a knowledge-cutoff model — its training data has a cutoff. It cannot reliably answer "what cultural moment is Nike associated with right now in March 2026" with live accuracy.

Perplexity Sonar performs real-time web searches before generating its response. A query about "Nike cultural advertising context 2026" gets:
1. Live web search results from the last days/weeks
2. An LLM synthesis of those results
3. Citations (URLs to sources)

This is qualitatively different from what pytrends gives (search volume numbers) or what Gemini gives (static knowledge). Sonar gives you *why* something is trending, not just *that* it is.

**Sonar vs Sonar Pro**:
- `sonar`: Fast (~2-3s), designed for quick factual synthesis. Sufficient for entity context.
- `sonar-pro`: Slower (~8-12s), deeper research. Would add too much latency for 3 calls.

**Decision**: Use `sonar` model for all Phase 4 calls.

---

## 2. Perplexity Sonar API — Technical Reference

**Base URL**: `https://api.perplexity.ai`
**Endpoint**: `POST /chat/completions`
**Auth**: `Authorization: Bearer {PERPLEXITY_API_KEY}` in request headers
**SDK**: None needed — the API is OpenAI-compatible. Use `httpx` (already installed).

**Request structure**:
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(
        "https://api.perplexity.ai/chat/completions",
        headers={
            "Authorization": f"Bearer {pplx_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": "sonar",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a cultural intelligence analyst for advertising strategy."
                },
                {
                    "role": "user",
                    "content": "..."
                }
            ],
            "max_tokens": 400,
            "temperature": 0.2,
        },
    )
```

**Response structure**:
```json
{
    "id": "chatcmpl-...",
    "model": "sonar",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "..."
            },
            "finish_reason": "stop"
        }
    ],
    "usage": {
        "prompt_tokens": 120,
        "completion_tokens": 380,
        "total_tokens": 500
    }
}
```

**The content text is free-form narrative** unless we instruct it to return JSON. Phase 4 will instruct it to return a structured JSON object.

**Rate limits (Sonar free/standard tier)**:
- 50 requests/minute (ample for our 3 calls/pipeline-run)
- No monthly cap on standard tier (paid by token)
- Typical latency: 2-4 seconds per call

**Error handling**:
- `401`: Bad API key
- `429`: Rate limit exceeded
- `402`: Billing issue (out of credits)
- All other errors: network failures via httpx

**Cost estimate**: Sonar is approximately $0.005 per 1k tokens. Each call uses ~500 tokens → ~$0.0025 per entity → ~$0.0075 per 3-entity pipeline run. Negligible.

---

## 3. What We Ask Sonar

### The Prompt Per Entity

```
Analyze the cultural advertising relevance of "{entity}" RIGHT NOW in {month} {year}.

Return ONLY a JSON object with this exact structure:
{
  "cultural_sentiment": "positive|negative|neutral|mixed",
  "trending_direction": "ascending|stable|descending|viral",
  "narrative_summary": "2-3 sentence summary of the current cultural narrative around this entity",
  "advertising_risk": "low|medium|high",
  "advertising_risk_reason": "one sentence explaining the risk level",
  "cultural_moments": ["up to 3 specific current events or moments tied to this entity"],
  "adjacent_topics": ["up to 4 culturally adjacent topics an advertiser should know about"]
}

Be specific and current. Only reference events from the last 3-6 months.
Return ONLY the JSON object. No markdown. No explanation.
```

**Why JSON from Sonar**: Cleaner downstream parsing. Sonar models reliably follow JSON-return instructions when the schema is explicit and max_tokens is sufficient. We instruct `temperature=0.2` to reduce hallucinations.

**Why these fields**:
- `cultural_sentiment`: Safety signal — is the entity positive/negative in public perception right now?
- `trending_direction`: Complements pytrends momentum with qualitative direction
- `narrative_summary`: Human-readable synthesis for the executive diagnostic (Phase 6 consumes this directly)
- `advertising_risk`: Low/medium/high — a single signal Phase 5 uses as a negative weight on the node
- `advertising_risk_reason`: Explains the risk (e.g., "Brand is facing labor controversy in Southeast Asia")
- `cultural_moments`: Specific events — the most valuable output for creative strategy
- `adjacent_topics`: Content adjacency — "if you're advertising with Nike, know that Olympics discourse is adjacent"

---

## 4. Which Entities Get Sonar Calls

### Selection Algorithm

From Phase 3's `EntityAtomization.nodes` (up to 5 nodes), select the top-3 by momentum descending. If a node has `momentum=None`, it is ranked last (treated as 0.0 for sorting purposes).

```python
def select_top_entities_for_cultural_context(
    entity_atomization: Optional[EntityAtomization],
    fallback_entities: List[str],
    max_entities: int = 3,
) -> List[str]:
    """
    Returns up to max_entities entity names for Perplexity Sonar calls.
    Prefers high-momentum nodes from EntityAtomization.
    Falls back to raw entity list if atomization not available.
    """
    if entity_atomization and entity_atomization.nodes:
        sorted_nodes = sorted(
            entity_atomization.nodes,
            key=lambda n: n.momentum if n.momentum is not None else 0.0,
            reverse=True,
        )
        return [n.name for n in sorted_nodes[:max_entities]]
    return fallback_entities[:max_entities]
```

**Why top-3 by momentum**: The highest-momentum entities are the most culturally active right now. Sonar calls cost real money and add latency — we focus spend on signals that matter most. A momentum=0.1 entity (declining trend) is less valuable for cultural intelligence than a momentum=0.82 entity (surging).

**Cap at 3**: Even at 3s/call, 3 concurrent async calls = ~3s total latency. More than 3 would feel sluggish (5 calls = ~5s of wall-clock wait even with concurrency).

---

## 5. Concurrency Strategy — All 3 Calls in Parallel

Unlike Phase 3 (which uses sequential pytrends calls with `time.sleep(2)` to avoid 429s), Perplexity has no such constraint. All 3 Sonar calls can fire in parallel:

```python
import asyncio

async def run_cultural_context(
    entity_atomization: Optional[EntityAtomization],
    fallback_entities: List[str],
    geo: str,
) -> Optional[CulturalContext]:
    
    entities = select_top_entities_for_cultural_context(entity_atomization, fallback_entities)
    if not entities:
        return None

    pplx_key = os.getenv("PERPLEXITY_API_KEY")
    if not pplx_key:
        print("⚠️  PERPLEXITY_API_KEY not set — cultural context skipped")
        return None

    # Fire all calls concurrently — 3 calls × ~3s = ~3s total (not 9s)
    tasks = [query_entity_cultural_context(entity, pplx_key) for entity in entities]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    entity_contexts = []
    for entity, result in zip(entities, results):
        if isinstance(result, Exception):
            print(f"⚠️  Cultural context failed for '{entity}': {result}")
            continue
        if result is not None:
            entity_contexts.append(result)
    
    if not entity_contexts:
        return None
    
    # Aggregate risk: worst risk level among entities
    risk_levels = {"low": 0, "medium": 1, "high": 2}
    overall_risk = max(
        (ec.advertising_risk for ec in entity_contexts),
        key=lambda r: risk_levels.get(r, 0),
        default="low",
    )
    
    return CulturalContext(
        entity_contexts=entity_contexts,
        overall_advertising_risk=overall_risk,
    )
```

**`asyncio.gather(*tasks, return_exceptions=True)`**: Returns exceptions as values instead of propagating. This means if one Sonar call fails (network error, bad response), the other two still succeed and contribute to the result. Partial results are preferred over total failure.

---

## 6. Phase 4 Deliverables

### 6a. New Pydantic Models in `backend/models.py`

Insert **after `EntityAtomization`** (Phase 3) and **before `QuantitativeMetrics`**.

```python
class EntityCulturalContext(BaseModel):
    """Perplexity Sonar-sourced cultural intelligence for a single entity."""
    entity_name: str = Field(description="Entity name (from spaCy NER or EntityAtomization)")
    cultural_sentiment: str = Field(
        description="Current public sentiment: 'positive', 'negative', 'neutral', or 'mixed'"
    )
    trending_direction: str = Field(
        description="Cultural trajectory: 'ascending', 'stable', 'descending', or 'viral'"
    )
    narrative_summary: str = Field(
        description="2-3 sentence synthesis of current cultural narrative around this entity"
    )
    advertising_risk: str = Field(
        description="Advertising risk level: 'low', 'medium', or 'high'"
    )
    advertising_risk_reason: Optional[str] = Field(
        default=None,
        description="One sentence explaining why this risk level was assigned"
    )
    cultural_moments: List[str] = Field(
        default_factory=list,
        description="Up to 3 specific current events or cultural moments tied to this entity"
    )
    adjacent_topics: List[str] = Field(
        default_factory=list,
        description="Up to 4 culturally adjacent topics relevant to advertisers"
    )


class CulturalContext(BaseModel):
    """Perplexity Sonar cultural intelligence for the top-momentum entities in the ad."""
    entity_contexts: List[EntityCulturalContext] = Field(
        description="Cultural context per queried entity, ordered by momentum (highest first)"
    )
    overall_advertising_risk: str = Field(
        description="Worst-case advertising risk across all entities: 'low', 'medium', or 'high'"
    )
```

**Modify `QuantitativeMetrics`** — add one optional field after `entity_atomization`:

```python
class QuantitativeMetrics(BaseModel):
    text_data: TextAnalysis
    vision_data: VisionAnalysis
    media_decomposition: Optional[MediaDecomposition] = ...   # Phase 1
    trend_data: Optional[TrendAnalysis] = ...
    entity_atomization: Optional[EntityAtomization] = ...    # Phase 3
    cultural_context: Optional[CulturalContext] = Field(     # Phase 4 — NEW
        default=None,
        description="Perplexity Sonar cultural intelligence for top-momentum entities"
    )
    sem_metrics: SEMMetrics
    # ... rest unchanged
```

`EvaluationResponse` is unchanged.

---

### 6b. New Functions in `backend/main.py`

Insert all three functions **after `run_entity_atomization()`** (Phase 3) and **before `PLATFORM_CPC_MULTIPLIER`**.

---

#### Function 1: `select_top_entities_for_cultural_context()` (sync helper)

**Signature**: `select_top_entities_for_cultural_context(entity_atomization, fallback_entities, max_entities=3) -> List[str]`

Full implementation as shown in section 4 above. This is a pure Python function with no I/O — no mocking needed in tests beyond passing in data.

---

#### Function 2: `query_entity_cultural_context()` (async, single entity)

**Signature**: `async def query_entity_cultural_context(entity: str, pplx_key: str) -> Optional[EntityCulturalContext]`

**Full implementation**:

```python
async def query_entity_cultural_context(entity: str, pplx_key: str) -> Optional[EntityCulturalContext]:
    """
    Call Perplexity Sonar for cultural intelligence on a single entity.
    Returns structured EntityCulturalContext or None on failure.
    """
    import json as _json
    from datetime import datetime

    month_year = datetime.now().strftime("%B %Y")   # e.g., "March 2026"

    prompt = (
        f'Analyze the cultural advertising relevance of "{entity}" RIGHT NOW in {month_year}.\n\n'
        'Return ONLY a JSON object with this exact structure:\n'
        '{\n'
        '  "cultural_sentiment": "positive|negative|neutral|mixed",\n'
        '  "trending_direction": "ascending|stable|descending|viral",\n'
        '  "narrative_summary": "2-3 sentence summary of current cultural narrative",\n'
        '  "advertising_risk": "low|medium|high",\n'
        '  "advertising_risk_reason": "one sentence explaining the risk level",\n'
        '  "cultural_moments": ["up to 3 specific current events tied to this entity"],\n'
        '  "adjacent_topics": ["up to 4 culturally adjacent topics for advertisers"]\n'
        '}\n\n'
        'Be specific and current. Only reference events from the last 3-6 months. '
        'Return ONLY the JSON object. No markdown fences. No explanation.'
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {pplx_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "sonar",
                    "messages": [
                        {
                            "role": "system",
                            "content": (
                                "You are a cultural intelligence analyst for advertising strategy. "
                                "Always respond with valid JSON only. No markdown. No extra text."
                            ),
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 500,
                    "temperature": 0.2,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["choices"][0]["message"]["content"].strip()

        # Strip markdown fences if Sonar wrapped the JSON anyway
        fence = "```"
        if content.startswith(fence):
            lines = content.split("\n")
            content = "\n".join(lines[1:])
        if content.endswith(fence):
            content = content[:-3]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

        parsed = _json.loads(content)

        # Validate and clamp enum fields — Sonar occasionally returns unexpected values
        VALID_SENTIMENTS = {"positive", "negative", "neutral", "mixed"}
        VALID_DIRECTIONS = {"ascending", "stable", "descending", "viral"}
        VALID_RISKS = {"low", "medium", "high"}

        sentiment = parsed.get("cultural_sentiment", "neutral")
        if sentiment not in VALID_SENTIMENTS:
            sentiment = "neutral"

        direction = parsed.get("trending_direction", "stable")
        if direction not in VALID_DIRECTIONS:
            direction = "stable"

        risk = parsed.get("advertising_risk", "low")
        if risk not in VALID_RISKS:
            risk = "low"

        return EntityCulturalContext(
            entity_name=entity,
            cultural_sentiment=sentiment,
            trending_direction=direction,
            narrative_summary=parsed.get("narrative_summary", ""),
            advertising_risk=risk,
            advertising_risk_reason=parsed.get("advertising_risk_reason"),
            cultural_moments=parsed.get("cultural_moments", [])[:3],
            adjacent_topics=parsed.get("adjacent_topics", [])[:4],
        )

    except _json.JSONDecodeError as e:
        print(f"⚠️  Sonar returned non-JSON for '{entity}': {e}")
        return None
    except httpx.HTTPStatusError as e:
        print(f"⚠️  Sonar HTTP error for '{entity}': {e.response.status_code}")
        return None
    except Exception as e:
        print(f"⚠️  Sonar error for '{entity}': {e}")
        return None
```

---

#### Function 3: `run_cultural_context()` (async orchestrator)

**Signature**: `async def run_cultural_context(entity_atomization, fallback_entities, geo) -> Optional[CulturalContext]`

Full implementation as shown in section 5 above.

**Key behaviors**:
1. Checks `PERPLEXITY_API_KEY` — returns `None` immediately if absent (no error, graceful skip)
2. `select_top_entities_for_cultural_context()` picks top-3 by momentum
3. `asyncio.gather(*tasks, return_exceptions=True)` fires all 3 calls simultaneously
4. Individual call failures are logged and skipped — partial results are returned
5. `overall_advertising_risk` is the **worst** risk level across entities (e.g., if Nike=low and Adidas=high, overall=high)

---

### 6c. Wire into SSE Endpoint (`evaluate_ad_stream`)

**Placement**: After Entity Atomization (STEP 8 from Phase 3), **before Landing Page** (which was STEP 8, now STEP 9 or STEP 10).

**Important**: `run_cultural_context()` is already an `async` function, so it does NOT need `asyncio.to_thread()` unlike the sync pytrends calls. Call it directly with `await`.

```python
# STEP 9: Cultural Context (Perplexity Sonar, top-3 entities by momentum)
yield send_starting("Cultural Context", "Perplexity Sonar (web-search LLM)", total_steps)
t0 = time.time()
try:
    cultural_context_data = await run_cultural_context(
        entity_atomization, entities, geo
    )
    elapsed = int((time.time() - t0) * 1000)
    out_summary = str(cultural_context_data)[:200] if cultural_context_data else "(skipped — no API key)"
    status = "ok" if cultural_context_data else "warning"
    yield send_step(
        "Cultural Context", "Perplexity Sonar (sonar model)",
        "Entities: " + str(entities[:3]) + " (top by momentum)",
        out_summary, elapsed, status,
        note=None if cultural_context_data else "PERPLEXITY_API_KEY not set",
    )
except Exception as exc:
    elapsed = int((time.time() - t0) * 1000)
    cultural_context_data = None
    yield send_step(
        "Cultural Context", "Perplexity Sonar",
        "Entities: " + str(entities[:3]),
        "(failed)", elapsed, "error", str(exc),
    )
if cultural_context_data:
    yield "data: " + _json.dumps({
        "type": "cultural_context_data",
        "data": cultural_context_data.model_dump()
    }) + "\n\n"
```

**Note**: Unlike other `await run_step(...)` calls in the handler, Cultural Context uses direct `await` + manual `send_step()` because `run_cultural_context()` is already async (not wrapped in `asyncio.to_thread()`). The existing `run_step()` helper calls `await asyncio.to_thread(fn)` which only accepts sync functions. Cultural Context is async — call it directly. This is the same pattern already used for Landing Page and Reddit (which are also async and use `t0 = time.time()` + direct `await` + manual `send_step()`).

**Update `total_steps`** (+1):
```python
total_steps = 15
if platform.lower() == "linkedin" and post_type:
    total_steps += 1
```

---

### 6d. Wire into Sync Endpoint (`evaluate_ad`)

The sync endpoint uses `asyncio.run()` for async functions. After Entity Atomization, add:

```python
# Cultural Context (runs async inside sync endpoint via asyncio.run)
import asyncio as _asyncio
t0 = time.time()
step_num += 1
try:
    cultural_context_data = _asyncio.run(
        run_cultural_context(entity_atomization, entities, geo)
    )
    elapsed = int((time.time() - t0) * 1000)
    trace.append(PipelineStep(
        step=step_num, name="Cultural Context", model="Perplexity Sonar",
        input_summary=f"Entities: {entities[:3]}",
        output_summary=str(cultural_context_data)[:200] if cultural_context_data else "(skipped)",
        duration_ms=elapsed,
        status="ok" if cultural_context_data else "warning",
        note=None if cultural_context_data else "PERPLEXITY_API_KEY not set",
    ))
except Exception as exc:
    elapsed = int((time.time() - t0) * 1000)
    cultural_context_data = None
    trace.append(PipelineStep(
        step=step_num, name="Cultural Context", model="Perplexity Sonar",
        input_summary=f"Entities: {entities[:3]}",
        output_summary="(failed)", duration_ms=elapsed, status="error", note=str(exc),
    ))
```

**Note**: `asyncio.run()` in a sync context only works if there is no running event loop. In the sync FastAPI endpoint (it IS async — FastAPI routes are async), this would nest loops. The sync endpoint is actually defined `async def evaluate_ad(...)`. Therefore, do NOT use `asyncio.run()` — use `await run_cultural_context(...)` directly, same as the streaming endpoint. Verify when implementing.

---

### 6e. Update `QuantitativeMetrics(...)` Instantiation

Both endpoints — add `cultural_context=cultural_context_data`:

```python
quant_metrics = QuantitativeMetrics(
    text_data=text_analysis,
    vision_data=vision_analysis,
    media_decomposition=media_decomp,
    trend_data=trend_data,
    entity_atomization=entity_atomization,
    cultural_context=cultural_context_data,  # Phase 4 (NEW)
    sem_metrics=sem_metrics,
    # ... rest unchanged
)
```

---

### 6f. Import Additions

`httpx` is already imported at line ~37 of `backend/main.py`. No new pip packages needed. No new imports needed.

However, confirm `datetime` is available: `from datetime import datetime` — check if it's already imported. If not, add it. The formatting `datetime.now().strftime("%B %Y")` is used in `query_entity_cultural_context()`.

---

## 7. Testing Strategy

### New Test File: `backend/tests/test_cultural_context.py`
~300 lines, 24 tests, 6 classes.

**Class: `TestQueryEntityCulturalContext`** (8 tests)

| Test | What it validates |
|------|------------------|
| `test_valid_response_returns_entity_context` | Mock httpx → valid Sonar JSON → `EntityCulturalContext` populated correctly |
| `test_missing_api_key_returns_none` | `PERPLEXITY_API_KEY=""` → function returns `None` before making HTTP call |
| `test_http_401_returns_none` | Mock httpx to raise `HTTPStatusError(401)` → returns `None` gracefully |
| `test_http_429_returns_none` | Mock httpx to raise `HTTPStatusError(429)` → returns `None`, no crash |
| `test_malformed_json_returns_none` | Sonar returns non-JSON text → `JSONDecodeError` caught, returns `None` |
| `test_markdown_fences_stripped` | Sonar wraps JSON in ` ```json...``` ` → successfully parses |
| `test_invalid_sentiment_clamped_to_neutral` | `"cultural_sentiment": "ambivalent"` → clamped to `"neutral"` |
| `test_invalid_risk_clamped_to_low` | `"advertising_risk": "extreme"` → clamped to `"low"` |

**Class: `TestRunCulturalContext`** (5 tests)

| Test | What it validates |
|------|------------------|
| `test_no_api_key_returns_none` | No `PERPLEXITY_API_KEY` env var → returns `None` |
| `test_no_entities_returns_none` | `entity_atomization=None`, `fallback_entities=[]` → returns `None` |
| `test_all_calls_succeed_returns_context` | 3 mocked entities, all succeed → `CulturalContext` with 3 items |
| `test_one_call_fails_partial_result` | 3 entities, 1 raises exception → `CulturalContext` with 2 items |
| `test_all_calls_fail_returns_none` | All 3 raise exceptions → returns `None` |

**Class: `TestSelectTopEntitiesForCulturalContext`** (5 tests)

| Test | What it validates |
|------|------------------|
| `test_sorted_by_momentum_descending` | Nodes with momenta [0.3, 0.8, 0.55] → entities in order [0.8, 0.55, 0.3] |
| `test_none_momentum_ranked_last` | Node with `momentum=None` → sorted after all scored nodes |
| `test_max_3_entities_selected` | 5 nodes → only top-3 names returned |
| `test_falls_back_to_entities_when_no_atomization` | `entity_atomization=None` → uses `fallback_entities[:3]` |
| `test_empty_nodes_falls_back` | `EntityAtomization(nodes=[])` → falls back to `fallback_entities` |

**Class: `TestOverallRiskAggregation`** (3 tests)

| Test | What it validates |
|------|------------------|
| `test_overall_risk_is_worst_case` | Entities with [low, medium, high] → `overall_advertising_risk="high"` |
| `test_overall_risk_all_low` | All entities have `advertising_risk="low"` → `overall="low"` |
| `test_overall_risk_medium_beats_low` | [low, medium] → `overall="medium"` |

**Class: `TestConcurrentCalls`** (2 tests)

| Test | What it validates |
|------|------------------|
| `test_all_calls_made_concurrently` | Mock asyncio.gather → confirm 3 tasks created simultaneously |
| `test_gather_exceptions_do_not_propagate` | One task raises `Exception` inside gather → other results returned |

**Class: `TestBackwardCompat`** (1 test)

| Test | What it validates |
|------|------------------|
| `test_quant_metrics_without_cultural_context` | `QuantitativeMetrics(cultural_context=None, ...)` → valid model |

---

### Updates to Existing Test Files

**`backend/tests/test_models.py`** — Add `TestCulturalContextModels` class (10 tests):

| Test | What it validates |
|------|------------------|
| `test_entity_cultural_context_all_fields` | Full valid construction |
| `test_entity_cultural_context_optional_fields` | `advertising_risk_reason=None` is valid |
| `test_entity_cultural_context_empty_lists` | `cultural_moments=[]` and `adjacent_topics=[]` are valid |
| `test_cultural_context_construction` | Valid `CulturalContext` with 3 entity contexts |
| `test_cultural_context_overall_risk_values` | `overall_advertising_risk` accepts "low", "medium", "high" |
| `test_cultural_context_single_entity` | `CulturalContext` with 1 entity context is valid |
| `test_cultural_context_empty_contexts` | `CulturalContext(entity_contexts=[])` — should this be valid? (yes, API might return 0 matches) |
| `test_quant_metrics_accepts_cultural_context` | `QuantitativeMetrics(cultural_context=CulturalContext(...))` → valid |
| `test_quant_metrics_cultural_context_defaults_none` | Omit `cultural_context` → `None` |
| `test_evaluation_response_unchanged` | `EvaluationResponse` still constructs without changes |

**`backend/tests/test_api_stream.py`** — Add 2 tests:

| Test | What it validates |
|------|------------------|
| `test_cultural_context_event_when_key_set` | `PERPLEXITY_API_KEY` set + mocked httpx → `cultural_context_data` SSE event in stream |
| `test_cultural_context_absent_when_no_key` | No `PERPLEXITY_API_KEY` → no `cultural_context_data` event; pipeline trace has "warning" status step |

**`backend/tests/conftest.py`** — Add mock helper for Perplexity (add alongside the existing `mock_gemini_client` fixture):

```python
@pytest.fixture
def mock_perplexity_response():
    """Returns a factory for a valid Perplexity Sonar API response."""
    def make_response(entity_name: str = "Nike"):
        return {
            "id": "chatcmpl-test",
            "model": "sonar",
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": json.dumps({
                        "cultural_sentiment": "positive",
                        "trending_direction": "ascending",
                        "narrative_summary": f"{entity_name} is currently associated with sports performance and cultural credibility.",
                        "advertising_risk": "low",
                        "advertising_risk_reason": "Strong positive brand perception, no active controversies.",
                        "cultural_moments": ["Paris Olympics partnership", "sustainable materials campaign"],
                        "adjacent_topics": ["athletic performance", "streetwear culture", "Gen-Z fashion"],
                    })
                },
                "finish_reason": "stop",
            }],
            "usage": {"prompt_tokens": 120, "completion_tokens": 200, "total_tokens": 320},
        }
    return make_response
```

**Expected test counts**:
- 246 baseline (after Phase 3)
- 24 new `test_cultural_context.py` tests
- 10 new `test_models.py` tests
- 2 new `test_api_stream.py` tests
- **Total: 246 + 36 = 282 tests passing**

---

## 8. Frontend Changes

### `frontend-react/src/hooks/useAnalysis.js`

**Add `culturalContext: null` to `INITIAL_STORE`**:
```javascript
const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  mediaDecomposition: null,
  audioIntelligence: null,
  entityAtomization: null,
  culturalContext: null,        // Phase 4 (NEW)
  sentiment: null,
  trends: null,
  // ...rest unchanged
}
```

**Add handler in SSE event loop**:
```javascript
} else if (evt.type === 'cultural_context_data') {
  setStore(prev => ({ ...prev, culturalContext: evt.data }))
}
```

### `frontend-react/src/components/results/CulturalContextSection.jsx` (NEW)

Risk badge + entity cards with narrative summaries and cultural moments:

```jsx
import React from 'react'

const RISK_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
}

const DIRECTION_ICONS = {
  ascending: '↑',
  stable: '→',
  descending: '↓',
  viral: '🔥',
}

function RiskBadge({ risk }) {
  return (
    <span
      className="cc-risk-badge"
      style={{ backgroundColor: RISK_COLORS[risk] || '#94a3b8' }}
    >
      {risk?.toUpperCase()} RISK
    </span>
  )
}

export function CulturalContextSection({ data }) {
  if (!data || !data.entity_contexts || data.entity_contexts.length === 0) return null

  return (
    <div className="cultural-context-section">
      <h3>Cultural Intelligence</h3>
      <div className="cc-overall-risk">
        Overall Advertising Risk: <RiskBadge risk={data.overall_advertising_risk} />
      </div>
      <div className="cc-entities">
        {data.entity_contexts.map((ctx) => (
          <div key={ctx.entity_name} className="cc-entity-card">
            <div className="cc-entity-header">
              <span className="cc-entity-name">{ctx.entity_name}</span>
              <span className="cc-direction">{DIRECTION_ICONS[ctx.trending_direction]}</span>
              <RiskBadge risk={ctx.advertising_risk} />
            </div>
            <p className="cc-narrative">{ctx.narrative_summary}</p>
            {ctx.cultural_moments.length > 0 && (
              <div className="cc-moments">
                <strong>Cultural moments:</strong>
                <ul>
                  {ctx.cultural_moments.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            {ctx.adjacent_topics.length > 0 && (
              <div className="cc-adjacent">
                <strong>Adjacent:</strong> {ctx.adjacent_topics.join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### `frontend-react/src/components/Results.jsx`

```jsx
import { CulturalContextSection } from './results/CulturalContextSection'

// After EntityAtomizationSection:
{store.culturalContext && <CulturalContextSection data={store.culturalContext} />}
```

### Frontend Tests

Add 2 tests to `useAnalysis.test.js`:
- `test_initial_store_has_cultural_context_null` — `store.culturalContext` starts as `null`
- `test_cultural_context_event_populates_store` — `cultural_context_data` SSE event → `store.culturalContext` populated

---

## 9. Full Execution Checklist

### Pre-flight
- [ ] Obtain `PERPLEXITY_API_KEY` from https://www.perplexity.ai/settings/api
- [ ] Add `PERPLEXITY_API_KEY=pplx-...` to `.env`
- [ ] Confirm Phase 3 complete: `make test` shows 246 passing
- [ ] Test Sonar manually: `curl -X POST https://api.perplexity.ai/chat/completions -H "Authorization: Bearer $PERPLEXITY_API_KEY" -H "Content-Type: application/json" -d '{"model":"sonar","messages":[{"role":"user","content":"What is Nike in 2026?"}]}'`

### Backend (in order)
- [ ] Check `datetime` is already imported in `backend/main.py` — add `from datetime import datetime` if missing
- [ ] Add `EntityCulturalContext` model to `backend/models.py` (after `EntityAtomization`)
- [ ] Add `CulturalContext` model to `backend/models.py` (after `EntityCulturalContext`)
- [ ] Add `cultural_context: Optional[CulturalContext]` to `QuantitativeMetrics`
- [ ] Add `mock_perplexity_response` fixture to `backend/tests/conftest.py`
- [ ] Write `backend/tests/test_cultural_context.py` (24 tests) — **tests first**
- [ ] Add 10 model tests to `backend/tests/test_models.py`
- [ ] Run `make test-unit` — confirm new model/unit tests pass
- [ ] Implement `select_top_entities_for_cultural_context()` in `backend/main.py`
- [ ] Implement `query_entity_cultural_context()` in `backend/main.py`
- [ ] Implement `run_cultural_context()` in `backend/main.py`
- [ ] Insert Cultural Context step into SSE endpoint (STEP 9, after Entity Atomization)
- [ ] Insert Cultural Context step into sync endpoint (after Entity Atomization, before Landing Page)
- [ ] Update `total_steps` in SSE endpoint (+1 → 15)
- [ ] Add `cultural_context=cultural_context_data` to both `QuantitativeMetrics(...)` instantiations
- [ ] Add 2 tests to `test_api_stream.py`
- [ ] Run `make test` — target: **282 tests, 0 failures**

### Frontend (in order)
- [ ] Add `culturalContext: null` to `INITIAL_STORE` in `useAnalysis.js`
- [ ] Add `cultural_context_data` SSE event handler in `useAnalysis.js`
- [ ] Create `frontend-react/src/components/results/CulturalContextSection.jsx`
- [ ] Import and render `<CulturalContextSection>` in `Results.jsx`
- [ ] Add 2 tests to `useAnalysis.test.js`
- [ ] Run `npm test` — all passing

### Integration (manual)
- [ ] Submit ad with known branded entity (e.g., Nike logo image)
- [ ] Confirm `cultural_context_data` event in SSE stream with populated entity contexts
- [ ] Confirm `overall_advertising_risk` field is present
- [ ] Confirm `cultural_moments` contains real current events (not hallucinated history)
- [ ] Submit ad with no PERPLEXITY_API_KEY set → confirm pipeline continues, step shows "warning" in trace
- [ ] Submit text-only ad with no extractable entities → confirm graceful `None` return

---

## 10. Success Criteria

| Criterion | How to verify |
|-----------|---------------|
| 246 existing Phase 3 tests green | `make test` before Phase 4 code — no regressions |
| 36 new Phase 4 tests pass | `make test` output shows 282 total |
| `PERPLEXITY_API_KEY` absent → graceful skip | No key in env → `cultural_context=null` in response, pipeline continues |
| Top entities selected by momentum | `select_top_entities` test + integration: highest-momentum entities queried first |
| 3 Sonar calls fire concurrently | Profiling: total Cultural Context step wall-clock ≈ 1 call duration (not 3×) |
| One Sonar call failure → partial result | Test: 2/3 contexts in response, no crash |
| `cultural_sentiment` values are valid | Only "positive"/"negative"/"neutral"/"mixed" — invalid values clamped |
| `overall_advertising_risk` is worst-case | Unit test + integration check |
| `cultural_context_data` SSE event emitted | SSE stream test |
| Frontend `<CulturalContextSection>` renders | Browser inspection — risk badges, narrative text, cultural moments |

---

## 11. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Sonar returns free-form text despite JSON instruction | Medium | Medium | Fence-stripping parser + `try/except JSONDecodeError` → returns `None` for that entity; others still valid |
| Sonar hallucinates current events | Medium | Medium | `temperature=0.2` minimizes hallucination; cultural moments are informational/advisory, not deterministic scores |
| Perplexity API key not configured | High (early dev) | Low | Graceful skip — `cultural_context=null`, pipeline continues; PipelineStep has `status="warning"` |
| 3 concurrent calls → Sonar rate limit | Very Low | Low | 3 calls well under 50 req/minute; `return_exceptions=True` handles any rogue 429 |
| Entity is too obscure for Sonar to find context | Medium | Low | Returns `narrative_summary=""` or minimal content; empty cultural moments is valid |
| `overall_advertising_risk` blocks ad (false positive) | Low | High | Risk is advisory only — it goes into the diagnostic narrative (Phase 6) as a signal, not a gate |
| Sonar API URL or model name changes | Low | Medium | Isolate in `query_entity_cultural_context()` — change in one place; add `SONAR_MODEL` env var override |

---

## 12. Key File Locations (quick reference)

| What | File | Where |
|------|------|-------|
| `EntityCulturalContext` model — NEW | `backend/models.py` | After `EntityAtomization` |
| `CulturalContext` model — NEW | `backend/models.py` | After `EntityCulturalContext` |
| `QuantitativeMetrics.cultural_context` — ADD | `backend/models.py` | After `entity_atomization` field |
| `select_top_entities_for_cultural_context()` — NEW | `backend/main.py` | After `run_entity_atomization()` |
| `query_entity_cultural_context()` — NEW | `backend/main.py` | After selector function |
| `run_cultural_context()` — NEW | `backend/main.py` | After `query_entity_cultural_context()` |
| SSE Cultural Context step — INSERT | `backend/main.py` | After Entity Atomization step |
| `total_steps` update | `backend/main.py` | Top of `event_stream()` |
| `mock_perplexity_response` fixture — ADD | `backend/tests/conftest.py` | After `mock_gemini_client` fixture |
| `INITIAL_STORE` update | `frontend-react/src/hooks/useAnalysis.js` | ~line 3–20 |
| SSE event loop update | `frontend-react/src/hooks/useAnalysis.js` | ~line 130+ |
| `CulturalContextSection.jsx` — NEW | `frontend-react/src/components/results/` | New file |
| `Results.jsx` render update | `frontend-react/src/components/Results.jsx` | After EntityAtomizationSection |
| `PERPLEXITY_API_KEY` env var | `.env` | (new entry) |

---

## 13. How Phase 4 Feeds Phase 6 (Executive Diagnostic Upgrade)

Phase 6 rewrites the `generate_executive_diagnostic()` prompt to consume the full resonance graph (Phase 5). But Phase 4 is already wired to feed Phase 6 directly through `QuantitativeMetrics`:

```python
# In generate_executive_diagnostic() — Phase 6 upgrade:
# cultural_context is available via metrics.cultural_context
# The LLM can read:
# - metrics.cultural_context.entity_contexts[0].narrative_summary   → "Nike is currently..."
# - metrics.cultural_context.entity_contexts[0].cultural_moments    → ["Paris Olympics..."]
# - metrics.cultural_context.overall_advertising_risk               → "low"
# 
# Phase 6 will explicitly instruct Gemini to reference these in the "Trend & Market Context" section.
```

Phase 4's `advertising_risk` and `narrative_summary` per entity are the **qualitative signals** that Phase 5's resonance graph uses to set node weights. High-risk nodes get penalized in the composite Resonance Score; viral/ascending nodes get boosted. Phase 4 output is the narrative substrate the whole system synthesizes.
