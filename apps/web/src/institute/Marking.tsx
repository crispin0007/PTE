import { useId, useState } from 'react';
import { Link, useParams } from 'react-router';
import { typeLabel, questionLabel } from '../content/labels.ts';
import { displayName, instituteApi, useLoad, type MarkingRequest } from './api.ts';

/** The institute's marking queue: answers students sent, oldest first, and recent marks. */
export function MarkingQueue() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<'waiting' | 'marked'>('waiting');
  const list = useLoad(() => instituteApi.queue(id, tab), `${id}/${tab}`);
  return (
    <div className="flex flex-col gap-5">
      <p>
        <Link to={`/institutes/${id}`} className="text-sm text-muted underline">
          Back to the institute
        </Link>
      </p>
      <h1 className="text-3xl font-bold">Marking</h1>
      <div className="flex gap-2" role="group" aria-label="Show">
        {(['waiting', 'marked'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              tab === t ? 'border-brand bg-brand-soft' : 'border-line bg-surface'
            }`}
          >
            {t === 'waiting' ? 'To mark' : 'Marked'}
          </button>
        ))}
      </div>
      {list.error && <p role="alert">{list.error}</p>}
      {list.data?.requests.length === 0 && (
        <p className="text-muted">
          {tab === 'waiting'
            ? 'Nothing to mark. Students send Writing and Speaking answers from their result screen.'
            : 'Nothing marked yet.'}
        </p>
      )}
      <ul className="flex flex-col gap-4">
        {list.data?.requests.map((r) => (
          <li key={r.id}>
            <Item instituteId={id} r={r} onMarked={list.reload} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Item({
  instituteId,
  r,
  onMarked,
}: {
  instituteId: string;
  r: MarkingRequest;
  onMarked: () => void;
}) {
  const scoreId = useId();
  const commentId = useId();
  const [score, setScore] = useState(r.teacherScore ?? r.autoScore);
  const [comment, setComment] = useState(r.comment ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <article
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
      data-testid="marking-item"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {r.student ? displayName(r.student) : 'Student'} · {typeLabel(r.type)}
        </h2>
        <p className="text-sm text-muted">
          <Link to={`/practice/${r.type}/${r.questionId}`} className="underline">
            {questionLabel(r.questionId)}
          </Link>{' '}
          · sent {new Date(r.createdAt).toLocaleDateString()}
        </p>
      </div>
      {r.answerText && (
        <p className="whitespace-pre-line rounded-token bg-sunken p-3 leading-relaxed">
          {r.answerText}
        </p>
      )}
      {r.hasRecording && (
        <audio
          controls
          preload="none"
          src={instituteApi.audioUrl(instituteId, r.id)}
          className="w-full"
          aria-label="Student’s recording"
        />
      )}
      <p className="text-sm text-muted">
        App score: {r.autoScore} of {r.max}
        {r.markedAt && ` · marked ${new Date(r.markedAt).toLocaleDateString()}`}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={scoreId} className="flex flex-col gap-1 text-sm">
          Your mark (out of {r.max})
          <input
            id={scoreId}
            type="number"
            min={0}
            max={r.max}
            value={score}
            onChange={(e) => setScore(Math.min(r.max, Math.max(0, Number(e.target.value) || 0)))}
            className="min-h-11 w-24 rounded-token border border-line bg-bg px-3"
          />
        </label>
        <label htmlFor={commentId} className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Comment for the student
          <textarea
            id={commentId}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="rounded-token border border-line bg-bg px-3 py-2"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            instituteApi.mark(instituteId, r.id, score, comment).then(
              () => {
                setBusy(false);
                onMarked();
              },
              (e: Error) => {
                setBusy(false);
                setError(e.message);
              },
            );
          }}
          className="min-h-11 rounded-token bg-brand px-5 font-semibold text-brand-ink disabled:opacity-60"
        >
          {r.markedAt ? 'Update mark' : 'Save mark'}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}
    </article>
  );
}
