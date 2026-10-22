# CPU by default. For an NVIDIA GPU, build with
#   --build-arg TORCH_INDEX=https://download.pytorch.org/whl/cu128
# and run with WHISPER_DEVICE=cuda PHONEME_DEVICE=cuda (see docker-compose.gpu.yml).
FROM python:3.12-slim
ARG TORCH_INDEX=https://download.pytorch.org/whl/cpu
ARG PRELOAD_MODELS=0
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng \
  && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.9.1 --index-url "$TORCH_INDEX"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY engine.py pronounce.py app.py download_models.py start.sh ./
ENV WHISPER_MODEL=small.en HF_HOME=/models WARM_UP=1
# The models (about 250 MB for Whisper small.en, 1.2 GB for the phoneme model) download into
# /models on first start, or into the image here with PRELOAD_MODELS=1.
RUN mkdir -p /models && if [ "$PRELOAD_MODELS" = "1" ]; then python download_models.py; fi \
  && chown -R nobody /models
VOLUME /models
EXPOSE 8000
USER nobody
CMD ["./start.sh"]
