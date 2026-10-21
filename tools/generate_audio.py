"""Generate listening/speaking audio from scripts with Piper TTS (open source, runs offline).

Setup (once):
    pip install piper-tts
    # download voices (.onnx + .onnx.json) from https://huggingface.co/rhasspy/piper-voices
    # into a folder, e.g. voices/: en_US-lessac-medium, en_GB-alan-medium, en_US-amy-medium
Usage:
    python3 tools/generate_audio.py --voices voices/ [--only <id>] [--force]

Reads content-assets/audio/audio-jobs.json, writes <id>.mp3 plus a <id>.meta.yaml sidecar
(voice: tts) next to it. Needs ffmpeg on PATH. Group discussions use one voice per speaker;
Select Missing Word items get a beep appended where the missing words would be.
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "content-assets" / "audio"
VOICES = ["en_US-lessac-medium", "en_GB-alan-medium", "en_US-amy-medium"]


def tts(text, voice, out_wav, voice_dir):
    model = Path(voice_dir) / f"{voice}.onnx"
    subprocess.run(["piper", "--model", str(model), "--output_file", str(out_wav)],
                   input=text.encode("utf-8"), check=True, capture_output=True)


def concat(wavs, out, tmp):
    listing = Path(tmp) / "list.txt"
    listing.write_text("".join(f"file '{w}'\n" for w in wavs))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
                    "-ar", "22050", "-ac", "1", "-b:a", "64k", str(out)], check=True)


def silence(path, seconds):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r=22050:cl=mono",
                    "-t", str(seconds), str(path)], check=True)


def beep(path):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=1000:duration=0.6",
                    "-ar", "22050", "-ac", "1", str(path)], check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", required=True, help="folder with Piper .onnx voice files")
    ap.add_argument("--only")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    jobs = json.loads((AUDIO / "audio-jobs.json").read_text(encoding="utf-8"))
    for n, job in enumerate(jobs):
        if args.only and job["id"] != args.only:
            continue
        out = ROOT / "content-assets" / job["audio"]
        if out.exists() and not args.force:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            parts = []
            if job["speakers"]:
                gap = Path(tmp) / "gap.wav"
                silence(gap, 0.5)
                for i, line in enumerate(job["script"].splitlines()):
                    name, _, text = line.partition(":")
                    voice = VOICES[job["speakers"].index(name.strip()) % len(VOICES)]
                    wav = Path(tmp) / f"{i}.wav"
                    tts(text.strip(), voice, wav, args.voices)
                    parts += [wav, gap]
                voice_label = ", ".join(VOICES[:len(job["speakers"])])
            else:
                voice = VOICES[n % len(VOICES)]
                wav = Path(tmp) / "main.wav"
                tts(job["script"], voice, wav, args.voices)
                parts.append(wav)
                voice_label = voice
            if job["beep_at_end"]:
                b = Path(tmp) / "beep.wav"
                beep(b)
                parts.append(b)
            concat(parts, out, tmp)
        out.with_suffix(".meta.yaml").write_text(
            "source: original\nlicense: CC-BY-SA-4.0\nauthor: openpte-seed\nvoice: tts\n"
            f"tts_engine: piper\ntts_voice: {voice_label}\n", encoding="utf-8")
        print("wrote", out.relative_to(ROOT))


if __name__ == "__main__":
    main()
