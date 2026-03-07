# Phase 2: Audio Intelligence

**Goal**: Identify the song playing in a video ad using ffmpeg + AudD, then trend-profile that song via pytrends. Extend Phase 1's `AudioDescription` model with structured song metadata. Surface the result as a new SSE event and a new pipeline step.

**Gemini Model**: `gemini-3-flash-preview` — audio intelligence uses no Gemini calls. Gemini already described the audio in Phase 1. Phase 2 is deterministic: ffmpeg → AudD → pytrends.

**Prerequisite**: Phase 1 must be complete. Phase 2 depends on `MediaDecomposition`, `AudioDescription`, and `run_media_decomposition()` existing.

---

## 1. Current State — What Phase 1 Left Behind

### `AudioDescription` model (from Phase 1, in `backend/models.py`)

```python
class AudioDescription(BaseModel):
    """Gemini's description of the audio track. Phase 2 will add song identification."""
    has_audio: bool = Field(description="Whether the video has an audio track")
    description: Optional[str] = Field(default=None, description="Natural language description of audio")
```

Phase 2 extends this model to add:
```python
    song_id: Optional[SongIdentification] = Field(default=None, description="Song identified via AudD (None if no match)")
```

Phase 2 does NOT change any other field on `AudioDescription`. `has_audio` and `description` are untouched.

### `MediaDecomposition` model (from Phase 1)

```python
class MediaDecomposition(BaseModel):
    media_type: str
    duration_seconds: Optional[float]
    scenes: List[SceneBreakdown]
    audio: Optional[AudioDescription]   # <-- AudioDescription lives here
    all_extracted_text: List[str]
    all_entities: List[str]
    brand_detected: Optional[str]
    platform_fit: Optional[str]
    platform_fit_score: Optional[float]
    platform_suggestions: Optional[str]
```

`media_decomp.audio.song_id` is where Phase 2 data lands.

### Current pipeline step order (after Phase 1)

| Step | Name | Model/Method |
|------|------|-------------|
| 1 | Visual Analysis + OCR | `run_media_decomposition()` → Gemini 3 Flash |
| 2 | Named Entity Recognition | spaCy en_core_web_sm |
| 3 | Sentiment Analysis | RoBERTa |
| 4 | Hashtag Expansion | GloVe Twitter 50d |
| 5 | Trend Forecasting | pytrends |
| 6 | SEM Auction Simulation | Weighted QS engine |
| 7+ | Landing Page, Reddit, etc. | …varies… |

Phase 2 inserts a new step **between Step 1 and Step 2**: "Audio Intelligence". All existing step numbers shift by 1 for video inputs but the logic is identical. For text-only inputs, the step is skipped entirely.

### Existing dependencies relevant to Phase 2

From `backend/requirements.txt`:
- `httpx>=0.27.0` — already installed. Used to POST to AudD REST API.
- `pytrends>=4.9.2` — already installed. Used for song trend momentum.
- `python-dotenv>=1.0.0` — already installed. `AUDD_API_KEY` loaded via `load_dotenv()`.

**New system dependency**: `ffmpeg` binary (not a pip package). Must be available in `PATH`. Used to extract an audio snippet from video without loading the entire file into memory.

**New environment variable**: `AUDD_API_KEY` — AudD REST API token. If absent, the audio intelligence step is **skipped gracefully** with a `note` on the `PipelineStep` and `song_id=None`. Pipeline continues normally.

---

## 2. AudD API — Technical Reference

**Endpoint**: `POST https://api.audd.io/`
**Auth**: `api_token` in request body (form data)
**Input**: `audio` field — MP3 bytes (multipart) OR `url` field — URL to audio file
**Method**: Direct httpx POST, no third-party SDK needed (httpx already in requirements)

**Request structure**:
```python
async with httpx.AsyncClient(timeout=30.0) as client:
    response = await client.post(
        "https://api.audd.io/",
        data={"api_token": audd_api_key, "return": "timecode,spotify"},
        files={"audio": ("snippet.mp3", audio_bytes, "audio/mpeg")},
    )
```

