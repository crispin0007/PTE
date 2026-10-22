import type { Question } from '@openpte/schema';
import { scoreSpeaking, type SpeakingResult, type TimedTranscript } from '@openpte/scoring';

/** Talks to services/speech. */
export type SpeechClient = {
  /** `reference` is the text the learner should say; pronunciation is scored against it. */
  transcribe: (
    audio: Buffer,
    mime: string,
    reference?: string,
  ) => Promise<TimedTranscript & { engine: string }>;
};

export function httpSpeech(url: string, token?: string): SpeechClient {
  return {
    async transcribe(audio, mime, reference) {
      const form = new FormData();
      form.append('audio', new Blob([new Uint8Array(audio)], { type: mime }), 'answer');
      if (reference) form.append('reference', reference);
      const res = await fetch(`${url.replace(/\/$/, '')}/transcribe`, {
        method: 'POST',
        body: form,
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
        // Pronunciation adds a few seconds on CPU for a 40-second answer.
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`speech service returned ${res.status}`);
      return (await res.json()) as TimedTranscript & { engine: string };
    },
  };
}

/** The words a Speaking answer should contain, when they are fixed. Open answers have none, and
 * their pronunciation is scored against what was recognised. */
export function referenceText(q: Question): string | undefined {
  if (q.type === 'speaking_read_aloud') return q.text;
  if (q.type === 'speaking_repeat_sentence') return q.transcript;
  return undefined;
}

/** What a Speaking question is scored against. */
export function scoreAnswer(q: Question, t: TimedTranscript): SpeakingResult | null {
  switch (q.type) {
    case 'speaking_read_aloud':
      return scoreSpeaking({ rule: 'speaking_read_aloud', text: q.text }, t);
    case 'speaking_repeat_sentence':
      return scoreSpeaking({ rule: 'speaking_repeat_sentence', text: q.transcript }, t);
    case 'speaking_answer_short_question':
      return scoreSpeaking({ rule: 'speaking_short_answer', accepted: q.accepted_answers }, t);
    case 'speaking_describe_image':
    case 'speaking_retell_lecture':
    case 'speaking_summarize_group_discussion':
    case 'speaking_respond_to_situation':
      return scoreSpeaking({ rule: 'speaking_open_response', keyPoints: q.key_points }, t);
    default:
      return null;
  }
}
