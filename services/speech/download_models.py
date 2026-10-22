"""Downloads the models into HF_HOME, so they are in the image (docker build --build-arg
PRELOAD_MODELS=1) or in the models volume before the first learner arrives."""

import os

from faster_whisper import download_model
from huggingface_hub import snapshot_download

if __name__ == "__main__":
    whisper = os.environ.get("WHISPER_MODEL", "small.en")
    print(f"whisper {whisper}: {download_model(whisper)}")
    if os.environ.get("PRONUNCIATION", "on") == "on":
        phonemes = os.environ.get("PHONEME_MODEL", "facebook/wav2vec2-xlsr-53-espeak-cv-ft")
        print(f"phonemes {phonemes}: {snapshot_download(phonemes)}")
