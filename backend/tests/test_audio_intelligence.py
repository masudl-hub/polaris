"""
Tests for Phase 2 Audio Intelligence pipeline.
Covers: extract_audio_snippet, identify_song_via_audd,
        get_song_trend_momentum, run_audio_intelligence.

22 tests across 6 test classes — all external I/O is mocked.
"""
import os
import sys
import asyncio
import tempfile
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import SongIdentification


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def _run(coro):
    """Run a coroutine synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


FAKE_MP3 = b"\xff\xf3\x00\x00" + b"\x00" * 200  # minimal fake MP3 bytes

AUDD_SUCCESS = {
    "status": "success",
    "result": {
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "album": "After Hours",
        "release_date": "2019-11-29",
        "timecode": "00:00:05",
        "song_link": "https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b",
    },
}

AUDD_NO_MATCH = {"status": "success", "result": None}
AUDD_ERROR = {"status": "error", "error": {"error_code": 900, "http_code": 500}}


# ──────────────────────────────────────────────────────────────────
# 1. extract_audio_snippet
# ──────────────────────────────────────────────────────────────────

class TestExtractAudioSnippet:
    def test_returns_none_when_ffmpeg_missing(self):
        """Returns None gracefully when ffmpeg is not installed."""
        import main
        with patch("main.shutil.which", return_value=None):
            result = main.extract_audio_snippet("/fake/video.mp4")
        assert result is None

    def test_returns_bytes_on_success(self, tmp_path):
        """Returns MP3 bytes when ffmpeg succeeds."""
        import subprocess as _sp
        import main

        fake_output = tmp_path / "out.mp3"
        fake_output.write_bytes(FAKE_MP3)

        mock_run = MagicMock()
        mock_run.returncode = 0

        def fake_subprocess_run(cmd, **kwargs):
            # Write fake mp3 to the tmp file that was created
            dest = cmd[-1]
            import shutil as _sh
            _sh.copy(str(fake_output), dest)
            return mock_run

        with patch("main.shutil.which", return_value="/usr/bin/ffmpeg"), \
             patch("main.subprocess.run", side_effect=fake_subprocess_run):
            result = main.extract_audio_snippet("/fake/video.mp4")

        assert result == FAKE_MP3

    def test_returns_none_on_nonzero_returncode(self):
        """Returns None when ffmpeg exits with a non-zero code."""
        import main
        mock_run = MagicMock()
        mock_run.returncode = 1
        mock_run.stderr = b"some error"

        with patch("main.shutil.which", return_value="/usr/bin/ffmpeg"), \
             patch("main.subprocess.run", return_value=mock_run):
            result = main.extract_audio_snippet("/fake/video.mp4")
        assert result is None

    def test_returns_none_on_timeout(self):
        """Returns None when ffmpeg times out."""
        import subprocess
        import main

        with patch("main.shutil.which", return_value="/usr/bin/ffmpeg"), \
             patch("main.subprocess.run", side_effect=subprocess.TimeoutExpired("ffmpeg", 30)):
            result = main.extract_audio_snippet("/fake/video.mp4")
        assert result is None

    def test_returns_none_on_unexpected_exception(self):
        """Returns None on any unexpected exception during subprocess call."""
        import main
        with patch("main.shutil.which", return_value="/usr/bin/ffmpeg"), \
             patch("main.subprocess.run", side_effect=OSError("permission denied")):
            result = main.extract_audio_snippet("/fake/video.mp4")
        assert result is None


# ──────────────────────────────────────────────────────────────────
# 2. identify_song_via_audd
# ──────────────────────────────────────────────────────────────────

class TestIdentifySongViaAudd:
    def test_returns_none_when_no_api_key(self):
        """Returns (None, None) when AUDD_API_KEY is not set."""
        import main
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("AUDD_API_KEY", None)
            result = _run(main.identify_song_via_audd(FAKE_MP3))
        assert result is None

    def test_happy_path_returns_song_identification(self):
        """Parses AudD success response into SongIdentification (tuple)."""
        import main
        mock_resp = MagicMock()
        mock_resp.json.return_value = AUDD_SUCCESS

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch.dict(os.environ, {"AUDD_API_KEY": "test-key"}), \
             patch("main.httpx.AsyncClient", return_value=mock_client):
            result = _run(main.identify_song_via_audd(FAKE_MP3))

        assert result is not None
        song, score = result
        assert song.title == "Blinding Lights"
        assert song.artist == "The Weeknd"
        assert song.album == "After Hours"
        assert song.song_link is not None
        assert song.trend_momentum is None  # set later by get_song_trend_momentum

    def test_returns_none_when_no_match(self):
        """Returns None when AudD returns success but no result."""
        import main
        mock_resp = MagicMock()
        mock_resp.json.return_value = AUDD_NO_MATCH

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch.dict(os.environ, {"AUDD_API_KEY": "test-key"}), \
             patch("main.httpx.AsyncClient", return_value=mock_client):
            result = _run(main.identify_song_via_audd(FAKE_MP3))

        assert result is None

    def test_returns_none_on_network_error(self):
        """Returns (None, None) when httpx raises a network exception."""
        import httpx
        import main

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))

        with patch.dict(os.environ, {"AUDD_API_KEY": "test-key"}), \
             patch("main.httpx.AsyncClient", return_value=mock_client):
            result = _run(main.identify_song_via_audd(FAKE_MP3))

        assert result == (None, None)

    def test_returns_none_when_title_empty(self):
        """Returns None when AudD result has missing title field."""
        import main
        partial = {
            "status": "success",
            "result": {"title": "", "artist": "The Weeknd"},
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = partial

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch.dict(os.environ, {"AUDD_API_KEY": "test-key"}), \
             patch("main.httpx.AsyncClient", return_value=mock_client):
            result = _run(main.identify_song_via_audd(FAKE_MP3))

        assert result is None

    def test_optional_fields_default_to_none(self):
        """Optional album/release_date/timecode/song_link default to None when absent."""
        import main
        minimal = {
            "status": "success",
            "result": {"title": "Song", "artist": "Artist"},
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = minimal

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch.dict(os.environ, {"AUDD_API_KEY": "test-key"}), \
             patch("main.httpx.AsyncClient", return_value=mock_client):
            result = _run(main.identify_song_via_audd(FAKE_MP3))

        assert result is not None
        song, score = result
        assert song.album is None
        assert song.release_date is None
        assert song.match_timecode is None
        assert song.song_link is None


# ──────────────────────────────────────────────────────────────────
# 3. get_song_trend_momentum
# ──────────────────────────────────────────────────────────────────

class TestGetSongTrendMomentum:
    def test_returns_momentum_float(self):
        """Returns trend momentum float from pytrends."""
        import main
        mock_trend = MagicMock()
        mock_trend.momentum = 0.72

        with patch("main.run_trend_analysis", return_value=mock_trend):
            result = _run(main.get_song_trend_momentum("Blinding Lights", "The Weeknd"))

        assert result == pytest.approx(0.72)

    def test_returns_none_when_trend_analysis_fails(self):
        """Returns None when run_trend_analysis raises an exception."""
        import main
        with patch("main.run_trend_analysis", side_effect=Exception("pytrends rate limit")):
            result = _run(main.get_song_trend_momentum("Some Song", "Some Artist"))

        assert result is None

    def test_returns_none_when_trend_data_is_none(self):
        """Returns None when run_trend_analysis returns None."""
        import main
        with patch("main.run_trend_analysis", return_value=None):
            result = _run(main.get_song_trend_momentum("Song", "Artist"))

        assert result is None


# ──────────────────────────────────────────────────────────────────
# 4. run_audio_intelligence
# ──────────────────────────────────────────────────────────────────

class TestRunAudioIntelligence:
    def test_returns_none_when_no_audio_snippet(self):
        """Returns None when ffmpeg extraction fails."""
        import main
        with patch("main.extract_audio_snippet", return_value=None):
            result = _run(main.run_audio_intelligence("/fake/video.mp4"))

        assert result is None

    def test_returns_none_when_song_not_identified(self):
        """Returns None when AudD returns no match."""
        import main
        with patch("main._get_video_duration", return_value=10.0), \
             patch("main.extract_audio_snippet", return_value=FAKE_MP3), \
             patch("main.identify_song_via_audd", new_callable=AsyncMock, return_value=None):
            result = _run(main.run_audio_intelligence("/fake/video.mp4"))

        assert result is None

    def test_happy_path_returns_song_with_momentum(self):
        """Returns SongIdentification with trend_momentum populated."""
        import main
        base_song = SongIdentification(title="Blinding Lights", artist="The Weeknd")

        with patch("main._get_video_duration", return_value=10.0), \
             patch("main.extract_audio_snippet", return_value=FAKE_MP3), \
             patch("main.identify_song_via_audd", new_callable=AsyncMock, return_value=(base_song, 85)), \
             patch("main.get_song_trend_momentum", new_callable=AsyncMock, return_value=0.85):
            result = _run(main.run_audio_intelligence("/fake/video.mp4"))

        assert result is not None
        assert result.title == "Blinding Lights"
        assert result.trend_momentum == pytest.approx(0.85)

    def test_momentum_stays_none_when_pytrends_fails(self):
        """Returns SongIdentification with trend_momentum=None when pytrends fails."""
        import main
        base_song = SongIdentification(title="Song", artist="Artist")

        with patch("main._get_video_duration", return_value=10.0), \
             patch("main.extract_audio_snippet", return_value=FAKE_MP3), \
             patch("main.identify_song_via_audd", new_callable=AsyncMock, return_value=(base_song, 80)), \
             patch("main.get_song_trend_momentum", new_callable=AsyncMock, return_value=None):
            result = _run(main.run_audio_intelligence("/fake/video.mp4"))

        assert result is not None
        assert result.trend_momentum is None


# ──────────────────────────────────────────────────────────────────
# 5. AudioDescription backward compatibility
# ──────────────────────────────────────────────────────────────────

class TestAudioDescriptionExtension:
    def test_song_id_defaults_to_none(self):
        """AudioDescription.song_id = None by default (backward compat)."""
        from models import AudioDescription
        ad = AudioDescription(has_audio=True, description="Background music")
        assert ad.song_id is None

    def test_song_id_accepts_song_identification(self):
        """AudioDescription.song_id accepts a SongIdentification instance."""
        from models import AudioDescription
        song = SongIdentification(title="Test Song", artist="Test Artist", trend_momentum=0.5)
        ad = AudioDescription(has_audio=True, description="Pop track", song_id=song)
        assert ad.song_id is not None
        assert ad.song_id.title == "Test Song"
        assert ad.song_id.trend_momentum == pytest.approx(0.5)


# ──────────────────────────────────────────────────────────────────
# 6. SongIdentification momentum clamping
# ──────────────────────────────────────────────────────────────────

class TestSongTrendMomentumClamping:
    def test_momentum_within_bounds_accepted(self):
        """trend_momentum values in [0, 1] are accepted by the model."""
        from pydantic import ValidationError
        for value in (0.0, 0.5, 1.0):
            song = SongIdentification(title="T", artist="A", trend_momentum=value)
            assert song.trend_momentum == pytest.approx(value)

    def test_momentum_out_of_bounds_rejected(self):
        """trend_momentum values outside [0, 1] raise a ValidationError."""
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            SongIdentification(title="T", artist="A", trend_momentum=1.5)
        with pytest.raises(ValidationError):
            SongIdentification(title="T", artist="A", trend_momentum=-0.1)