**Response structure (success)**:
```json
{
    "status": "success",
    "result": {
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "album": "After Hours",
        "release_date": "2019-11-29",
        "label": "Republic Records",
        "timecode": "00:43",
        "song_link": "https://lis.tn/QzWIkn",
        "spotify": {
            "album": { "name": "After Hours", "release_date": "2020-03-20" },
            "external_ids": { "isrc": "USUG11904384" },
            "name": "Blinding Lights"
        }
    }
}
```

**Response structure (no match)**:
```json
{
    "status": "success",
    "result": null
}
```

**Error response** (invalid token, rate limit):
```json
{
    "status": "error",
    "error": { "error_code": 900, "error_message": "Wrong API token." }
}
```

**Rate limits**: Free tier = 300 requests/month. API is synchronous HTTP (no streaming). Typical response time: 2–5 seconds.

**What we use from the response**:
- `result.title` → `SongIdentification.title`
- `result.artist` → `SongIdentification.artist`
- `result.album` → `SongIdentification.album`
- `result.release_date` → `SongIdentification.release_date`
- `result.timecode` → `SongIdentification.match_timecode` (the position in the song that matched)
- Confidence: AudD doesn't return a confidence score directly. We treat any non-null `result` as confident.

---

## 3. Audio Extraction Strategy — ffmpeg Subprocess

### Why a 15-second snippet

AudD performs best on a 10–15 second audio clip. Sending the full video audio track:
- Wastes bandwidth (a 30-second .mp4 can be 5–30MB of audio)
- Takes longer to POST
- Doesn't improve accuracy (AudD fingerprints in windows anyway)

### ffmpeg extraction command

```bash
ffmpeg -i <input_video> -t 15 -vn -acodec libmp3lame -q:a 4 -f mp3 -y <output.mp3>
```

Flags:
- `-t 15`: only the first 15 seconds of audio
- `-vn`: no video (audio only)
- `-acodec libmp3lame`: encode as MP3 (AudD prefers MP3/WAV)
- `-q:a 4`: variable bitrate quality level 4 (~165 kbps) — enough for fingerprinting
- `-f mp3`: output format
- `-y`: overwrite output without asking

### Where in the video to sample

For ad content, the music usually starts immediately. Take seconds 0–15. If no audio is found in 0–15, the video likely has no music track that AudD can identify.

Alternative: skip to second 2 to avoid a cold open (e.g., `ffmpeg -ss 2 -i <input> -t 15 ...`). Use `-ss 2` as default.

### ffmpeg availability check

```python
import shutil
ffmpeg_available = shutil.which("ffmpeg") is not None
```

If `ffmpeg` is not in PATH: skip audio extraction entirely, `song_id=None`, log a warning.

### Python implementation pattern

```python
import subprocess
import tempfile
import shutil

def extract_audio_snippet(video_path: str, start_sec: int = 2, duration_sec: int = 15) -> Optional[bytes]:
    """
    Extracts a short MP3 audio snippet from a video file using ffmpeg.
    Returns MP3 bytes, or None if ffmpeg unavailable or extraction fails.
    """
    if not shutil.which("ffmpeg"):
        print("⚠️  ffmpeg not found in PATH — audio extraction skipped")
        return None
    
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [
                "ffmpeg", "-ss", str(start_sec), "-i", video_path,
                "-t", str(duration_sec), "-vn",
                "-acodec", "libmp3lame", "-q:a", "4",
                "-f", "mp3", "-y", tmp_path,
            ],
            capture_output=True,
            timeout=30,  # 30-second hard timeout
        )
        if result.returncode != 0:
            print(f"⚠️  ffmpeg returned code {result.returncode}: {result.stderr.decode()[:200]}")
            return None
        
        with open(tmp_path, "rb") as f:
            return f.read()
    except subprocess.TimeoutExpired:
        print("⚠️  ffmpeg timed out after 30s")
        return None
    except Exception as e:
        print(f"⚠️  ffmpeg extraction failed: {e}")
        return None
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
```

