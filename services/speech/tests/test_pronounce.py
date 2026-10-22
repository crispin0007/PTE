import json
import shutil
import subprocess

import numpy as np
import pytest

from pronounce import (
    FakePhonemes,
    assess,
    ctc_align,
    espeak_phones,
    load_audio,
    reference_words,
    to_vocab,
)


def test_reference_words_match_the_scoring_package() -> None:
    assert reference_words("The city’s “rising” costs, quickly!") == ["the", "city's", "rising", "costs", "quickly"]


def test_espeak_gives_phones_per_word() -> None:
    assert espeak_phones(["changing", "the"]) == [["tʃ", "eɪ", "n", "dʒ", "ɪ", "ŋ"], ["ð", "ə"]]


def test_unknown_phones_are_split_or_dropped() -> None:
    assert to_vocab(["aɪɚ", "q", "t"], {"aɪ": 1, "ɚ": 2, "t": 3}) == ["aɪ", "ɚ", "t"]


def test_clear_speech_scores_full_marks() -> None:
    m = FakePhonemes("the climate is changing quickly")
    p = assess(m, np.zeros(1), "The climate is changing quickly.")
    assert p is not None
    assert p.score == 100
    assert all(ph.score == 100 for w in p.words for ph in w.phones)


def test_a_changed_sound_is_found() -> None:
    m = FakePhonemes("the climate", heard={"θ": "θ", "ð": "d"})
    p = assess(m, np.zeros(1), "the climate")
    assert p is not None
    the, climate = p.words
    assert the.phones[0].phone == "ð" and the.phones[0].score < 20
    assert the.phones[1].score == 100
    assert climate.score == 100
    assert p.score < 100


def test_a_left_out_sound_is_found() -> None:
    m = FakePhonemes("climate", heard={"t": ""})
    p = assess(m, np.zeros(1), "climate")
    assert p is not None
    assert p.words[0].phones[-1].phone == "t"
    assert p.words[0].phones[-1].score < 30


def test_alignment_needs_enough_frames() -> None:
    logp = np.log(np.full((2, 3), 1 / 3))
    assert ctc_align(logp, [1, 2, 1], blank=0) is None
    assert ctc_align(np.log(np.full((5, 3), 1 / 3)), [1, 1], blank=0) is not None


def test_nothing_to_score() -> None:
    assert assess(FakePhonemes("a"), np.zeros(1), "  ...  ") is None


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="needs ffmpeg")
def test_audio_is_read_as_16k_mono(tmp_path) -> None:
    wav = tmp_path / "tone.wav"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ar", "44100", "-ac", "2", str(wav)],
        check=True,
    )
    audio = load_audio(str(wav))
    assert audio.dtype == np.float32
    assert 15_500 < len(audio) < 16_500


def test_a_small_wav2vec2_model_runs_end_to_end(tmp_path) -> None:
    """A tiny randomly initialised model: checks the real loading and inference path, not scores."""
    torch = pytest.importorskip("torch")
    transformers = pytest.importorskip("transformers")
    from pronounce import ENGLISH_PHONES, Wav2Vec2Phonemes

    vocab = {"<pad>": 0, "<s>": 1, "</s>": 2, "<unk>": 3, **{p: i + 4 for i, p in enumerate(ENGLISH_PHONES)}}
    (tmp_path / "vocab.json").write_text(json.dumps(vocab))
    tok = transformers.Wav2Vec2PhonemeCTCTokenizer(str(tmp_path / "vocab.json"), do_phonemize=False)
    tok.save_pretrained(tmp_path)
    transformers.Wav2Vec2FeatureExtractor(sampling_rate=16_000).save_pretrained(tmp_path)
    torch.manual_seed(0)
    config = transformers.Wav2Vec2Config(
        vocab_size=len(vocab), hidden_size=32, num_hidden_layers=2, num_attention_heads=2,
        intermediate_size=64, conv_dim=(16, 16, 16, 16, 16, 16, 16), num_conv_pos_embeddings=16,
        num_conv_pos_embedding_groups=2, pad_token_id=0,
    )
    transformers.Wav2Vec2ForCTC(config).save_pretrained(tmp_path)

    model = Wav2Vec2Phonemes(str(tmp_path), device="cpu")
    assert model.blank == 0
    audio = np.random.default_rng(0).normal(0, 0.1, 16_000 * 2).astype(np.float32)
    probs = model.posteriors(audio)
    assert probs.shape == (99, len(vocab))
    p = assess(model, audio, "this is a test")
    assert p is not None
    assert [w.word for w in p.words] == ["this", "is", "a", "test"]
    assert all(0 <= ph.score <= 100 for w in p.words for ph in w.phones)
