// Text helpers shared by the schema, validator and app. No Zod import, so the app bundle stays small.

const MARKER = /\{\{(b\d+)\}\}/g;

/** Blank ids in the order their `{{bN}}` markers appear in the text. */
export function blankMarkers(text: string): string[] {
  return [...text.matchAll(MARKER)].map((m) => m[1]!);
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Highlight Incorrect Words indexes refer to these tokens, so the app and validator must share it. */
export function transcriptTokens(transcript: string): string[] {
  return transcript.trim().split(/\s+/);
}