---

## 4. Phase 2 Deliverables

### 4a. New Pydantic Model: `SongIdentification` in `backend/models.py`

Add **before** `AudioDescription`:

```python
class SongIdentification(BaseModel):
    """Song identified from video audio via AudD fingerprinting."""
    title: str = Field(description="Song title")
    artist: str = Field(description="Artist name")
    album: Optional[str] = Field(default=None, description="Album name")
    release_date: Optional[str] = Field(default=None, description="Release date string (YYYY-MM-DD or YYYY)")
    match_timecode: Optional[str] = Field(default=None, description="Position in song that matched (MM:SS format)")
    song_link: Optional[str] = Field(default=None, description="Listen link from AudD")
    trend_momentum: Optional[float] = Field(
        default=None,
        ge=0.0, le=1.0,
        description="Pytrends 7d/30d momentum for '{title} {artist}' (0-1 scale, None if unavailable)"
    )
```

### 4b. Modify `AudioDescription` in `backend/models.py`

**Existing** (Phase 1):
```python
class AudioDescription(BaseModel):
    has_audio: bool
    description: Optional[str]
```

**After Phase 2** (add one field, nothing else changes):
```python
class AudioDescription(BaseModel):
    has_audio: bool = Field(description="Whether the video has an audio track")
    description: Optional[str] = Field(default=None, description="Natural language description of audio")
    song_id: Optional[SongIdentification] = Field(
        default=None,
        description="Song identified via AudD audio fingerprinting. None if no music detected or no API key."
    )
```

**Backward compat**: `song_id` defaults to `None`. All Phase 1 tests that construct `AudioDescription` without `song_id` continue to pass — Pydantic's `Optional` with default handles this. No test changes required for Phase 1 tests.

### 4c. New Functions in `backend/main.py`

Insert all three functions immediately after `run_media_decomposition()` and `media_decomp_to_vision_analysis()`.

---

#### Function 1: `extract_audio_snippet()`

**Signature**: `extract_audio_snippet(video_path: str, start_sec: int = 2, duration_sec: int = 15) -> Optional[bytes]`

**Location**: Insert at ~line 430 (after `media_decomp_to_vision_analysis()`)

**Full implementation logic**:
1. Check `shutil.which("ffmpeg")` — return `None` immediately if missing
2. Create a `tempfile.NamedTemporaryFile(suffix=".mp3")`, get path, close it immediately (subprocess needs a path, not a handle)
3. Run `subprocess.run(["ffmpeg", "-ss", str(start_sec), "-i", video_path, "-t", str(duration_sec), "-vn", "-acodec", "libmp3lame", "-q:a", "4", "-f", "mp3", "-y", tmp_path], capture_output=True, timeout=30)`
4. Check `returncode != 0` → log stderr, return `None`
5. Read and return `tmp_path` bytes
6. `finally:` delete the temp file

**Imports needed**: `import subprocess` and `import shutil` — add both to `backend/main.py` imports at the top. Check `os` is already imported (it is).

---

#### Function 2: `identify_song_via_audd()` (async)

**Signature**: `async def identify_song_via_audd(audio_bytes: bytes) -> Optional[SongIdentification]`

**Full implementation logic**:
1. Get `audd_key = os.getenv("AUDD_API_KEY")` — return `None` if missing
2. POST to `https://api.audd.io/` with `httpx.AsyncClient(timeout=30.0)`:
   ```python
   resp = await client.post(
       "https://api.audd.io/",
       data={"api_token": audd_key, "return": "timecode"},
       files={"audio": ("snippet.mp3", audio_bytes, "audio/mpeg")},
   )
   ```
