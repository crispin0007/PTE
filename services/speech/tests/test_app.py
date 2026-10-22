from fastapi.testclient import TestClient

from app import create_app
from engine import FakeEngine
from pronounce import FakePhonemes


def client(token: str = "", phonemes: object = False) -> TestClient:
    return TestClient(create_app(engine=FakeEngine("hello there world"), token=token, phonemes=phonemes))


def test_health() -> None:
    assert client().get("/health").json()["ok"] is True


def test_transcribe_returns_timed_words() -> None:
    res = client().post("/transcribe", files={"audio": ("a.webm", b"fake-bytes", "audio/webm")})
    assert res.status_code == 200
    body = res.json()
    assert body["engine"] == "fake"
    assert [w["word"] for w in body["words"]] == ["hello", "there", "world"]
    assert all(w["end"] > w["start"] for w in body["words"])
    assert body["duration"] > body["words"][-1]["end"]


def test_rejects_empty_and_large_audio() -> None:
    c = client()
    assert c.post("/transcribe", files={"audio": ("a.webm", b"", "audio/webm")}).status_code == 400
    big = b"0" * (5 * 1024 * 1024 + 1)
    assert c.post("/transcribe", files={"audio": ("a.webm", big, "audio/webm")}).status_code == 413


def test_token_is_required_when_set() -> None:
    c = client(token="secret")
    files = {"audio": ("a.webm", b"x", "audio/webm")}
    assert c.post("/transcribe", files=files).status_code == 401
    ok = c.post("/transcribe", files=files, headers={"authorization": "Bearer secret"})
    assert ok.status_code == 200


def test_pronunciation_against_the_reference() -> None:
    c = client(phonemes=FakePhonemes("hello there world", heard={"ð": "z"}))
    files = {"audio": ("a.webm", b"x", "audio/webm")}
    body = c.post("/transcribe", files=files, data={"reference": "Hello, there world."}).json()
    p = body["pronunciation"]
    assert [w["word"] for w in p["words"]] == ["hello", "there", "world"]
    hello, there, world = p["words"]
    assert hello["score"] == 100 and world["score"] == 100
    assert there["phones"][0] == {"phone": "ð", "score": 1} or there["phones"][0]["score"] < 20
    assert there["score"] < 80


def test_pronunciation_falls_back_to_what_was_heard() -> None:
    c = client(phonemes=FakePhonemes("hello there world"))
    body = c.post("/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).json()
    assert body["pronunciation"]["score"] == 100


def test_no_pronunciation_when_off() -> None:
    body = client().post("/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")}).json()
    assert body["pronunciation"] is None
