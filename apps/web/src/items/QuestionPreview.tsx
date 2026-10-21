import type { ReactNode } from 'react';
import { assetUrl } from '../content/catalog.ts';
import type { Question } from '@openpte/schema';
import { transcriptTokens } from '@openpte/schema/text';
import { TextWithBlanks } from './RichText.tsx';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Options({ options, multiple }: { options: string[]; multiple?: boolean }) {
  return (
    <Block title={multiple ? 'Options (choose more than one)' : 'Options (choose one)'}>
      <ol className="flex list-[upper-alpha] flex-col gap-1 pl-6">
        {options.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ol>
    </Block>
  );
}

function Audio({ path, transcript }: { path: string; transcript?: string }) {
  const url = assetUrl(path);
  return (
    <Block title="Audio">
      {url ? (
        <audio controls preload="none" src={url} className="w-full" />
      ) : (
        <p className="text-sm text-muted">Audio has not been generated for this question yet.</p>
      )}
      {transcript && (
        <details className="text-sm">
          <summary className="cursor-pointer">Show transcript</summary>
          <p className="mt-2 whitespace-pre-line">
            {transcript.replace(/\{\{b(\d+)\}\}/g, '[$1]')}
          </p>
        </details>
      )}
    </Block>
  );
}

/**
 * Read-only view of any question type. Phase 0 only proves content renders; interactive
 * answering, timers and scoring are built per type in src/items/ from Phase 1.
 */
export function QuestionPreview({ question: q }: { question: Question }) {
  switch (q.type) {
    case 'speaking_read_aloud':
      return <Block title="Read aloud">{<p className="leading-relaxed">{q.text}</p>}</Block>;
    case 'speaking_repeat_sentence':
    case 'listening_write_from_dictation':
    case 'listening_summarize_spoken_text':
    case 'speaking_answer_short_question':
    case 'speaking_retell_lecture':
    case 'speaking_summarize_group_discussion':
      return (
        <>
          <Audio path={q.audio} transcript={'transcript' in q ? q.transcript : q.sentence} />
          {q.type === 'speaking_summarize_group_discussion' && (
            <p>Speakers: {q.speakers.join(', ')}</p>
          )}
        </>
      );
    case 'speaking_describe_image': {
      const url = assetUrl(q.image);
      return (
        <Block title="Describe the image">
          {url && (
            <img
              src={url}
              alt={q.alt_text}
              className="w-full rounded-token border border-border bg-white"
            />
          )}
        </Block>
      );
    }
    case 'speaking_respond_to_situation':
      return (
        <>
          <Block title="Situation">
            <p className="leading-relaxed">{q.situation_text}</p>
          </Block>
          <Audio path={q.audio} />
        </>
      );
    case 'writing_summarize_written_text':
      return (
        <Block title="Summarise this passage in one sentence">
          <p className="leading-relaxed">{q.passage}</p>
        </Block>
      );
    case 'writing_essay':
      return (
        <Block title="Essay prompt">
          <p className="leading-relaxed">{q.prompt}</p>
        </Block>
      );
    case 'reading_fib_dropdown':
    case 'reading_fib_drag_drop':
      return (
        <>
          <Block title="Passage">
            <TextWithBlanks text={q.passage} />
          </Block>
          {q.type === 'reading_fib_drag_drop' && (
            <Block title="Word bank">
              <p>{[...q.blanks.map((b) => b.answer), ...q.distractors].sort().join(' · ')}</p>
            </Block>
          )}
        </>
      );
    case 'reading_mcq_single':
    case 'reading_mcq_multiple':
      return (
        <>
          <Block title="Passage">
            <p className="leading-relaxed">{q.passage}</p>
          </Block>
          <p className="font-medium">{q.question}</p>
          <Options options={q.options} multiple={q.type === 'reading_mcq_multiple'} />
        </>
      );
    case 'reading_reorder_paragraphs':
      return (
        <Block title="Paragraphs to put in order">
          <ul className="flex flex-col gap-2">
            {[...q.paragraphs].sort().map((p) => (
              <li key={p} className="rounded-token border border-border bg-surface p-3">
                {p}
              </li>
            ))}
          </ul>
        </Block>
      );
    case 'listening_mcq_single':
    case 'listening_mcq_multiple':
      return (
        <>
          <Audio path={q.audio} transcript={q.transcript} />
          <p className="font-medium">{q.question}</p>
          <Options options={q.options} multiple={q.type === 'listening_mcq_multiple'} />
        </>
      );
    case 'listening_highlight_correct_summary':
    case 'listening_select_missing_word':
      return (
        <>
          <Audio path={q.audio} transcript={q.transcript} />
          <Options options={q.options} />
        </>
      );
    case 'listening_fib':
      return (
        <>
          <Audio path={q.audio} />
          <Block title="Transcript with gaps">
            <TextWithBlanks text={q.transcript} />
          </Block>
        </>
      );
    case 'listening_highlight_incorrect_words': {
      const shown = transcriptTokens(q.transcript);
      for (const s of q.swaps) shown[s.index] = s.shown;
      return (
        <>
          <Audio path={q.audio} />
          <Block title="Transcript as displayed">
            <p className="leading-relaxed">{shown.join(' ')}</p>
          </Block>
        </>
      );
    }
  }
}