3. Parse JSON. If `data["status"] != "success"` or `data["result"] is None` → return `None`
4. `r = data["result"]`
5. Extract `title = r.get("title", "")`, `artist = r.get("artist", "")` — if either is falsy, return `None` (no match worth storing)
6. Construct and return `SongIdentification(title=title, artist=artist, album=r.get("album"), release_date=r.get("release_date"), match_timecode=r.get("timecode"), song_link=r.get("song_link"), trend_momentum=None)` — trend_momentum filled in by next function
7. Wrap everything in `try/except` — any network or JSON error → log + return `None`

---

#### Function 3: `get_song_trend_momentum()` (async wrapper)

**Signature**: `async def get_song_trend_momentum(title: str, artist: str) -> Optional[float]`

**Full implementation logic**:
1. Build query string: `keyword = f"{title} {artist}"` (e.g., `"Blinding Lights The Weeknd"`)
2. Call existing `run_trend_analysis([keyword], geo="US")` via `asyncio.get_event_loop().run_in_executor(None, run_trend_analysis, [keyword], "US")`
3. Return `trend_data.momentum if trend_data else None`
4. Wrap in `try/except` — pytrends can throw. Return `None` on failure.

**Note**: `run_trend_analysis()` is a synchronous blocking function (uses `TrendReq` which does blocking HTTP). It must be called in an executor to avoid blocking the event loop. The exact same executor pattern is used elsewhere in the SSE handler for other sync calls.

---

#### Function 4: `run_audio_intelligence()` (async orchestrator)

**Signature**: `async def run_audio_intelligence(video_path: str) -> Optional[SongIdentification]`

**Full implementation logic**:
1. Extract audio snippet: `audio_bytes = extract_audio_snippet(video_path)` — if `None`, return `None`
2. Identify song: `song = await identify_song_via_audd(audio_bytes)` — if `None`, return `None`
3. Get trend momentum: `momentum = await get_song_trend_momentum(song.title, song.artist)` — if `None`, song still valid
4. Return `song.model_copy(update={"trend_momentum": momentum})`

**This function returns `Optional[SongIdentification]`**, not `AudioDescription`. The SSE endpoint attaches the result to `media_decomp.audio.song_id` via the compat pattern.

---

### 4d. Wire into SSE Endpoint (`evaluate_ad_stream`)

**Location**: `backend/main.py`, inside `event_stream()`, AFTER the current STEP 1 block (vision), BEFORE the STEP 2 NER block.

**Insert new step** (becomes new STEP 2, everything else shifts +1):

```python
# STEP 2: Audio Intelligence (video only, requires AUDD_API_KEY + ffmpeg)
if is_video and has_media:
    yield send_starting("Audio Intelligence", "ffmpeg + AudD + pytrends", total_steps)
    song_id, evt = await run_step(
        "Audio Intelligence", "ffmpeg (audio extract) → AudD (fingerprint) → pytrends (momentum)",
        "Video: " + str(media_file.filename) + " — extracting 15s audio snippet",
        lambda: asyncio.get_event_loop().run_until_complete(run_audio_intelligence(tmp_path)),
    )
    yield evt
    
    # Attach song_id to media_decomp.audio (if both exist and audio intelligence succeeded)
    if song_id is not None and media_decomp is not None and media_decomp.audio is not None:
        media_decomp = media_decomp.model_copy(
            update={"audio": media_decomp.audio.model_copy(update={"song_id": song_id})}
        )
    
    # Emit new SSE event
    if song_id is not None:
        yield "data: " + _json.dumps({"type": "audio_intelligence_data", "data": song_id.model_dump()}) + "\n\n"
else:
    # Text-only or image — skip silently (no PipelineStep emitted, frontend handles absent event)
    pass
```

**Note on `total_steps`**: The `total_steps` variable in the SSE handler is computed before the loop. After Phase 2, for video inputs, `total_steps` must be incremented by 1. Locate where `total_steps` is set and add:

```python
# Before Phase 2 addition (current code):
total_steps = 10  # or however it's computed

# After Phase 2 addition:
total_steps = 11 if is_video else 10  # +1 step for audio intelligence on video
```

Read the exact pattern used for `total_steps` in the current code and match it.

---

