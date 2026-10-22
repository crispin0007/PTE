"""Writes content/phones.json: the expected sounds (espeak-ng IPA) of every word of every Read
Aloud and Repeat Sentence question, for the in-browser pronunciation check, which has no espeak.
Run it after adding or changing those questions:

    python services/speech/make_phones.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

from pronounce import espeak_phones, reference_words

FIELD = {"speaking_read_aloud": "text", "speaking_repeat_sentence": "transcript"}


def build(root: Path) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for type_, field in FIELD.items():
        for path in sorted((root / "content/questions/speaking" / type_).glob("*.yaml")):
            q = yaml.safe_load(path.read_text())
            words = reference_words(q[field])
            out[q["id"]] = [" ".join(p) for p in espeak_phones(words)]
    return out


if __name__ == "__main__":
    root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2])
    phones = build(root)
    (root / "content/phones.json").write_text(json.dumps(phones, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(phones)} questions")
