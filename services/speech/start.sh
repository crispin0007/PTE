#!/bin/sh
# On a GPU build, faster-whisper finds the CUDA libraries that came with torch.
NV=$(python -c "import nvidia, os; print(os.path.dirname(nvidia.__path__[0]))" 2>/dev/null)
if [ -n "$NV" ]; then
  for d in "$NV"/nvidia/*/lib; do [ -d "$d" ] && LD_LIBRARY_PATH="$d:$LD_LIBRARY_PATH"; done
  export LD_LIBRARY_PATH
fi
# The in-browser model is exported once, in the background, at low priority. If an export was cut
# short (for example the container ran out of memory), it is not retried until the marker is gone.
if [ "${BROWSER_MODEL:-off}" = "on" ] && [ "${PRONUNCIATION:-on}" = "on" ]; then
  DIR=${BROWSER_MODEL_DIR:-/browser-model}
  if [ -f "$DIR/model.onnx" ]; then
    :
  elif [ -f "$DIR/.export-started" ]; then
    echo "browser model: an earlier export did not finish; delete $DIR/.export-started to retry"
  else
    (touch "$DIR/.export-started" && nice -n 19 python export_browser_model.py && rm -f "$DIR/.export-started") &
  fi
fi
exec uvicorn app:app --host 0.0.0.0 --port 8000
