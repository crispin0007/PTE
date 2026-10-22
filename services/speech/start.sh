#!/bin/sh
# On a GPU build, faster-whisper finds the CUDA libraries that came with torch.
NV=$(python -c "import nvidia, os; print(os.path.dirname(nvidia.__path__[0]))" 2>/dev/null)
if [ -n "$NV" ]; then
  for d in "$NV"/nvidia/*/lib; do [ -d "$d" ] && LD_LIBRARY_PATH="$d:$LD_LIBRARY_PATH"; done
  export LD_LIBRARY_PATH
fi
exec uvicorn app:app --host 0.0.0.0 --port 8000
