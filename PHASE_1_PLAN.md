# Phase 1: Native Video Decomposition

**Goal**: Replace the cv2 single-frame extraction hack with native video upload to Gemini 3 Flash. Get structured timeline output: scene-by-scene breakdown, dense OCR across all frames, visual entity extraction, audio description.

**Gemini Model**: `gemini-3-flash-preview` (Gemini 3 Flash only — no other Gemini versions)

---

## 1. Current State — Exact Code Being Replaced

### Function: `run_vision_pipeline()`
**File**: `backend/main.py`, lines 239–420
**Current signature**: `run_vision_pipeline(file_path: str, is_video: bool, platform: str = "Meta", ad_placements: str = "") -> VisionAnalysis`

**What it does today** (cv2 frame extraction):

```python
# Line ~252 — For video: extracts ONLY the middle frame via cv2
if is_video:
    cap = cv2.VideoCapture(file_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, total // 2)
    ret, frame = cap.read()
    cap.release()
    _, buf = cv2.imencode(".jpg", frame)
    file_bytes = buf.tobytes()   # ALL audio and context gone. One JPEG.
    mime = "image/jpeg"

# Line ~355 — Sends that single JPEG to Gemini
response = gemini_client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        types.Part.from_bytes(data=file_bytes, mime_type=mime),
        prompt,
    ],
)

# Returns VisionAnalysis — a flat single-snapshot model
return VisionAnalysis(
    visual_tags=...,
    extracted_text=...,       # Only text from frame #450 of 900
    brand_detected=...,
    style_assessment=...,
    is_cluttered=...,
    platform_fit=...,
    platform_fit_score=...,   # 1-10
    platform_suggestions=...,
)
```

**What this means in numbers**: A 30-second video at 30fps = 900 frames. Only frame 450 is analyzed. 0.1% of visual content. 0% of audio.

### Where it is called from

**SSE endpoint** (`event_stream()`, around line 1588):
```python
vision_analysis, evt = await run_step(
    "Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)",
    ...,
    lambda: run_vision_pipeline(tmp_path, is_video, platform, ad_placements),
)
```

**Sync endpoint** (`evaluate_ad`, around line 1220):
Same call pattern via the `_step()` helper.

### What downstream consumes from vision

```python
# OCR text feeds into NLP pipeline (NER + sentiment + hashtag expansion)
ocr_text = (getattr(vision_analysis, "extracted_text", None) or "").replace("\n", " ").strip()
ocr_brand = (getattr(vision_analysis, "brand_detected", None) or "").replace("\n", " ").strip()
full_text = user_text + ". " + ocr_text + ". " + ocr_brand

# Platform fit score feeds into SEM quality score calculation
pfs = getattr(vision_analysis, "platform_fit_score", None)
visual_authenticity = round((pfs - 1.0) / 9.0, 4) if pfs else None

# vision_analysis is stored in QuantitativeMetrics
quant_metrics = QuantitativeMetrics(
    text_data=text_analysis,
    vision_data=vision_analysis,   # <-- VisionAnalysis goes here
    ...
)
```

### Existing models (unchanged by Phase 1 — backward compat preserved)

`backend/models.py` — current `VisionAnalysis`:
```python
class VisionAnalysis(BaseModel):
    visual_tags: List[str]
    extracted_text: Optional[str]
    brand_detected: Optional[str]
    style_assessment: Optional[str]
    is_cluttered: bool
    platform_fit: Optional[str]
    platform_fit_score: Optional[float]  # 1.0–10.0
    platform_suggestions: Optional[str]
```

`backend/models.py` — current `QuantitativeMetrics`:
```python
class QuantitativeMetrics(BaseModel):
    text_data: TextAnalysis
    vision_data: VisionAnalysis        # Phase 1: keep this, don't break it
    trend_data: Optional[TrendAnalysis]
    sem_metrics: SEMMetrics
    industry_benchmark: Optional[IndustryBenchmark]
    landing_page: Optional[LandingPageCoherence]
    reddit_sentiment: Optional[RedditSentiment]
    creative_alignment: Optional[CreativeAlignment]
    audience_analysis: Optional[AudienceAnalysis]
    linkedin_analysis: Optional[LinkedInPostAnalysis]
    competitor_intel: Optional[CompetitorIntel]
```

`backend/models.py` — current `EvaluationResponse`:
```python
class EvaluationResponse(BaseModel):
    status: str = "success"
    quantitative_metrics: QuantitativeMetrics
    executive_diagnostic: str
    pipeline_trace: List[PipelineStep]
```

---

## 2. Phase 1 Deliverables

### 2a. New Pydantic Models in `backend/models.py`

**Add three new models** (do not modify any existing models):

