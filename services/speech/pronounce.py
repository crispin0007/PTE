"""Pronunciation: how close each sound of each word came to the expected sound.

A phoneme recogniser (wav2vec2 trained with CTC on IPA phones, default
facebook/wav2vec2-xlsr-53-espeak-cv-ft, Apache-2.0) gives, for every 20 ms frame, the probability of
each phone. espeak-ng gives the phones each reference word should have. The expected phones are
force-aligned to the frames (CTC Viterbi), and each phone is scored by goodness of pronunciation
(GOP): near where the phone was aligned, how strong was the expected phone compared with the
strongest phone the model heard. 100 means the expected phone was the clearest sound there; a low
score means another sound, or none, was heard instead.

The maths needs only numpy, so tests run without a model (FakePhonemes).
"""

from __future__ import annotations

import logging
import os
import re
import subprocess
from dataclasses import dataclass, field
from typing import Protocol

import numpy as np

SAMPLE_RATE = 16_000
# Frames either side of an aligned phone that still count as "where the phone should be".
WINDOW = 2
# A phone heard less surely than this counts as partly missing, even if nothing else was heard.
PRESENT = 0.5


@dataclass
class Phone:
    phone: str
    score: int


@dataclass
class WordSound:
    word: str
    score: int
    phones: list[Phone] = field(default_factory=list)


@dataclass
class Pronunciation:
    engine: str
    score: int
    words: list[WordSound] = field(default_factory=list)


class PhonemeModel(Protocol):
    name: str
    vocab: dict[str, int]
    blank: int

    def posteriors(self, audio: np.ndarray) -> np.ndarray:
        """Frame-by-phone probabilities, shape (frames, vocabulary)."""
        ...


def load_audio(path: str) -> np.ndarray:
    """Any format ffmpeg reads, as 16 kHz mono float32."""
    out = subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(out, dtype=np.float32).copy()


