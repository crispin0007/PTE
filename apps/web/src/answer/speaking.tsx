import { useState, type ReactNode } from 'react';
import type { QuestionOf, QuestionType } from '@openpte/schema';
import { assetUrl, getType } from '../content/catalog.ts';
import { Listen } from './Listen.tsx';
import { Passage, Section } from './parts.tsx';
import { Recorder, type Recording } from './Recorder.tsx';
import { SaveRecording } from './SaveRecording.tsx';
import type { Answerable, AnswerViewProps } from './types.ts';

type SpeakingType = Extract<QuestionType, `speaking_${string}`>;

function timing(type: SpeakingType) {
  const t = getType(type)?.timing;
  return t?.mode === 'per_item' ? { prep: t.prep_s, answer: t.answer_s } : { prep: 0, answer: 40 };
}

function KeyPoints({ points }: { points: string[] }) {
  const [ticked, setTicked] = useState<boolean[]>(() => points.map(() => false));
  const n = ticked.filter(Boolean).length;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 font-semibold">Did you cover the key points?</legend>
      {points.map((p, i) => (
        <label key={p} className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            checked={ticked[i]}
            onChange={() => setTicked((t) => t.map((v, j) => (j === i ? !v : v)))}
            className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
          />
          <span>{p}</span>
        </label>
      ))}
      <p className="text-sm text-muted" aria-live="polite">
        {n} of {points.length} covered
      </p>
    </fieldset>
  );
}

/** After recording: replay, compare with the reference, and optionally save for scoring. */
function SelfCheck({
  recording,
  questionId,
  type,
  children,
}: {
  recording: Recording;
  questionId: string;
  type: SpeakingType;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby="selfcheck-heading"
      data-testid="self-check"
      className="flex flex-col gap-4 rounded-token border border-line bg-surface p-5"
    >
      <h2 id="selfcheck-heading" className="text-xl font-semibold">
        Listen back and check
      </h2>
      <audio controls src={recording.url} className="w-full" aria-label="Your recording" />
      <p className="text-sm text-muted">{recording.seconds} seconds recorded.</p>
      {children}
      <SaveRecording recording={recording} questionId={questionId} type={type} />
    </section>
  );
}

type R = Recording | null;

function speaking<K extends SpeakingType>(
  stimulus: (q: QuestionOf<K>, recorded: boolean) => ReactNode,
  reference: (q: QuestionOf<K>) => ReactNode,
): Answerable<K, R> {
  function View({ question: q, response, onChange }: AnswerViewProps<QuestionOf<K>, R>) {
    const { prep, answer } = timing(q.type as SpeakingType);
    // Each take gets a fresh recorder; keying by the response would reset it on finishing.
    const [take, setTake] = useState(0);
    return (
      <>
        {stimulus(q, !!response)}
        <Recorder key={take} prepS={prep} answerS={answer} onRecorded={onChange} />
        {response && (
          <>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setTake((t) => t + 1);
              }}
              className="min-h-11 self-start rounded-token border border-line bg-surface px-4 text-sm font-semibold"
            >
              Record again
            </button>
            <SelfCheck recording={response} questionId={q.id} type={q.type as SpeakingType}>
              {reference(q)}
            </SelfCheck>
          </>
        )}
      </>
    );
  }
  return {
    unscored: true,
    initial: () => null,
    score: () => ({ rule: 'speaking_open_response', score: 0, max: 0, working: [] }),
    View,
  };
}

function SampleAnswer({ text }: { text: string }) {
  return (
    <details className="text-sm" open>
      <summary className="cursor-pointer font-semibold">Sample answer</summary>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{text}</p>
    </details>
  );
}

function Transcript({ text, title = 'What the recording says' }: { text: string; title?: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <p className="mt-2 whitespace-pre-line leading-relaxed">{text}</p>
    </details>
  );
}

export const readAloud = speaking<'speaking_read_aloud'>(
  (q) => (
    <Section title="Read this text aloud">
      <Passage text={q.text} />
    </Section>
  ),
  () => (
    <p className="text-sm">
      Check: did you read every word, keep a steady pace, and pause only at punctuation?
    </p>
  ),
);

export const repeatSentence = speaking<'speaking_repeat_sentence'>(
  (q, recorded) => <Listen path={q.audio} script={q.transcript} review={recorded} />,
  (q) => <Transcript text={q.transcript} title="The sentence" />,
);

export const describeImage = speaking<'speaking_describe_image'>(
  (q) => {
    const url = assetUrl(q.image);
    return (
      <Section title="Describe the image">
        {url ? (
          <img
            src={url}
            alt={q.alt_text}
            className="w-full rounded-token border border-line bg-white"
          />
        ) : (
          <p className="text-muted">{q.alt_text}</p>
        )}
      </Section>
    );
  },
  (q) => (
    <>
      <KeyPoints points={q.key_points} />
      <SampleAnswer text={q.sample_answer} />
    </>
  ),
);

export const retellLecture = speaking<'speaking_retell_lecture'>(
  (q, recorded) => {
    const url = q.image ? assetUrl(q.image) : undefined;
    return (
      <>
        {url && (
          <img src={url} alt="" className="w-full rounded-token border border-line bg-white" />
        )}
        <Listen path={q.audio} script={q.transcript} review={recorded} />
      </>
    );
  },
  (q) => (
    <>
      <KeyPoints points={q.key_points} />
      <SampleAnswer text={q.sample_answer} />
    </>
  ),
);

export const shortQuestion = speaking<'speaking_answer_short_question'>(
  (q, recorded) => <Listen path={q.audio} script={q.transcript} review={recorded} />,
  (q) => (
    <p className="text-sm">
      <span className="font-semibold">Accepted answers: </span>
      {q.accepted_answers.join(', ')}
    </p>
  ),
);

export const groupDiscussion = speaking<'speaking_summarize_group_discussion'>(
  (q, recorded) => (
    <>
      <p className="text-sm text-muted">Speakers: {q.speakers.join(', ')}</p>
      <Listen path={q.audio} script={q.transcript} review={recorded} />
    </>
  ),
  (q) => (
    <>
      <KeyPoints points={q.key_points} />
      <SampleAnswer text={q.sample_answer} />
    </>
  ),
);

export const respondToSituation = speaking<'speaking_respond_to_situation'>(
  (q, recorded) => (
    <>
      <Section title="The situation">
        <Passage text={q.situation_text} />
      </Section>
      <Listen path={q.audio} script={q.situation_text} review={recorded} />
    </>
  ),
  (q) => (
    <>
      <KeyPoints points={q.key_points} />
      <SampleAnswer text={q.sample_answer} />
    </>
  ),
);
