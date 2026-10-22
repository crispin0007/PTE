# openpte speech service

Turns a speaking recording into a timed transcript (each word with start and end time and a
recognition confidence) using [faster-whisper](https://github.com/SYSTRAN/faster-whisper), and
scores the pronunciation of every sound of every word. The API calls it and turns the result into
content, fluency and pronunciation scores with `packages/scoring/src/speaking.ts`. Browsers never
call it directly.

## How pronunciation is scored

1. espeak-ng gives the sounds (IPA phones) each word of the reference text should have. With no
   reference (open answers), the words Whisper heard are used.
2. A wav2vec2 phoneme recogniser
   ([facebook/wav2vec2-xlsr-53-espeak-cv-ft](https://huggingface.co/facebook/wav2vec2-xlsr-53-espeak-cv-ft),
   Apache-2.0) gives the probability of each phone in every 20 ms of audio.
3. The expected phones are force-aligned to the audio (CTC Viterbi), and each phone gets a goodness
   of pronunciation score from 0 to 100: how strong the expected phone was near where it belongs,
   compared with the strongest sound heard there. A word's score is the mean of its phones.

The code is in `pronounce.py`. A trained scorer such as GOPT (trained on speechocean762) could
replace the last step later for scores closer to human raters.

```sh
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-dev.txt      # also needs ffmpeg and espeak-ng installed
pytest                                   # fakes and a tiny random model, no download needed
uvicorn app:app --port 8000              # downloads the models on first use
SPEECH_ENGINE=fake uvicorn app:app       # run without models, for local development
```

`POST /transcribe` takes the multipart fields `audio` and, optionally, `reference` (the text the
learner should say). It returns `words`, `duration` and `pronunciation` (`null` when it is off or
the audio is too short to align).

| Variable           | Default                                  | Meaning                                                             |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------- |
| `WHISPER_MODEL`    | `small.en`                               | Any faster-whisper model (`base.en` quicker, `large-v3-turbo` best) |
| `WHISPER_DEVICE`   | `cpu`                                    | `cuda` for a GPU                                                    |
| `WHISPER_THREADS`  | `2`                                      | CPU threads                                                         |
| `PRONUNCIATION`    | `on`                                     | `off`, or `fake` for a stand-in                                     |
| `PHONEME_MODEL`    | `facebook/wav2vec2-xlsr-53-espeak-cv-ft` | Any wav2vec2 CTC model with espeak IPA phones, or a path            |
| `PHONEME_DEVICE`   | `cpu`                                    | `cuda` or `auto`                                                    |
| `PHONEME_QUANTIZE` | `1`                                      | int8 linear layers on CPU (less memory, faster)                     |
| `PHONEME_ACCENT`   | `en-us`                                  | espeak-ng voice for the expected sounds, such as `en-gb`            |
| `WARM_UP`          | `1` in Docker                            | Load (and download) the models at start, not on first use           |
| `SPEECH_TOKEN`     | empty                                    | If set, callers must send `Authorization: Bearer ...`               |
| `SPEECH_ENGINE`    | `whisper`                                | `fake` returns a fixed transcript                                   |

Docker: `docker build services/speech` is CPU-only. For an NVIDIA GPU, build with
`--build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu128` (or use `docker-compose.gpu.yml`
at the repository root). `--build-arg PRELOAD_MODELS=1` puts the models in the image.

Licences: this service is AGPL-3.0, like the rest of openpte. faster-whisper and the Whisper weights
are MIT; the phoneme model is Apache-2.0; espeak-ng is GPL-3.0 and runs as a separate program
(through phonemizer, GPL-3.0).
