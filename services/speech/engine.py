"""Speech recognition engines. The service uses faster-whisper; tests use a fake."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class Word:
    word: str
    start: float
    end: float
    probability: float


@dataclass
class Transcript:
    text: str
    duration: float
    words: list[Word] = field(default_factory=list)


class Engine(Protocol):
    name: str

    def transcribe(self, path: str) -> Transcript: ...


class WhisperEngine:
    """faster-whisper on CPU with int8 weights: runs on a free-tier ARM or x86 machine.

    The model is downloaded on first use (WHISPER_MODEL, default small.en, about 250 MB).
    No prompt is given, so recognition is not nudged towards the expected answer.
    """

    def __init__(self, model: str | None = None) -> None:
        from faster_whisper import WhisperModel  # imported here so tests need no model

        self.name = f"faster-whisper:{model or os.environ.get('WHISPER_MODEL', 'small.en')}"
        self._model = WhisperModel(
            model or os.environ.get("WHISPER_MODEL", "small.en"),
            device="cpu",
            compute_type=os.environ.get("WHISPER_COMPUTE", "int8"),
            cpu_threads=int(os.environ.get("WHISPER_THREADS", "2")),
        )

    def transcribe(self, path: str) -> Transcript:
        segments, info = self._model.transcribe(
            path,
            language="en",
            word_timestamps=True,
            vad_filter=False,  # pauses are part of what we measure
            condition_on_previous_text=False,
            beam_size=5,
        )
        words: list[Word] = []
        for seg in segments:
            for w in seg.words or []:
                words.append(
                    Word(
                        word=w.word.strip(),
                        start=round(w.start, 2),
                        end=round(w.end, 2),
                        probability=round(w.probability, 3),
                    )
                )
        return Transcript(
            text=" ".join(w.word for w in words),
            duration=round(info.duration, 2),
            words=words,
        )


class FakeEngine:
    """Returns a fixed transcript. For tests and for running the stack without a model."""

    name = "fake"

    def __init__(self, text: str = "this is a test", wpm: float = 140) -> None:
        self.text = text
        self.wpm = wpm

    def transcribe(self, path: str) -> Transcript:
        per = 60 / self.wpm
        words = [
            Word(word=w, start=round(0.5 + i * per, 2), end=round(0.5 + i * per + per * 0.8, 2), probability=0.9)
            for i, w in enumerate(self.text.split())
        ]
        return Transcript(text=self.text, duration=round(1 + len(words) * per, 2), words=words)