```python
class SceneBreakdown(BaseModel):
    """One contiguous scene identified by Gemini in the video/image."""
    scene_number: int = Field(description="Sequential scene number starting at 1")
    start_seconds: float = Field(description="Scene start time in seconds")
    end_seconds: float = Field(description="Scene end time in seconds")
    duration_seconds: float = Field(description="Scene duration in seconds")
    primary_setting: str = Field(description="Setting or environment of this scene")
    key_entities: List[str] = Field(default_factory=list, description="Brands, people, products, places visible")
    visual_summary: str = Field(description="One-sentence description of what happens")
    all_ocr_text: List[str] = Field(default_factory=list, description="Every text string visible in this scene")


class AudioDescription(BaseModel):
    """Gemini's description of the audio track. Phase 2 will add song identification."""
    has_audio: bool = Field(description="Whether the video has an audio track")
    description: Optional[str] = Field(default=None, description="Natural language description of audio")


class MediaDecomposition(BaseModel):
    """Full structured decomposition of a video or image from Gemini 3 Flash."""
    media_type: str = Field(description="'image' or 'video'")
    duration_seconds: Optional[float] = Field(default=None, description="Total duration in seconds (None for images)")
    scenes: List[SceneBreakdown] = Field(default_factory=list, description="All scenes identified")
    audio: Optional[AudioDescription] = Field(default=None, description="Audio description (None for images)")
    all_extracted_text: List[str] = Field(default_factory=list, description="Deduplicated text across all frames")
    all_entities: List[str] = Field(default_factory=list, description="Deduplicated entities across all frames")
    overall_visual_style: Optional[str] = Field(default=None, description="polished/ugc/minimal/bold/editorial/corporate")
    platform_fit: Optional[str] = Field(default=None, description="good/fair/poor")
    platform_fit_score: Optional[float] = Field(default=None, ge=1.0, le=10.0, description="1–10 numeric fit score")
    brand_detected: Optional[str] = Field(default=None, description="Primary brand or logo detected")
    platform_suggestions: Optional[str] = Field(default=None, description="Platform-specific improvement suggestions")
```

**Modify `QuantitativeMetrics`** — add one optional field, everything else unchanged:
```python
class QuantitativeMetrics(BaseModel):
    text_data: TextAnalysis
    vision_data: VisionAnalysis
    media_decomposition: Optional[MediaDecomposition] = Field(default=None)   # NEW — Phase 1
    trend_data: Optional[TrendAnalysis] = ...
    # ... rest of fields unchanged
```

**`EvaluationResponse` stays entirely unchanged** — it accesses `MediaDecomposition` via `quantitative_metrics.media_decomposition`.

---

### 2b. New Function: `run_media_decomposition()`
**File**: `backend/main.py`, insert immediately after the existing `run_vision_pipeline()` function (~line 425).

**Signature**: `run_media_decomposition(file_path: str, is_video: bool, platform: str = "Meta", ad_placements: str = "") -> Optional[MediaDecomposition]`

**Full implementation logic**:

```python
def run_media_decomposition(file_path, is_video, platform="Meta", ad_placements=""):
    import json as _json

    with open(file_path, "rb") as f:
        file_bytes = f.read()
    file_size_mb = len(file_bytes) / (1024 * 1024)

    # MIME type for video or image
    ext = os.path.splitext(file_path)[1].lower()
    if is_video:
        mime_map = {".mp4": "video/mp4", ".mov": "video/quicktime",
                    ".avi": "video/avi", ".mkv": "video/x-matroska", ".webm": "video/webm"}
    else:
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                    ".png": "image/png", ".webp": "image/webp",
                    ".gif": "image/gif", ".bmp": "image/bmp"}
    mime = mime_map.get(ext, "video/mp4" if is_video else "image/jpeg")

    # Resolve platform/placement context (reuse the existing PLACEMENT_CONTEXT dict already in main.py)
    placements_list = [p.strip() for p in ad_placements.split(",") if p.strip()] if ad_placements else []
    platform_contexts = PLACEMENT_CONTEXT.get(platform, {})
    ctx_parts = [platform_contexts.get(pl) for pl in placements_list if platform_contexts.get(pl)]
    placement_context = " | ".join(ctx_parts) if ctx_parts else platform_contexts.get("_default", "social media ad")

    media_label = "video" if is_video else "image"

    # Structured decomposition prompt
    prompt = (
        f"You are a media intelligence analyst. Analyze this advertisement {media_label} comprehensively.\n\n"
        f"Context: This creative is for {platform}. {placement_context}\n\n"
        "CRITICAL: Be exhaustive. Capture EVERY text element in ANY frame, every brand/logo, every scene change, "
        "all identifiable entities (people, products, places, organizations).\n\n"
        "Return ONLY valid JSON (no markdown fences, no explanation):\n"
        "{\n"
        f'  "media_type": "{media_label}",\n'
        '  "duration_seconds": 30.5,\n'
        '  "scenes": [\n'
        '    {\n'
        '      "scene_number": 1,\n'
        '      "start_seconds": 0.0,\n'
        '      "end_seconds": 4.2,\n'
        '      "duration_seconds": 4.2,\n'
        '      "primary_setting": "Modern kitchen with marble countertops",\n'
        '      "key_entities": ["Nike", "running shoe", "athlete"],\n'
        '      "visual_summary": "Athlete laces up shoes at kitchen counter",\n'
        '      "all_ocr_text": ["JUST DO IT", "nike.com", "NEW COLLECTION"]\n'
        '    }\n'
        '  ],\n'
        '  "audio": {\n'
        '    "has_audio": true,\n'
        '    "description": "Upbeat hip-hop with female voice-over: \'This summer, move differently\'"\n'
        '  },\n'
        '  "all_extracted_text": ["JUST DO IT", "nike.com", "NEW COLLECTION"],\n'
        '  "all_entities": ["Nike", "running shoe", "athlete", "kitchen"],\n'
        '  "overall_visual_style": "polished",\n'
        '  "platform_fit": "good",\n'
        '  "platform_fit_score": 8.5,\n'
        '  "brand_detected": "Nike",\n'
        f'  "platform_suggestions": "Add captions — 85% of {platform} video is watched muted"\n'
        "}"
    )

    # Video upload strategy: inline for ≤20MB, Files API for larger
    response = None
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if not is_video or file_size_mb <= 20.0:
                # Inline bytes — same approach as current image handling
                response = gemini_client.models.generate_content(
                    model="gemini-3-flash-preview",
                    contents=[
                        types.Part.from_bytes(data=file_bytes, mime_type=mime),
                        prompt,
                    ],
                )
            else:
                # Files API for large videos (>20MB)
                uploaded = gemini_client.files.upload(
                    file=file_path,
                    config=types.UploadFileConfig(mime_type=mime, display_name="ad_video"),
                )
                # Files API processes async — poll until ready
                while uploaded.state.name == "PROCESSING":
                    time.sleep(2)
                    uploaded = gemini_client.files.get(name=uploaded.name)
                response = gemini_client.models.generate_content(
                    model="gemini-3-flash-preview",
                    contents=[uploaded, prompt],
                )
            if response and response.text:
                break
        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt + 1
                print(f"⚠️  Media decomposition attempt {attempt + 1}/{max_retries} failed ({e}), retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise

    text = (response.text if response else None)
    if not text:
        return None

    # Strip markdown fences (same pattern as existing vision parser)
    text = text.strip()
    fence = "```"
    if text.startswith(fence):
        text = "\n".join(text.split("\n")[1:])
    if text.endswith(fence):
        text = text[:-3]
    text = text.strip()
    if text.startswith("json"):
        text = text[4:].strip()

    try:
        data = _json.loads(text)
    except _json.JSONDecodeError:
        return MediaDecomposition(
            media_type=media_label, scenes=[],
            all_extracted_text=[text[:200]], all_entities=[],
        )

    # Parse scenes list
    scenes = []
    for s in (data.get("scenes") or []):
        try:
            scenes.append(SceneBreakdown(
                scene_number=int(s.get("scene_number", 1)),
                start_seconds=float(s.get("start_seconds", 0.0)),
                end_seconds=float(s.get("end_seconds", 0.0)),
                duration_seconds=float(s.get("duration_seconds", 0.0)),
                primary_setting=str(s.get("primary_setting", "")),
                key_entities=list(s.get("key_entities") or []),
                visual_summary=str(s.get("visual_summary", "")),
                all_ocr_text=list(s.get("all_ocr_text") or []),
            ))
        except Exception:
            continue  # malformed scene — skip, don't crash

    # Parse audio (only for video)
    audio_raw = data.get("audio") or {}
    audio = AudioDescription(
        has_audio=bool(audio_raw.get("has_audio", False)),
        description=audio_raw.get("description"),
    ) if (is_video and audio_raw) else None

    # Clamp platform_fit_score to 1–10
    pfs_raw = data.get("platform_fit_score")
    platform_fit_score = None
    if pfs_raw is not None:
        try:
            platform_fit_score = max(1.0, min(10.0, float(pfs_raw)))
        except (ValueError, TypeError):
            platform_fit_score = None

    return MediaDecomposition(
        media_type=data.get("media_type", media_label),
        duration_seconds=float(data["duration_seconds"]) if data.get("duration_seconds") else None,
        scenes=scenes,
        audio=audio,
        all_extracted_text=list(data.get("all_extracted_text") or []),
        all_entities=list(data.get("all_entities") or []),
        overall_visual_style=data.get("overall_visual_style"),
        platform_fit=data.get("platform_fit"),
        platform_fit_score=platform_fit_score,
        brand_detected=data.get("brand_detected"),
        platform_suggestions=data.get("platform_suggestions"),
    )
```

---

### 2c. New Helper: `media_decomp_to_vision_analysis()`
**File**: `backend/main.py`, insert immediately after `run_media_decomposition()`

Extracts a `VisionAnalysis`-compatible snapshot from a `MediaDecomposition`. This is what allows all 143 existing tests to remain green — every downstream consumer of `VisionAnalysis` fields gets them via this compat layer.

```python
def media_decomp_to_vision_analysis(md: MediaDecomposition) -> VisionAnalysis:
    """
    Extract a VisionAnalysis-compatible snapshot from a MediaDecomposition.
    Preserves backward compat with EvaluationResponse.quantitative_metrics.vision_data
    and the existing 'vision_data' SSE event / frontend store.vision shape.
    """
    all_text = " | ".join(md.all_extracted_text) if md.all_extracted_text else None
    is_cluttered = (len(md.scenes) > 6 or len(md.all_extracted_text) > 12)
    return VisionAnalysis(
        visual_tags=md.all_entities or [],
        extracted_text=all_text,
        brand_detected=md.brand_detected,
        style_assessment=md.overall_visual_style,
        is_cluttered=is_cluttered,
        platform_fit=md.platform_fit,
        platform_fit_score=md.platform_fit_score,
        platform_suggestions=md.platform_suggestions,
    )
```

---

### 2d. Modify the SSE Streaming Endpoint (`evaluate_ad_stream`)

**File**: `backend/main.py`, inside `event_stream()`, STEP 1 block, around line 1585.

**Before** (current code):
```python
yield send_starting("Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)", total_steps)
vision_analysis, evt = await run_step(
    "Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)",
    "File: " + str(media_file.filename) + " (" + str(int(file_size_kb)) + "KB, " + media_desc + ")",
    lambda: run_vision_pipeline(tmp_path, is_video, platform, ad_placements),
)
if vision_analysis is None:
    vision_analysis = VisionAnalysis(visual_tags=["(vision failed)"], is_cluttered=False)