### 4e. Wire into Sync Endpoint (`evaluate_ad`)

**Location**: `backend/main.py`, sync endpoint STEP 1 block, similarly after vision, before NER.

The sync endpoint uses the `_step()` helper (a synchronous analog). Since `run_audio_intelligence()` is async, call it with:
```python
import asyncio
song_id = asyncio.run(run_audio_intelligence(tmp_path)) if is_video else None
```

Then attach to `media_decomp.audio.song_id` using the same `model_copy` pattern.

---

### 4f. Import Additions at Top of `backend/main.py`

Add two new stdlib imports (no pip installs):

```python
import subprocess   # for ffmpeg extraction
import shutil       # for shutil.which("ffmpeg") availability check
```

These go after `import os` at line ~7. Both are Python stdlib — no changes to `requirements.txt`.

---

### 4g. Environment Variable

**Variable name**: `AUDD_API_KEY`
**Where obtained**: https://dashboard.audd.io → "API Token" on the free plan
**Free tier**: 300 recognitions/month — development is fine, production needs paid plan (~$0.001/recognition)

**Add to `.env` example** (if project has one):
```
AUDD_API_KEY=your_audd_api_token_here
```

**Graceful degradation if absent**:
- `identify_song_via_audd()` returns `None` immediately at line 1 when key is missing
- `PipelineStep` for Audio Intelligence sets `status="warning"`, `note="AUDD_API_KEY not set — song identification skipped"`
- `song_id=None` everywhere in the response
- **All 182 Phase 1 tests continue to pass** — no `AUDD_API_KEY` in test environment is the expected default

---

## 5. Testing Strategy

### New Test File: `backend/tests/test_audio_intelligence.py`
~280 lines, 22 tests, 6 classes.

**Class: `TestExtractAudioSnippet`** (5 tests)

| Test | What it validates |
|------|------------------|
| `test_ffmpeg_not_found_returns_none` | Mock `shutil.which` to return `None` → function returns `None` without raising |
| `test_ffmpeg_nonzero_exit_returns_none` | Mock `subprocess.run` to return `returncode=1` → returns `None` |
| `test_ffmpeg_timeout_returns_none` | Mock `subprocess.run` to raise `subprocess.TimeoutExpired` → returns `None` |
| `test_successful_extraction_returns_bytes` | Mock `subprocess.run` to write fake bytes to tmp path → returns bytes |
| `test_temp_file_cleaned_up_after_success` | After successful call, temp mp3 file is deleted from disk |

**Class: `TestIdentifySongViaAudd`** (6 tests)

| Test | What it validates |
|------|------------------|
| `test_no_api_key_returns_none` | `AUDD_API_KEY` not set → returns `None` immediately |
| `test_successful_response_returns_song` | Mock httpx: valid AudD response → `SongIdentification` with all fields |
| `test_null_result_returns_none` | AudD returns `"result": null` → returns `None` |
| `test_error_status_returns_none` | AudD returns `"status": "error"` → returns `None` |
| `test_missing_title_returns_none` | AudD result has no `"title"` key → returns `None` |
| `test_network_failure_returns_none` | Mock httpx to raise `httpx.NetworkError` → catches exception, returns `None` |

**Class: `TestGetSongTrendMomentum`** (3 tests)

| Test | What it validates |
|------|------------------|
| `test_returns_float_when_pytrends_succeeds` | Mock `run_trend_analysis` to return `TrendAnalysis(momentum=0.72, ...)` → returns `0.72` |
| `test_returns_none_when_pytrends_fails` | Mock `run_trend_analysis` to raise exception → returns `None`, no crash |
| `test_query_string_is_title_plus_artist` | Verify `run_trend_analysis` is called with `["{title} {artist}"]` (not just title) |

**Class: `TestRunAudioIntelligence`** (4 tests)

