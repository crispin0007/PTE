/// <reference lib="webworker" />
/**
 * Runs the phoneme model on the learner's device, off the main thread. The model is fetched once
 * from the app's own server and kept in the browser's Cache Storage.
 */
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from '@ort-dist/ort-wasm-simd-threaded.wasm?url';

export type SoundsRequest = { modelUrl: string; audio: Float32Array; normalize: boolean };
export type SoundsReply =
  | { type: 'progress'; loaded: number; total: number }
  | { type: 'logits'; logits: Float32Array; frames: number; size: number }
  | { type: 'error'; message: string };

const CACHE = 'openpte-phonemes-v1';
let session: Promise<ort.InferenceSession> | null = null;
const post = (m: SoundsReply, transfer: Transferable[] = []) => self.postMessage(m, transfer);

async function download(url: string): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url).catch(() => undefined);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`model download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    post({ type: 'progress', loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  // Keeping it is a convenience: a full or blocked cache only means downloading again next time.
  await cache?.put(url, new Response(bytes)).catch(() => undefined);
  return bytes.buffer;
}

function load(modelUrl: string) {
  ort.env.wasm.wasmPaths = { wasm: wasmUrl };
  // One thread: more need cross-origin isolation, which the app does not ask for.
  ort.env.wasm.numThreads = 1;
  return download(`${modelUrl}model.onnx`).then((model) =>
    ort.InferenceSession.create(new Uint8Array(model), { executionProviders: ['wasm'] }),
  );
}

/** Zero mean and unit variance, as the model's feature extractor does. */
function normalise(a: Float32Array) {
  let mean = 0;
  for (const x of a) mean += x;
  mean /= a.length || 1;
  let v = 0;
  for (const x of a) v += (x - mean) ** 2;
  const sd = Math.sqrt(v / (a.length || 1) + 1e-7);
  return a.map((x) => (x - mean) / sd);
}

self.onmessage = async (e: MessageEvent<SoundsRequest>) => {
  try {
    const { modelUrl, audio, normalize } = e.data;
    session ??= load(modelUrl).catch((err: unknown) => {
      session = null;
      throw err;
    });
    const s = await session;
    const input = new ort.Tensor('float32', normalize ? normalise(audio) : audio, [
      1,
      audio.length,
    ]);
    const out = await s.run({ input_values: input });
    const logits = out.logits!;
    const [, frames, size] = logits.dims as [number, number, number];
    const data = logits.data as Float32Array;
    post({ type: 'logits', logits: data, frames, size }, [data.buffer]);
  } catch (err) {
    post({ type: 'error', message: (err as Error).message || String(err) });
  }
};
