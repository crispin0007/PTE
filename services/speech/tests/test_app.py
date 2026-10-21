from fastapi.testclient import TestClient

from app import create_app
from engine import FakeEngine


def client(token: str = "") -> TestClient:
    return TestClient(create_app(engine=FakeEngine("hello there world"), token=token))


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
