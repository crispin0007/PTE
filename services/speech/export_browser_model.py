"""Exports the phoneme model for the browser fallback: ONNX with int8 weights (about a quarter of
the size), with its vocabulary and audio settings, into BROWSER_MODEL_DIR (default
/browser-model). The web app serves that folder at ./phonemes/ and runs the model on the learner's
device with onnxruntime-web, so pronunciation can be checked without uploading the recording.

Runs once at start in Docker when BROWSER_MODEL=on; it does nothing if the export already exists.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def export(model: str, out: Path) -> Path:
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic
    from transformers import AutoTokenizer, Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC

    target = out / "model.onnx"
    if target.exists():
        return target
    out.mkdir(parents=True, exist_ok=True)
    net = Wav2Vec2ForCTC.from_pretrained(model).eval()
    tokenizer = AutoTokenizer.from_pretrained(model)
    features = Wav2Vec2FeatureExtractor.from_pretrained(model)
    full = out / "model-fp32.onnx"
    torch.onnx.export(
        net,
        (torch.zeros(1, 16_000),),
        str(full),
        input_names=["input_values"],
        output_names=["logits"],
        dynamic_axes={"input_values": {1: "samples"}, "logits": {1: "frames"}},
        opset_version=17,
        dynamo=False,
    )
    partial = out / "model.partial.onnx"
    # Only the matrix multiplications: onnxruntime has no int8 kernel for the convolutions.
    quantize_dynamic(str(full), str(partial), weight_type=QuantType.QInt8, op_types_to_quantize=["MatMul"])
    full.unlink()
    (out / "phonemes.json").write_text(
        json.dumps(
            {
                "source": model,
                "vocab": tokenizer.get_vocab(),
                "blank": tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0,
                "sampling_rate": features.sampling_rate,
                "normalize": bool(features.do_normalize),
                "bytes": partial.stat().st_size,
            },
            ensure_ascii=False,
        )
    )
    partial.rename(target)  # last, so a half-finished export is never served
    return target


if __name__ == "__main__":
    model = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PHONEME_MODEL", "facebook/wav2vec2-xlsr-53-espeak-cv-ft")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else os.environ.get("BROWSER_MODEL_DIR", "/browser-model"))
    print(f"browser model: {export(model, out)}")