def reference_words(text: str) -> list[str]:
    """Same normalisation as words() in packages/scoring, so word i here is word i there."""
    text = text.lower().replace("\u2019", "'").replace("\u2018", "'")
    return [w for w in (re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", "", w) for w in text.split()) if w]


_quiet = logging.getLogger("speech.phonemizer")
_quiet.setLevel(logging.ERROR)


def espeak_phones(words: list[str]) -> list[list[str]]:
    """IPA phones for each word, as espeak-ng says them (en-us)."""
    from phonemizer import phonemize
    from phonemizer.separator import Separator

    said = phonemize(
        words,
        language=os.environ.get("PHONEME_ACCENT", "en-us"),
        backend="espeak",
        separator=Separator(phone=" ", word="", syllable=""),
        strip=True,
        preserve_punctuation=False,
        with_stress=False,
        njobs=1,
        logger=_quiet,
    )
    return [p.split() for p in said]


def to_vocab(phones: list[str], vocab: dict[str, int]) -> list[str]:
    """Phones the model knows. An unknown phone is split into known pieces, or dropped."""
    out: list[str] = []
    for p in phones:
        if p in vocab:
            out.append(p)
            continue
        i = 0
        while i < len(p):
            for j in range(len(p), i, -1):
                if p[i:j] in vocab:
                    out.append(p[i:j])
                    i = j
                    break
            else:
                i += 1
    return out


def ctc_align(logp: np.ndarray, targets: list[int], blank: int) -> list[tuple[int, int]] | None:
    """Viterbi CTC forced alignment. Returns the first and last frame of each target, or None
    when the audio is too short for the targets."""
    frames = logp.shape[0]
    ext = [blank]
    for t in targets:
        ext += [t, blank]
    states = len(ext)
    ext_a = np.array(ext)
    # A state may skip the blank before it when its token differs from the one two back.
    skip = np.zeros(states, dtype=bool)
    for s in range(2, states):
        skip[s] = ext[s] != blank and ext[s] != ext[s - 2]
    neg = -np.inf
    score = np.full(states, neg)
    score[0] = logp[0, ext[0]]
    if states > 1:
        score[1] = logp[0, ext[1]]
    back = np.zeros((frames, states), dtype=np.int8)  # 0 stay, 1 from s-1, 2 from s-2
    for t in range(1, frames):
        stay = score
        step = np.concatenate(([neg], score[:-1]))
        jump = np.where(skip, np.concatenate(([neg, neg], score[:-2])), neg)
        best = np.stack([stay, step, jump])
        choice = best.argmax(axis=0)
        score = best[choice, np.arange(states)] + logp[t, ext_a]
        back[t] = choice
    end = states - 1 if states == 1 or score[-1] >= score[-2] else states - 2
    if not np.isfinite(score[end]):
        return None
    path = np.empty(frames, dtype=np.int64)
    s = end
    for t in range(frames - 1, -1, -1):
        path[t] = s
        s -= int(back[t, s])
    spans: list[tuple[int, int]] = []
    for k in range(len(targets)):
        hit = np.nonzero(path == 2 * k + 1)[0]
        if not len(hit):
            return None
        spans.append((int(hit[0]), int(hit[-1])))
    return spans


def gop_scores(probs: np.ndarray, spans: list[tuple[int, int]], targets: list[int], blank: int) -> list[int]:
    """0-100 for each target: the expected phone's peak near its aligned frames over the peak of
    any phone there (or over PRESENT, when only silence was heard there)."""
    non_blank = probs.copy()
    non_blank[:, blank] = 0
    frames = probs.shape[0]
    out = []
    for (a, b), tok in zip(spans, targets):
        lo, hi = max(0, a - WINDOW), min(frames, b + WINDOW + 1)
        expected = probs[lo:hi, tok].max()
        strongest = max(non_blank[lo:hi].max(), PRESENT)
        out.append(min(100, int(round(100 * expected / strongest))))
    return out


def assess(model: PhonemeModel, audio: np.ndarray, reference: str) -> Pronunciation | None:
    words = reference_words(reference)
    if not words:
        return None
    phones = [to_vocab(p, model.vocab) for p in espeak_phones(words)]
    targets = [model.vocab[p] for ps in phones for p in ps]
    if not targets:
        return None
    probs = model.posteriors(audio)
    spans = ctc_align(np.log(np.clip(probs, 1e-10, 1.0)), targets, model.blank)
    if spans is None:
        return None
    scores = iter(gop_scores(probs, spans, targets, model.blank))
    sounds = []
    for word, ps in zip(words, phones):
        marks = [Phone(phone=p, score=next(scores)) for p in ps]
        mean = round(sum(m.score for m in marks) / len(marks)) if marks else 0
        sounds.append(WordSound(word=word, score=mean, phones=marks))
    scored = [w for w in sounds if w.phones]
    overall = round(sum(w.score for w in scored) / len(scored)) if scored else 0
    return Pronunciation(engine=model.name, score=overall, words=sounds)


def pick_device(setting: str) -> str:
    if setting != "auto":
        return setting
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


class Wav2Vec2Phonemes:
    """A wav2vec2 CTC phoneme model through transformers. CPU by default, with int8 linear layers;
    PHONEME_DEVICE=cuda (or auto) uses a GPU. The model is downloaded on first use into HF_HOME
    (about 1.2 GB for the default)."""

    def __init__(self, model: str | None = None, device: str | None = None) -> None:
        import torch
        from transformers import AutoTokenizer, Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC

        model = model or os.environ.get("PHONEME_MODEL", "facebook/wav2vec2-xlsr-53-espeak-cv-ft")
        self.name = f"wav2vec2:{model.rstrip('/').split('/')[-1]}"
        self._torch = torch
        self._device = pick_device(device or os.environ.get("PHONEME_DEVICE", "cpu"))
        torch.set_num_threads(int(os.environ.get("PHONEME_THREADS", os.environ.get("WHISPER_THREADS", "2"))))
        self._features = Wav2Vec2FeatureExtractor.from_pretrained(model)
        tokenizer = AutoTokenizer.from_pretrained(model)
        self.vocab = dict(tokenizer.get_vocab())
        self.blank = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
        net = Wav2Vec2ForCTC.from_pretrained(model).eval()
        if self._device == "cpu" and os.environ.get("PHONEME_QUANTIZE", "1") == "1":
            # int8 weights for the linear layers: about a third of the memory, and faster on CPU.
            from torch.ao.quantization import quantize_dynamic

            net = quantize_dynamic(net, {torch.nn.Linear}, dtype=torch.qint8)
        self._model = net.to(self._device)

    def posteriors(self, audio: np.ndarray) -> np.ndarray:
        inputs = self._features(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt")
        with self._torch.inference_mode():
            logits = self._model(inputs.input_values.to(self._device)).logits[0]
        return logits.softmax(dim=-1).float().cpu().numpy()


# The phones espeak-ng uses for American English.
ENGLISH_PHONES = (
    "p b t d k ɡ f v θ ð s z ʃ ʒ h tʃ dʒ m n ŋ l ɹ w j ɾ ʔ "
    "i iː ɪ eɪ ɛ æ ɑː ɑ ɔː ɔ oʊ ʊ uː u ʌ ə ɚ ɜː aɪ aʊ ɔɪ ɐ ᵻ oːɹ ɑːɹ ɛɹ ɪɹ ʊɹ aɪɚ"
).split()


class FakePhonemes:
    """Pretends to hear the given phones, one every few frames, clearly. For tests and for running
    the stack without a model. `heard` maps an expected phone to the one actually heard."""

    name = "fake"
    needs_audio = False

    def __init__(self, said: str = "", heard: dict[str, str] | None = None, per: int = 4) -> None:
        phones = sorted(
            set(ENGLISH_PHONES)
            | {p for ps in espeak_phones(reference_words(said)) for p in ps}
            | {p for p in (heard or {}).values() if p}
        )
        self.vocab = {"<pad>": 0, **{p: i + 1 for i, p in enumerate(phones)}}
        self.blank = 0
        self._said = said
        self._heard = heard or {}
        self._per = per

    def posteriors(self, audio: np.ndarray) -> np.ndarray:
        seq = [self._heard.get(p, p) for ps in espeak_phones(reference_words(self._said)) for p in ps]
        frames = max(1, len(seq) * self._per + 2)
        probs = np.full((frames, len(self.vocab)), 0.01)
        probs[:, self.blank] = 0.9
        for i, p in enumerate(seq):
            if p:  # an empty string means the phone was left out
                t = 1 + i * self._per
                probs[t, :] = 0.01
                probs[t, self.vocab[p]] = 0.9
        return probs / probs.sum(axis=1, keepdims=True)