| Test | What it validates |
|------|------------------|
| `test_no_audio_extract_returns_none` | `extract_audio_snippet` returns `None` → `run_audio_intelligence` returns `None` |
| `test_no_song_match_returns_none` | `identify_song_via_audd` returns `None` → `run_audio_intelligence` returns `None` |
| `test_full_pipeline_returns_song_with_momentum` | All three inner functions succeed → returns `SongIdentification` with `trend_momentum` set |
| `test_trend_failure_still_returns_song` | `get_song_trend_momentum` returns `None` → still returns `SongIdentification` with `trend_momentum=None` |

**Class: `TestAudioDescriptionExtension`** (2 tests)

| Test | What it validates |
|------|------------------|
| `test_audio_description_accepts_song_id` | `AudioDescription(has_audio=True, song_id=SongIdentification(...))` → valid model |
| `test_audio_description_song_id_defaults_none` | `AudioDescription(has_audio=True)` → `song_id=None` (backward compat) |

**Class: `TestSongTrendMomentumClamping`** (2 tests)

| Test | What it validates |
|------|------------------|
| `test_momentum_stored_on_model` | `SongIdentification(title="X", artist="Y", trend_momentum=0.72)` → `trend_momentum=0.72` |
| `test_momentum_ge_0_le_1_enforced` | `SongIdentification(..., trend_momentum=1.5)` → Pydantic `ValidationError` |

---

### Updates to Existing Test Files

**`backend/tests/test_models.py`** — Add `TestSongIdentification` class (8 tests):
- Valid `SongIdentification` construction with all fields
- Valid `SongIdentification` with only required fields (`title`, `artist`)
- `trend_momentum` accepts `None`
- `trend_momentum` enforces `ge=0.0`
- `trend_momentum` enforces `le=1.0`
- `AudioDescription` with `song_id=None` is valid (backward compat)
- `AudioDescription` with `song_id=<SongIdentification>` is valid
- `MediaDecomposition.audio.song_id` is traversable (nested access test)

**`backend/tests/test_api_stream.py`** — Add 2 new tests:
- `test_video_emits_audio_intelligence_event_when_key_set` — with mocked AUDD key + mocked AudD response → `audio_intelligence_data` event is in the SSE stream
- `test_video_skips_audio_step_when_no_key` — no `AUDD_API_KEY` in env → no `audio_intelligence_data` event, no crash, all other steps present

**Expected test counts**:
- 182 baseline (after Phase 1)
- 22 new `test_audio_intelligence.py` tests
- 8 new `test_models.py` tests
- 2 new `test_api_stream.py` tests
- **Total: 182 + 32 = 214 tests passing**

---

## 6. Frontend Changes

### `frontend-react/src/hooks/useAnalysis.js`

**Add `audioIntelligence: null` to `INITIAL_STORE`**:
```javascript
const INITIAL_STORE = {
  steps: [],
  text: null,
  vision: null,
  mediaDecomposition: null,   // Phase 1
  audioIntelligence: null,    // Phase 2 (NEW)
  sentiment: null,
  trends: null,
  // ...rest unchanged
}
```

**Add handler in SSE event loop**:
```javascript
} else if (evt.type === 'audio_intelligence_data') {
  setStore(prev => ({ ...prev, audioIntelligence: evt.data }))
}
```

### `frontend-react/src/components/results/AudioSection.jsx` (NEW)

Simple display card — not a visualization, just structured data:

```jsx
import React from 'react'

export function AudioSection({ data }) {
  if (!data) return null

  return (
    <div className="audio-section">
      <h3>🎵 Music Detected</h3>
      <div className="song-card">
        <div className="song-title">{data.title}</div>
        <div className="song-artist">{data.artist}</div>
        {data.album && <div className="song-album">{data.album}</div>}
        {data.release_date && <div className="song-release">Released: {data.release_date}</div>}
        {data.trend_momentum != null && (
          <div className="song-momentum">
            Song Trend Momentum: {(data.trend_momentum * 100).toFixed(0)}%
          </div>
        )}
        {data.song_link && (
          <a href={data.song_link} target="_blank" rel="noopener noreferrer">
            Listen
          </a>
        )}
      </div>
    </div>
  )
}
```

