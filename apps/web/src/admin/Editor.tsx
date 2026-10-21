import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { parse, stringify } from 'yaml';
import { QUESTION_SCHEMAS, isQuestionType, type Question } from '@openpte/schema';
import { ANSWERABLE } from '../answer/registry.ts';
import { typeLabel } from '../content/labels.ts';
import { QuestionPreview } from '../items/QuestionPreview.tsx';
import { adminApi, ApiError, type Detail } from './api.ts';
import { STATUS_LABEL } from './AdminHome.tsx';
import { Gate } from './Gate.tsx';

type Check = { question: Question | null; errors: string[] };

/** Parses and validates the YAML with the same schema the content checks and the API use. */
function check(text: string): Check {
  let data: unknown;
  try {
    data = parse(text);
  } catch (e) {
    return { question: null, errors: [`YAML: ${(e as Error).message.split('\n')[0]}`] };
  }
  const type = (data as { type?: unknown } | null)?.type;
  if (!isQuestionType(type)) return { question: null, errors: ['type: unknown question type'] };
  const r = QUESTION_SCHEMAS[type].safeParse(data);
  if (r.success) return { question: r.data as Question, errors: [] };
  return {
    question: null,
    errors: r.error.issues.map(
      (i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`,
    ),
  };
}

function Preview({ question }: { question: Question }) {
  const answerable = ANSWERABLE[question.type];
  const [response, setResponse] = useState<unknown>(() => answerable?.initial(question));
  const [review, setReview] = useState(false);
  if (!answerable) return <QuestionPreview question={question} />;
  const View = answerable.View;
  return (
    <div className="flex flex-col gap-4">
      <View question={question} response={response} onChange={setResponse} review={review} />
      <button
        type="button"
        onClick={() => setReview((r) => !r)}
        className="min-h-11 self-start rounded-token border border-line bg-surface px-4 text-sm font-semibold"
      >
        {review ? 'Back to answering' : 'Show marking'}
      </button>
    </div>
  );
}

function EditorScreen() {
  const { id, type } = useParams();
  const navigate = useNavigate();
  const editorId = useId();
  const commentId = useId();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    const done = (yaml: string, d: Detail | null) => {
      if (!live) return;
      setDetail(d);
      setText(yaml);
    };
    if (id)
      adminApi.get(id).then(
        (d) => done(stringify(d.question, { lineWidth: 100 }), d),
        (e: Error) => live && setMessage({ kind: 'error', text: e.message }),
      );
    else if (type)
      adminApi.template(type).then(
        (t) => done(stringify(t, { lineWidth: 100 }), null),
        (e: Error) => live && setMessage({ kind: 'error', text: e.message }),
      );
    return () => {
      live = false;
    };
  }, [id, type, reload]);

  const result = useMemo(() => (text === null ? null : check(text)), [text]);
  if (text === null || !result)
    return message ? <p role="alert">{message.text}</p> : <p>Loading…</p>;

  const isNew = !id;
  const status = detail?.question.status ?? 'draft';
  const editable = isNew || !!detail?.canEdit;
  const approvals = detail?.reviews.filter((r) => r.verdict === 'approve').length ?? 0;
  const changes = detail?.reviews.some((r) => r.verdict === 'changes') ?? false;

  const run = async (action: () => Promise<unknown>, ok: string) => {
    setMessage(null);
    setServerErrors([]);
    try {
      await action();
      setMessage({ kind: 'ok', text: ok });
      setReload((n) => n + 1);
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message });
      if (e instanceof ApiError) setServerErrors(e.errors);
    }
  };

  const save = () =>
    run(
      async () => {
        if (isNew) {
          const { id: newId } = await adminApi.create(result.question);
          void navigate(`/admin/q/${newId}`, { replace: true });
        } else await adminApi.update(id, result.question);
      },
      isNew ? 'Draft saved.' : status === 'draft' ? 'Saved.' : 'Saved. It needs two fresh reviews.',
    );

  const primary =
    'min-h-11 rounded-token bg-brand px-5 font-semibold text-brand-ink disabled:opacity-50';
  const secondary =
    'min-h-11 rounded-token border border-line bg-surface px-5 font-semibold disabled:opacity-50';

  return (
    <div className="flex flex-col gap-5">
      <p>
        <Link to="/admin" className="text-sm text-muted underline">
          Question bank
        </Link>
      </p>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {isNew ? 'New question' : typeLabel(detail!.question.type)}
        </h1>
        {!isNew && (
          <p className="text-sm text-muted">
            <span className="font-mono">{id}</span> · {STATUS_LABEL[status]}
            {status === 'in_review' && ` · ${approvals} of 2 approvals`}
          </p>
        )}
      </div>

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-token px-3 py-2 text-sm ${message.kind === 'error' ? 'bg-bad-soft' : 'bg-good-soft'}`}
        >
          {message.text}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby={`${editorId}-h`} className="flex flex-col gap-2">
          <h2
            id={`${editorId}-h`}
            className="text-sm font-semibold uppercase tracking-wide text-muted"
          >
            <label htmlFor={editorId}>Question (YAML)</label>
          </h2>
          <textarea
            id={editorId}
            value={text}
            readOnly={!editable}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            rows={24}
            className="rounded-token border border-muted bg-surface p-3 font-mono text-sm leading-relaxed"
          />
          {[...result.errors, ...serverErrors].length > 0 ? (
            <ul role="alert" className="flex flex-col gap-1 rounded-token bg-bad-soft p-3 text-sm">
              {[...result.errors, ...serverErrors].map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-good">✓ Valid {typeLabel(result.question!.type)} question</p>
          )}
          <p className="text-xs text-muted">
            Write original content only: nothing copied from the real test, prediction files or
            other platforms. Author, status and reviewers are set by the workflow.
          </p>
        </section>
        <section aria-labelledby={`${editorId}-p`} className="flex flex-col gap-2">
          <h2
            id={`${editorId}-p`}
            className="text-sm font-semibold uppercase tracking-wide text-muted"
          >
            Live preview
          </h2>
          <div className="flex flex-col gap-4 rounded-token border border-dashed border-line p-4">
            {result.question ? (
              <Preview key={text} question={result.question} />
            ) : (
              <p className="text-muted">Fix the errors to see the preview.</p>
            )}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        {editable && (
          <button
            type="button"
            disabled={!result.question}
            onClick={() => void save()}
            className={primary}
          >
            {isNew ? 'Save draft' : 'Save changes'}
          </button>
        )}
        {!isNew && editable && status === 'draft' && (
          <button
            type="button"
            onClick={() => void run(() => adminApi.submit(id), 'Sent for review.')}
            className={secondary}
          >
            Send for review
          </button>
        )}
        {!isNew && editable && status === 'in_review' && (
          <button
            type="button"
            disabled={approvals < 2 || changes}
            onClick={() =>
              void run(() => adminApi.publish(id), 'Published. Learners can see it now.')
            }
            className={primary}
          >
            Publish
          </button>
        )}
        {!isNew && (
          <a href={adminApi.yamlUrl(id)} className={`${secondary} inline-flex items-center`}>
            Download YAML
          </a>
        )}
      </div>

      {!isNew && detail && (
        <section
          aria-labelledby="reviews-heading"
          className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
        >
          <h2 id="reviews-heading" className="text-xl font-semibold">
            Reviews
          </h2>
          <p className="text-sm text-muted">
            Two reviewers who are not the author must approve before a question is published.
          </p>
          {detail.reviews.length === 0 && <p className="text-sm">No reviews yet.</p>}
          <ul className="flex flex-col gap-2">
            {detail.reviews.map((r) => (
              <li key={r.reviewer} className="rounded-token border border-line p-3 text-sm">
                <span className="font-semibold">{r.reviewer}</span>{' '}
                <span className={r.verdict === 'approve' ? 'text-good' : 'text-bad'}>
                  {r.verdict === 'approve' ? '✓ approved' : '✕ asked for changes'}
                </span>
                {r.comment && <p className="mt-1 whitespace-pre-line">{r.comment}</p>}
              </li>
            ))}
          </ul>
          {detail.canReview && (
            <div className="flex flex-col gap-2">
              <label htmlFor={commentId} className="text-sm font-semibold">
                Your review
              </label>
              <textarea
                id={commentId}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Is it original, correct, clear and fair? Is the answer key right?"
                className="rounded-token border border-muted bg-surface p-3 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void run(() => adminApi.review(id, 'approve', comment), 'Approved.')
                  }
                  className={primary}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void run(() => adminApi.review(id, 'changes', comment), 'Changes requested.')
                  }
                  className={secondary}
                >
                  Ask for changes
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function Editor() {
  const { id, type } = useParams();
  // A new draft becomes /admin/q/<id> after saving; remount so state starts clean.
  return (
    <Gate>
      <EditorScreen key={id ?? `new-${type}`} />
    </Gate>
  );
}