yield evt
ocr_text = (getattr(vision_analysis, "extracted_text", None) or "").replace("\n", " ").strip()
ocr_brand = (getattr(vision_analysis, "brand_detected", None) or "").replace("\n", " ").strip()
```

**After** (Phase 1):
```python
yield send_starting("Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)", total_steps)
media_decomp, evt = await run_step(
    "Visual Analysis + OCR", "Gemini 3 Flash Preview (multimodal)",
    "File: " + str(media_file.filename) + " (" + str(int(file_size_kb)) + "KB, " + media_desc + ")",
    lambda: run_media_decomposition(tmp_path, is_video, platform, ad_placements),
)
if media_decomp is not None:
    vision_analysis = media_decomp_to_vision_analysis(media_decomp)
else:
    vision_analysis = VisionAnalysis(visual_tags=["(vision failed)"], is_cluttered=False)
yield evt

# Emit legacy vision_data event (frontend backward compat)
yield "data: " + _json.dumps({'type': 'vision_data', 'data': vision_analysis.model_dump()}) + "\n\n"
# Emit new media_decomposition event (rich structured data)
if media_decomp:
    yield "data: " + _json.dumps({'type': 'media_decomposition', 'data': media_decomp.model_dump()}) + "\n\n"

# OCR text now sourced from ALL frames (not just middle frame)
if media_decomp:
    ocr_text = " | ".join(media_decomp.all_extracted_text).replace("\n", " ").strip()
    ocr_brand = (media_decomp.brand_detected or "").replace("\n", " ").strip()
else:
    ocr_text = ""
    ocr_brand = ""