### `frontend-react/src/components/Results.jsx`

```jsx
import { AudioSection } from './results/AudioSection'

// In the results render, after MediaSection:
{store.audioIntelligence && <AudioSection data={store.audioIntelligence} />}
```

### Frontend Tests

Add 2 tests to `useAnalysis.test.js`:
- `test_initial_store_has_audio_intelligence_null` — `store.audioIntelligence` starts as `null`
- `test_audio_intelligence_event_populates_store` — `audio_intelligence_data` SSE event → `store.audioIntelligence` populated with song data

---

## 7. Full Execution Checklist

### Pre-flight
- [ ] Verify `ffmpeg` is installed: `which ffmpeg` — if missing, install via `brew install ffmpeg` (macOS)
- [ ] Obtain `AUDD_API_KEY` from https://dashboard.audd.io (free account) — add to `.env`
- [ ] Confirm Phase 1 is complete: `make test` shows 182 passing tests

### Backend (in order)
- [ ] Add `import subprocess` and `import shutil` to `backend/main.py` imports (~line 7)
- [ ] Add `SongIdentification` model to `backend/models.py` (BEFORE `AudioDescription`)
- [ ] Add `song_id: Optional[SongIdentification]` field to `AudioDescription` in `backend/models.py`
- [ ] Write `backend/tests/test_audio_intelligence.py` (22 tests) — **tests first**
- [ ] Add 8 model tests to `backend/tests/test_models.py`
- [ ] Run `make test-unit` — confirm model tests pass (fast path)
- [ ] Implement `extract_audio_snippet()` in `backend/main.py`
- [ ] Implement `identify_song_via_audd()` in `backend/main.py`
- [ ] Implement `get_song_trend_momentum()` in `backend/main.py`
- [ ] Implement `run_audio_intelligence()` in `backend/main.py`
- [ ] Insert Audio Intelligence step into SSE endpoint (new STEP 2)
- [ ] Insert Audio Intelligence step into sync endpoint
- [ ] Update `total_steps` count in both endpoints for video inputs
- [ ] Add 2 tests to `test_api_stream.py`
- [ ] Run `make test` — target: **214 tests, 0 failures**

### Frontend (in order)
- [ ] Add `audioIntelligence: null` to `INITIAL_STORE` in `useAnalysis.js`
- [ ] Add `audio_intelligence_data` SSE event handler in `useAnalysis.js`
- [ ] Create `frontend-react/src/components/results/AudioSection.jsx`
- [ ] Import and render `<AudioSection>` in `Results.jsx`
- [ ] Add 2 tests to `useAnalysis.test.js`
- [ ] Run `npm test` — all passing

### Integration (manual)
- [ ] Upload a video containing a known song (e.g., an ad using a licensed track)
- [ ] Confirm `audio_intelligence_data` event appears in SSE stream
- [ ] Confirm `song_id.title` and `song_id.artist` are correct
- [ ] Confirm `song_id.trend_momentum` is a float in [0, 1]
- [ ] Upload a video with no music (voice only) — confirm `song_id=null` in response, no errors
- [ ] Upload an image — confirm Audio Intelligence step is skipped entirely

---

## 8. Success Criteria

