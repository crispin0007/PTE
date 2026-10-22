"""openpte speech service: turns a recording into a timed transcript.

POST /transcribe with a multipart field `audio` returns the words with start and end times and a
recognition confidence. With PRONUNCIATION on (the default), it also scores the sounds of each word
against `reference` (the text the learner should say), or against what was recognised when there is
no reference. The API turns all that into scores (packages/scoring/src/speaking.ts).
Only the API calls this service; it is not exposed to browsers.
"""

from __future__ import annotations

import logging
import os
import tempfile
import threading
from dataclasses import asdict

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile

from engine import Engine, FakeEngine
from pronounce import FakePhonemes, PhonemeModel, assess, load_audio

log = logging.getLogger("speech")

MAX_BYTES = 5 * 1024 * 1024


def make_engine() -> Engine:
    if os.environ.get("SPEECH_ENGINE", "whisper") == "fake":
        return FakeEngine()
    from engine import WhisperEngine

    return WhisperEngine()


def make_phonemes() -> PhonemeModel | None:
    setting = os.environ.get("PRONUNCIATION", "on")
    if setting == "off":
        return None
    if setting == "fake" or os.environ.get("SPEECH_ENGINE") == "fake":
        return FakePhonemes("this is a test")
    from pronounce import Wav2Vec2Phonemes

    return Wav2Vec2Phonemes()


def create_app(
    engine: Engine | None = None,
    token: str | None = None,
    phonemes: PhonemeModel | None | bool = True,
) -> FastAPI:
    """`phonemes`: a model, False for none, or True to load the one the environment names."""
    app = FastAPI(title="openpte speech", version="0.2.0")
    state: dict[str, object] = {}
    token = token if token is not None else os.environ.get("SPEECH_TOKEN", "")

    def get_engine() -> Engine:
        # Loading Whisper takes seconds, so do it once, on the first request.
        if "engine" not in state:
            state["engine"] = engine or make_engine()
        return state["engine"]  # type: ignore[return-value]

    def get_phonemes() -> PhonemeModel | None:
        if "phonemes" not in state:
            state["phonemes"] = (
                make_phonemes() if phonemes is True else (phonemes or None)
            )
        return state["phonemes"]  # type: ignore[return-value]

    if os.environ.get("WARM_UP") == "1":
        # Load (and on first start, download) the models now, so the first learner does not wait.
        def warm() -> None:
            try:
                get_engine()
                get_phonemes()
                log.info("models ready")
            except Exception:
                log.exception("warm-up failed; models load on the first request instead")

        threading.Thread(target=warm, daemon=True).start()

    def check_token(authorization: str = Header(default="")) -> None:
        if token and authorization != f"Bearer {token}":
            raise HTTPException(status_code=401, detail="bad token")

    @app.get("/health")
    def health() -> dict[str, object]:
        return {
            "ok": True,
            "engine_loaded": "engine" in state,
            "pronunciation_loaded": state.get("phonemes") is not None,
        }

    @app.post("/transcribe", dependencies=[Depends(check_token)])
    async def transcribe(
        audio: UploadFile = File(...), reference: str = Form(default="")
    ) -> dict[str, object]:
        data = await audio.read(MAX_BYTES + 1)
        if not data:
            raise HTTPException(status_code=400, detail="empty audio")
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="audio over 5 MB")
        suffix = {"audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a"}.get(
            (audio.content_type or "").split(";")[0], ".webm"
        )
        eng = get_engine()
        with tempfile.NamedTemporaryFile(suffix=suffix) as f:
            f.write(data)
            f.flush()
            try:
                result = eng.transcribe(f.name)
            except Exception as e:  # undecodable audio and the like
                raise HTTPException(status_code=422, detail=f"could not process audio: {e}") from e
            pronunciation = None
            try:
                model = get_phonemes()
                if model is not None:
                    samples = load_audio(f.name) if getattr(model, "needs_audio", True) else None
                    found = assess(model, samples, reference[:2000] or result.text)  # type: ignore[arg-type]
                    pronunciation = asdict(found) if found else None
            except Exception:  # the transcript is still useful without it
                log.exception("pronunciation failed")
        return {"engine": eng.name, **asdict(result), "pronunciation": pronunciation}

    return app


app = create_app()