```

**Also update `QuantitativeMetrics(...)` instantiation** in both endpoints:
```python
quant_metrics = QuantitativeMetrics(
    text_data=text_analysis,
    vision_data=vision_analysis,
    media_decomposition=media_decomp,    # NEW
    trend_data=trend_data,
    sem_metrics=sem_metrics,
    ...
)
```

**Also update the `vision_data` SSE event** — the old manual `yield "data: " + _json.dumps({'type': 'vision_data', ...})` that exists right after the run_step block. Remove it if present (the new code block above already emits it). Verify there is no duplicate emission.

---

### 2e. Modify the Sync Endpoint (`evaluate_ad`)

Apply the same swap — `run_vision_pipeline()` → `run_media_decomposition()` with compat helper — in the sync endpoint's STEP 1 block (around line 1220). The sync endpoint also does `ocr_text = ...` and `ocr_brand = ...` from `vision_analysis` so those need updating too.

---

### 2f. Import Cleanup

**Remove** `import cv2` from line 7 of `backend/main.py`.

**Verify** no other cv2 usage: `grep -n "cv2" backend/main.py` should return empty after removal.

**No new dependencies needed** — `google-genai` (already installed) handles native video upload via `types.Part.from_bytes` and the Files API.

---

## 3. Testing Strategy

### New Test File: `backend/tests/test_media_decomposition.py`
~300 lines, 22 tests, 5 classes. All Gemini calls mocked via the existing `_make_mock_gemini_response` helper from `helpers.py`.

**Class: `TestMediaDecompositionParsing`** (9 tests)

| Test | What it validates |
|------|------------------|
| `test_valid_json_returns_model` | Full valid JSON → `MediaDecomposition` populated correctly |
| `test_malformed_json_returns_minimal` | Invalid JSON → minimal fallback, no exception raised |
| `test_markdown_fences_stripped` | Response in ` ```json...``` ` → parses successfully |
| `test_empty_scenes_array` | `"scenes": []` → empty list, not an error |
| `test_fit_score_clamped_above_10` | `"platform_fit_score": 15` → clamped to 10.0 |
| `test_fit_score_clamped_below_1` | `"platform_fit_score": 0.2` → clamped to 1.0 |
| `test_fit_score_string_coerced` | `"platform_fit_score": "8.5"` → 8.5 float |
| `test_missing_audio_key` | No `"audio"` key in response → `audio=None`, no crash |
| `test_null_duration_for_image` | `"duration_seconds": null` → `None` in model |

**Class: `TestSceneBreakdownParsing`** (4 tests)

| Test | What it validates |
|------|------------------|
| `test_single_scene_parsed` | 1 scene → `SceneBreakdown` with all fields populated |
| `test_multiple_scenes_in_order` | 3 scenes → list of 3 `SceneBreakdown` in order |
| `test_scene_with_empty_ocr` | Scene has no text → `all_ocr_text=[]`, not an error |
| `test_malformed_scene_skipped` | One bad scene among good ones → bad scene skipped, rest parsed |

**Class: `TestOCRAndEntityDeduplication`** (3 tests)

| Test | What it validates |
|------|------------------|
| `test_all_extracted_text_populated` | Gemini returns text in scenes → `all_extracted_text` populated |
| `test_all_entities_populated` | Entities across scenes → `all_entities` populated |
| `test_compat_helper_joins_text` | `media_decomp_to_vision_analysis()` joins text with `" | "` |

**Class: `TestCompatHelper`** (4 tests)

| Test | What it validates |
|------|------------------|
| `test_compat_returns_vision_analysis` | Output type is `VisionAnalysis` |
| `test_compat_visual_tags_from_entities` | `all_entities` → `visual_tags` |
| `test_compat_brand_propagated` | `brand_detected` passes through |
| `test_compat_platform_fit_score_propagated` | `platform_fit_score` passes through |

**Class: `TestVideoVsImageMime`** (2 tests)

| Test | What it validates |
|------|------------------|
| `test_image_uses_image_mime` | `.jpg` input → `image/jpeg` mime type |
| `test_video_uses_video_mime` | `.mp4` input → `video/mp4` mime type |

### Updates to Existing Tests

**`backend/tests/test_models.py`** — Add `TestMediaDecomposition` class (12 tests):
- Valid `SceneBreakdown` construction with all fields
- Valid `AudioDescription` with `has_audio=True` and description
- Valid `AudioDescription` with `has_audio=False` and `description=None`
- Valid `MediaDecomposition` construction — all fields
- `MediaDecomposition` with empty `scenes` list
- `MediaDecomposition` with `duration_seconds=None` (image)
- `MediaDecomposition` with `audio=None` (image)
- `platform_fit_score` must be 1.0–10.0 (Pydantic ge/le enforcement)
- `QuantitativeMetrics` accepts `media_decomposition` as optional field
- `QuantitativeMetrics` with `media_decomposition=None` is valid
- `QuantitativeMetrics` with `media_decomposition=<MediaDecomposition>` is valid
- `EvaluationResponse` still constructs without changes (backward compat)

**`backend/tests/test_vision.py`** — Add `TestMediaDecompositionIntegration` class (3 tests):
- `run_media_decomposition()` exists and returns `MediaDecomposition` (not `VisionAnalysis`)
- `media_decomp_to_vision_analysis()` converts `MediaDecomposition` to `VisionAnalysis`
- OCR from `all_extracted_text` produces the same type as old `extracted_text`

**`backend/tests/test_api_stream.py`** — Add to `TestStreamingWithMedia` (2 new tests):
- `test_video_emits_media_decomposition_event` — response includes `{"type": "media_decomposition"}` event
- `test_both_vision_data_and_media_decomposition_emitted` — confirms backward compat: both `vision_data` and `media_decomposition` SSE events present

**Expected test counts**:
- 143 baseline tests: all green (no regressions)
- 22 new `test_media_decomposition.py` tests
- 12 new `test_models.py` tests
- 3 new `test_vision.py` tests
- 2 new `test_api_stream.py` tests
- **Total: 143 + 39 = 182 tests passing**

---

## 4. Frontend Changes

### `frontend-react/src/hooks/useAnalysis.js`

Add `mediaDecomposition: null` to `INITIAL_STORE` (line ~4):
```javascript
const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  mediaDecomposition: null,   // NEW — Phase 1
  sentiment: null,
  trends: null,
  sem: null,
  landing: null,
  reddit: null,
  benchmark: null,
  alignment: null,
  audience: null,
  linkedin: null,
  competitor: null,
  diagnostic: '',
}
```

Add `media_decomposition` handler in the SSE event loop (~line 130):
```javascript
} else if (evt.type === 'media_decomposition') {
  setStore(prev => {
    const n = { ...prev, mediaDecomposition: evt.data };
    storeRef.current = n;
    return n;
  })
}
```

The existing `vision_data` handler is unchanged. `store.vision` still receives `VisionAnalysis`.

### `frontend-react/src/components/results/MediaSection.jsx` (NEW)

Simple display component — no node graph yet (Phase 7), just scene cards:

```jsx
export function MediaSection({ data }) {
  return (
    <section>
      <h2>Media Decomposition</h2>

      {/* Audio bar */}
      {data.audio && (
        <div className="audio-callout">
          {data.audio.has_audio ? `🎵 ${data.audio.description}` : 'No audio detected'}
        </div>
      )}

      {/* All extracted text */}
      {data.all_extracted_text?.length > 0 && (
        <div>
          <h3>Text Across All Frames ({data.all_extracted_text.length} items)</h3>
          <div className="tag-cloud">
            {data.all_extracted_text.map((t, i) => <span key={i} className="tag">{t}</span>)}
          </div>
        </div>
      )}

      {/* All entities */}
      {data.all_entities?.length > 0 && (
        <div>
          <h3>Entities Detected ({data.all_entities.length})</h3>
          <div className="chip-row">
            {data.all_entities.map((e, i) => <span key={i} className="chip">{e}</span>)}
          </div>
        </div>
      )}

      {/* Scene timeline */}
      {data.scenes?.length > 0 && (
        <div>
          <h3>Scene Timeline ({data.scenes.length} scenes)</h3>
          {data.scenes.map((scene) => (
            <div key={scene.scene_number} className="scene-card">
              <strong>Scene {scene.scene_number}</strong> — {scene.duration_seconds.toFixed(1)}s
              <p>{scene.visual_summary}</p>
              <div>Setting: {scene.primary_setting}</div>
              {scene.all_ocr_text.length > 0 && <div>Text: {scene.all_ocr_text.join(', ')}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
```

### `frontend-react/src/components/Results.jsx`

Import and conditionally render `<MediaSection>`:
```jsx
import { MediaSection } from './results/MediaSection'

// In the results render, after the vision section:
{store.mediaDecomposition && <MediaSection data={store.mediaDecomposition} />}
```

### Frontend Tests — `useAnalysis.test.js`

Add 2 tests to the existing `useAnalysis` describe block:
- `test_initial_store_has_media_decomposition_null` — `store.mediaDecomposition` starts as `null`
- `test_media_decomposition_event_populates_store` — `media_decomposition` SSE event → `store.mediaDecomposition` populated

---

## 5. Full Execution Checklist

### Backend (in order)
- [ ] `grep -n "cv2" backend/main.py` — note all cv2 usage locations before removing
- [ ] Add `SceneBreakdown`, `AudioDescription`, `MediaDecomposition` to `backend/models.py`
- [ ] Add `media_decomposition: Optional[MediaDecomposition]` to `QuantitativeMetrics`
- [ ] Write `backend/tests/test_media_decomposition.py` (22 tests) — **tests first**
- [ ] Add 12 model tests to `backend/tests/test_models.py`
- [ ] Run `make test-unit` to confirm model tests pass (fast, no ML loading)
- [ ] Implement `run_media_decomposition()` in `backend/main.py` after line ~420
- [ ] Implement `media_decomp_to_vision_analysis()` immediately after
- [ ] Modify SSE endpoint STEP 1: swap `run_vision_pipeline` → `run_media_decomposition` + compat helper
- [ ] Modify sync endpoint STEP 1: same swap
- [ ] Add `media_decomposition=media_decomp` to both `QuantitativeMetrics(...)` instantiations
- [ ] Remove `import cv2` from `backend/main.py` line 7
- [ ] Add 3 tests to `test_vision.py`, 2 tests to `test_api_stream.py`
- [ ] Run `make test` — target: **182 tests, 0 failures**

### Frontend (in order)
- [ ] Update `INITIAL_STORE` in `useAnalysis.js` (add `mediaDecomposition: null`)
- [ ] Add `media_decomposition` SSE event handler in `useAnalysis.js`
- [ ] Create `frontend-react/src/components/results/MediaSection.jsx`
- [ ] Import and render in `Results.jsx`
- [ ] Add 2 tests to `useAnalysis.test.js`
- [ ] Run `npm test` — all passing

### Integration (manual)
- [ ] Upload `sample_video.mp4` — confirm `media_decomposition` object in response
- [ ] Confirm `scenes` array has >1 scene for a typical video
- [ ] Confirm `all_extracted_text` has more items than old single-frame `extracted_text`
- [ ] Confirm audio description is populated
- [ ] Confirm frontend renders `<MediaSection>` without console errors

---

## 6. Success Criteria

| Criterion | How to verify |
|-----------|---------------|
| 143 existing tests green | `make test` — no regressions |
| 39 new tests pass | `make test` output |
| `cv2` import gone | `grep "import cv2" backend/main.py` → empty |
| Video returns multi-scene `MediaDecomposition` | Integration test with sample_video.mp4 |
| `all_extracted_text` contains text from multiple frames | Compare field length to old `extracted_text` |
| Audio description present for video inputs | Check `media_decomp.audio.description` |
| Both `vision_data` AND `media_decomposition` SSE events emitted | `test_api_stream.py` |
| `store.vision` unchanged shape (frontend backward compat) | `useAnalysis.test.js` |
| `store.mediaDecomposition` populated for video inputs | `useAnalysis.test.js` |
| Frontend `<MediaSection>` renders scenes, text, entities | Browser inspection |

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `gemini-3-flash-preview` video processing fails or times out | Medium | High | ≤20MB inline; test early with sample_video.mp4; keep old cv2 fallback in a feature flag if needed |
| Gemini response JSON structure differs from prompt template | Medium | Medium | Robust parser: fallback at every field, never crash on missing keys, always return *something* |
| `types.UploadFileConfig` not in installed google-genai version | Low | Medium | Check `google-genai` version; use `files.upload(file=path, mime_type=...)` if `UploadFileConfig` unavailable |
| Removing `import cv2` breaks something unexpected | Low | High | `grep -rn cv2 backend/` before removing; it's only used in `run_vision_pipeline()` |
| SSE `vision_data` event emitted twice (duplicate) | Low | Low | Audit that the old manual emit is removed after refactor; integration test catches this |
| Large video upload to Files API stalls | Low | Medium | 60-second polling timeout; if state never leaves PROCESSING, raise exception and return minimal fallback |

---

## 8. Key File Locations (quick reference)

| What | File | Lines |
|------|------|-------|
| `run_vision_pipeline()` to replace | `backend/main.py` | ~239–420 |
| `PLACEMENT_CONTEXT` dict (reused) | `backend/main.py` | ~269–341 |
| `import cv2` to remove | `backend/main.py` | line 7 |
| SSE STEP 1 (call site to modify) | `backend/main.py` | ~1585–1605 |
| Sync endpoint STEP 1 (call site to modify) | `backend/main.py` | ~1220–1240 |
| `QuantitativeMetrics` model | `backend/models.py` | ~130–155 |
| `VisionAnalysis` model | `backend/models.py` | ~30–45 |
| `EvaluationResponse` model | `backend/models.py` | ~165–175 |
| Frontend SSE event loop | `frontend-react/src/hooks/useAnalysis.js` | ~95–145 |
| `INITIAL_STORE` | `frontend-react/src/hooks/useAnalysis.js` | ~3–16 |
| Results component render | `frontend-react/src/components/Results.jsx` | varies |


### 1. New Pydantic Models

#### `MediaDecomposition` (NEW)
Replaces the single-point-in-time `VisionAnalysis` with a structured timeline.

```python
class FrameAnalysis(BaseModel):
    """A single frame's analysis."""
    frame_number: int
    timestamp_seconds: float  
    ocr_text: list[str]  # All text visible in this frame
    visual_tags: list[str]  # Objects, people, settings
    entities_detected: list[str]  # Brands, people, places
    scene_description: str

class SceneBreakdown(BaseModel):
    """A contiguous scene with consistent visual context."""
    scene_number: int
    start_frame: int
    end_frame: int
    duration_seconds: float
    primary_setting: str
    key_entities: list[str]
    visual_summary: str
    all_ocr_text: list[str]  # Deduplicated OCR from all frames in scene

class AudioDescription(BaseModel):
    """What Gemini hears in the audio track."""
    has_audio: bool
    description: str | None  # "Upbeat electronic music", "Voice-over in English", etc.
    # Future: song_name, artist (Phase 2)

class MediaDecomposition(BaseModel):
    """Full video/image decomposition from Gemini."""
    media_type: str  # "image", "video"
    duration_seconds: float | None  # None for images
    num_frames: int | None  # None for images
    scenes: list[SceneBreakdown]
    audio: AudioDescription
    all_extracted_text: list[str]  # Deduplicated across all frames/scenes
    all_entities: list[str]  # Deduplicated across all frames/scenes
    overall_visual_style: str
    platform_fit: str
    platform_fit_score: float  # 0-10
    brand_detected: str | None
```

#### Modify Existing Models
- `VisionAnalysis` stays but is **deprecated in the Phase 1 context**
- Eventually replaced in the response pipeline, but for Phase 0 test compatibility, keep it for image-only paths

#### `EvaluationResponse` Update
Add new field:
```python
media_decomposition: MediaDecomposition | None
```

---

### 2. New Backend Functions

#### `run_media_decomposition(media_input, media_type, platform, placement) -> MediaDecomposition`
**File**: `backend/main.py` (new function, ~200 lines)

**Input**:
- `media_input`: bytes (video or image)
- `media_type`: "image" or "video"
- `platform`: "Meta", "Google", "TikTok", etc.
- `placement`: "Feed", "Stories", "In-Stream", etc.

**Logic**:
1. If `media_type == "image"`:
   - Convert bytes to PIL Image
   - Prepare as Gemini Part for vision API
   
2. If `media_type == "video"`:
   - Send video bytes directly to Gemini (native video upload)
   - Gemini 3 Flash now supports native video natively — no cv2 frame extraction needed

3. Use a **detailed structured prompt** to Gemini asking for:
   - Scene-by-scene breakdown with timing
   - Every text string visible in every frame (dense OCR)
   - All visual entities (brands, people, objects, settings)
   - Audio description
   - Overall platform fit assessment

4. Gemini returns JSON or markdown with structure

5. **Parse response** into `MediaDecomposition` model with fallback handling:
   - Invalid JSON → try markdown parsing
   - Missing fields → defaults (empty lists, None for optional)
   - Score clamping (0-10)

6. Return `MediaDecomposition`

**Gemini Prompt Template**:
```
Analyze this [video/image] as if you're a media strategist breaking down an advertisement.

### Output a JSON object with this structure:
{
  "scenes": [
    {
      "scene_number": 1,
      "start_frame": 0,
      "end_frame": 120,
      "duration_seconds": 4.0,
      "primary_setting": "Modern office",
      "key_entities": ["Microsoft", "laptop", "woman"],
      "visual_summary": "Woman typing on laptop at desk",
      "all_ocr_text": ["Microsoft Office", "365", "www.microsoft.com"]
    }
  ],
  "audio": {
    "has_audio": true,
    "description": "Upbeat electronic music with light ambient sound"
  },
  "all_extracted_text": [...],
  "all_entities": [...],
  "overall_visual_style": "professional, modern",
  "platform_fit": "good [for {platform} {placement}]",
  "platform_fit_score": 8.2,
  "brand_detected": "Microsoft"
}

Be exhaustive: capture every text element, every identifiable object, every scene change. This is for comprehensive media planning.
```

#### Modify `run_vision_pipeline()`
**Current behavior**: Extract single frame via cv2, send to Gemini
**New behavior**: Route to `run_media_decomposition()` instead

The old logic becomes:
```python
def run_vision_pipeline(media_input, media_type, platform="Meta", placement="Feed"):
    """
    Unified vision pipeline: image → image decomposition, video → full decomposition.
    """
    if not media_input:
        return None
    
    return run_media_decomposition(media_input, media_type, platform, placement)
```

---

### 3. API Changes

#### `/api/v1/evaluate_ad` and `/api/v1/evaluate_ad_stream`
- Both endpoints already accept `ad_image` (bytes) and `ad_video` (bytes)
- **No endpoint signature changes**
- Internally they now call `run_media_decomposition()` instead of the old cv2-based vision
- Response includes `media_decomposition: MediaDecomposition` field

#### SSE Event Changes
Add new event type for streaming:
```python
# In SSE streaming loop (main.py, around line 900)
await send_sse_event(writer, {
    "type": "media_decomposition",
    "name": "Media Decomposition",
    "data": media_decomposition.model_dump()
})
```

Frontend receives and stores in `useAnalysis` hook's store under `mediaDecomposition`.

---

### 4. Testing Strategy

#### New Test File: `backend/tests/test_media_decomposition.py`
**~280 lines**, 20 test cases across 5 test classes:

**Class: `TestMediaDecompositionParsing`** (8 tests)
- Valid JSON response from Gemini
- Malformed JSON fallback
- Markdown fence stripping
- Empty scenes array
- Score clamping (>10, <0)
- String coercion for numeric fields
- Missing optional fields (audio, brand_detected)
- All_extracted_text deduplication

**Class: `TestImageVsVideoPath`** (4 tests)
- Image input → single implicit scene
- Video input with 3 scenes
- Scene timing validation
- Frame number continuity

**Class: `TestOCRExtraction`** (3 tests)
- OCR text collected from all frames
- Deduplication across scenes
- all_extracted_text populated correctly

**Class: `TestEntityExtraction`** (3 tests)
- Entities from all scenes merged
- Deduplication
- all_entities field populated

**Class: `TestPlatformContext`** (2 tests)
- Platform-aware prompt variation ("for TikTok Stories")
- Placement hint in prompt

#### Update Existing Test Files
- `backend/tests/test_models.py`: Add `MediaDecomposition` validation tests (~12 tests)
- `backend/tests/test_api.py`: Add video decomposition to integration tests (3 tests)
- `backend/tests/test_api_stream.py`: Add media_decomposition SSE event test (2 tests)

**Total new tests**: 25
**Expected result**: All 143 existing tests stay green + 25 new tests pass = 168 total

---

### 5. Frontend Changes

#### Update `useAnalysis.js`
Add handling for new SSE event type:
```javascript
} else if (evt.type === 'media_decomposition') {
  setStore(prev => {
    const n = { ...prev, mediaDecomposition: evt.data };
    storeRef.current = n;
    return n;
  })
}
```

#### Update Results Component
In `frontend-react/src/components/results/OverviewHero.jsx` or new `MediaDecompositionView.jsx`:
- Display scene timeline (card for each scene)
- Show all extracted text, entities
- Audio description callout
- Platform fit score

**Optional for Phase 1** (can defer to Phase 7 when doing node visualization):
Just show raw scenes in a collapsible list. Don't build the fancy node graph yet.

---

## Execution Checklist

### Backend
- [ ] Write `backend/tests/test_media_decomposition.py` (20 tests)
- [ ] Implement `run_media_decomposition()` function with Gemini call + parsing
- [ ] Update `run_vision_pipeline()` to call `run_media_decomposition()`
- [ ] Add `MediaDecomposition`, `SceneBreakdown`, `FrameAnalysis`, `AudioDescription` models to `backend/models.py`
- [ ] Update `EvaluationResponse` to include `media_decomposition` field
- [ ] Add SSE event emission for `media_decomposition`
- [ ] Update existing tests: `test_models.py`, `test_api.py`, `test_api_stream.py` (~17 tests)
- [ ] Run full test suite: `make test` (target: 168 tests passing)

### Frontend
- [ ] Update `useAnalysis.js` to handle `media_decomposition` SSE event
- [ ] Create simple display component for scenes (defer fancy visualization to Phase 7)
- [ ] Update `Results.jsx` to render decomposition if present

### Integration
- [ ] Test `/api/v1/evaluate_ad` with sample video
- [ ] Test `/api/v1/evaluate_ad_stream` with sample video
- [ ] Verify frontend renders scenes, text, entities correctly

---

## Success Criteria

1. **All 143 baseline tests stay green** ✓
2. **25 new tests pass** ✓
3. **Video upload returns `MediaDecomposition` with**:
   - Multiple scenes (not just one frame)
   - Dense OCR text from all frames
   - All entities extracted
   - Audio description
   - Platform fit score
4. **SSE streaming emits `media_decomposition` event** ✓
5. **Frontend receives and displays decomposition** ✓
6. **Gemini 3 Flash handles native video natively** (no cv2 frame extraction)
7. **Graceful fallback**: If video parsing fails, returns `None` or minimal response; pipeline continues to NLP/trends

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini native video support differs from doc | High | Test with sample MP4 early, confirm format support |
| Response parsing needs tweaking for real Gemini output | Medium | Build flexible JSON → fallback → markdown parser |
| Video upload timeout (large files) | Medium | Set HTTP timeout to 60s, test with ~30MB videos |
| Audio description format varies | Low | Flexible parsing, test various Gemini responses |
| Scene boundaries inconsistent | Low | Accept any boundary format, deduplicate entities after parse |

---

## Timeline Estimate

- **Backend implementation**: 2-3 hours (models + function + parsing)
- **Backend tests**: 1.5-2 hours (writing + debugging)
- **Frontend**: 1 hour (SSE handler + simple display)
- **Integration & debugging**: 1-2 hours
- **Total**: ~6-8 hours

---

## Assumptions

1. Gemini 3 Flash supports native video upload (confirmed in Gemini docs as of March 2026)
2. `gemini-3-flash-preview` model string is still valid (currently in main.py)
3. GEMINI_API_KEY is set in environment
4. Test video fixture (sample_video.mp4) is already created in Phase 0

---

## References

- Current video handling: `backend/main.py` lines 237-400, `run_vision_pipeline()`
- Current vision model: `backend/models.py`, `VisionAnalysis` class
- Current API response: `backend/models.py`, `EvaluationResponse` class
- SSE streaming: `backend/main.py` lines 1700-1900, `/api/v1/evaluate_ad_stream`
- Frontend hook: `frontend-react/src/hooks/useAnalysis.js`