| Criterion | How to verify |
|-----------|---------------|
| 182 existing Phase 1 tests green | `make test` before Phase 2 code — no regressions |
| 32 new Phase 2 tests pass | `make test` output shows 214 total |
| `ffmpeg` unavailable → graceful skip | Set `PATH` to exclude ffmpeg in test, confirm `None` returned |
| `AUDD_API_KEY` absent → graceful skip | No env var in test env — `song_id=null`, no exception |
| Video with music → song identified | Integration test with known music video |
| Song trend momentum populated | `song_id.trend_momentum` is float, not `None`, for popular tracks |
| `AudioDescription.song_id` present in response | Check `quant.media_decomposition.audio.song_id` in API response JSON |
| `audio_intelligence_data` SSE event emitted | Verify in SSE stream with real video |
| Image input → no audio step in pipeline trace | Upload JPEG → pipeline trace has no "Audio Intelligence" step |
| Frontend `<AudioSection>` renders song card | Browser inspection, no console errors |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| `ffmpeg` not installed on deployment server | Medium | High | Add `ffmpeg` installation check to startup logs; document in `DEPLOY.md`; add `Dockerfile` instruction |
| AudD API key not set in production env | Low | Medium | Graceful skip + warning note in `PipelineStep`; document required env vars |
| AudD free tier (300/month) exceeded | Medium | Low | Rate limit only affects prod; dev is fine. Note in docs to upgrade for prod. |
| Video has no identifiable music (voice/SFX only) | High | None | Expected path — `song_id=null`, pipeline continues normally |
| pytrends rate limits on song query | Low | Low | Song trend query is just 1 more pytrends call per pipeline run; same retry logic as existing trend step |
| ffmpeg output for short clips (<15s video) | Low | Low | ffmpeg handles short inputs gracefully — outputs what's available |
| Large video → slow ffmpeg extraction | Low | Low | Only -t 15s extracted; should be fast even for 100MB source files |
| AudD API format changes | Low | Medium | httpx client, all parsing behind `try/except`; returns `None` on any unexpected format |

---

## 10. Key File Locations (quick reference)

| What | File | Lines (post-Phase 1) |
|------|------|---------------------|
| `SongIdentification` — NEW | `backend/models.py` | insert before `AudioDescription` |
| `AudioDescription.song_id` — ADD | `backend/models.py` | within `AudioDescription` class |
| `extract_audio_snippet()` — NEW | `backend/main.py` | ~line 430+ (after `media_decomp_to_vision_analysis`) |
| `identify_song_via_audd()` — NEW | `backend/main.py` | ~line 460+ |
| `get_song_trend_momentum()` — NEW | `backend/main.py` | ~line 500+ |
| `run_audio_intelligence()` — NEW | `backend/main.py` | ~line 525+ |
| SSE STEP 2 insertion point | `backend/main.py` | after Step 1 vision block (~line 1600+) |
| `total_steps` computation | `backend/main.py` | before `event_stream()` yield loop |
| `INITIAL_STORE` update | `frontend-react/src/hooks/useAnalysis.js` | ~line 3-20 |
| SSE event loop update | `frontend-react/src/hooks/useAnalysis.js` | ~line 130+ |
| New `AudioSection.jsx` component | `frontend-react/src/components/results/AudioSection.jsx` | (new file) |
| `Results.jsx` render update | `frontend-react/src/components/Results.jsx` | varies |
| `AUDD_API_KEY` env var | `.env` | (new entry) |
| `subprocess`, `shutil` imports | `backend/main.py` | line ~7–10 |

---

## 11. Data Flow Diagram

```
video file (tmp_path)
       │
       ▼
extract_audio_snippet()          ← ffmpeg subprocess, 2s–17s clip, MP3 output
       │
       ▼ Optional[bytes]
identify_song_via_audd()         ← POST api.audd.io with httpx (async)
       │
       ▼ Optional[SongIdentification]
get_song_trend_momentum()        ← run_trend_analysis(["{title} {artist}"], "US")
       │
       ▼ Optional[float] (trend_momentum)
run_audio_intelligence()
       │
       ▼ Optional[SongIdentification] (with trend_momentum set)
SSE handler
       ├─→ media_decomp.audio.song_id = song_id    (attach to Phase 1 model)
       └─→ emit "audio_intelligence_data" SSE event (frontend receives it)
```

At the end of the pipeline:
```
QuantitativeMetrics
  └── media_decomposition: MediaDecomposition
        └── audio: AudioDescription
              ├── has_audio: True
              ├── description: "Upbeat electronic track with..."
              └── song_id: SongIdentification
                    ├── title: "Blinding Lights"
                    ├── artist: "The Weeknd"
                    ├── trend_momentum: 0.61
                    └── ...
```
