# openpte speech service

Turns a speaking recording into a timed transcript (each word with start and end time and a
recognition confidence) using [faster-whisper](https://github.com/SYSTRAN/faster-whisper) on CPU.
The API calls it and turns the transcript into content, fluency and pronunciation scores with
`packages/scoring/src/speaking.ts`. Browsers never call it directly.

```sh
pip install -r requirements-dev.txt
pytest                                   # tests use a fake engine, no model needed
uvicorn app:app --port 8000              # downloads WHISPER_MODEL (default small.en) on first use
SPEECH_ENGINE=fake uvicorn app:app       # run without a model, for local development
```

| Variable          | Default    | Meaning                                               |
| ----------------- | ---------- | ----------------------------------------------------- |
| `WHISPER_MODEL`   | `small.en` | Any faster-whisper model name (`base.en` is quicker)  |
| `WHISPER_THREADS` | `2`        | CPU threads                                           |
| `SPEECH_TOKEN`    | empty      | If set, callers must send `Authorization: Bearer ...` |
| `SPEECH_ENGINE`   | `whisper`  | `fake` returns a fixed transcript                     |

Licence: AGPL-3.0, like the rest of openpte. faster-whisper is MIT; Whisper weights are MIT.
