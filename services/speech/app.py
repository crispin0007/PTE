"""openpte speech service: turns a recording into a timed transcript.

POST /transcribe with a multipart field `audio` returns the words with start and end times and a
recognition confidence. The API turns that into scores (packages/scoring/src/speaking.ts).
Only the API calls this service; it is not exposed to browsers.
"""

from __future__ import annotations

import os
import tempfile
from dataclasses import asdict

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile

from engine import Engine, FakeEngine

MAX_BYTES = 5 * 1024 * 1024


def make_engine() -> Engine:
    if os.environ.get("SPEECH_ENGINE", "whisper") == "fake":
        return FakeEngine()
    from engine import WhisperEngine

    return WhisperEngine()


def create_app(engine: Engine | None = None, token: str | None = None) -> FastAPI:
    app = FastAPI(title="openpte speech", version="0.1.0")
    state: dict[str, Engine] = {}
    token = token if token is not None else os.environ.get("SPEECH_TOKEN", "")

    def get_engine() -> Engine:
        # Loading Whisper takes seconds, so do it once, on the first request.
        if "engine" not in state:
            state["engine"] = engine or make_engine()
        return state["engine"]

    def check_token(authorization: str = Header(default="")) -> None:
        if token and authorization != f"Bearer {token}":
            raise HTTPException(status_code=401, detail="bad token")

    @app.get("/health")
    def health() -> dict[str, object]:
        return {"ok": True, "engine_loaded": "engine" in state}

    @app.post("/transcribe", dependencies=[Depends(check_token)])
    async def transcribe(audio: UploadFile = File(...)) -> dict[str, object]:
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
        return {"engine": eng.name, **asdict(result)}

    return app


app = create_app()
