import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import type { Question, QuestionType } from '@openpte/schema';
import { NotFound } from '../app/pages/NotFound.tsx';
import { ANSWERABLE } from '../answer/registry.ts';
import { getType, loadQuestions } from '../content/catalog.ts';
import { recordAttempt } from '../practice/history.ts';
import { advance, restOfSection } from './flow.ts';
import { buildReport, type ItemResult, type Report } from './report.ts';
import { getSitting, paperItems, updateSitting, useSittings, type Sitting } from './store.ts';

const clock = (s: number) => {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Sends an assignment's report summary to the class; the report page says if it failed. */
export async function sendToTeacher(paperId: string, assignmentId: string, report: Report) {
  const { instituteApi } = await import('../institute/api.ts');
  const skills = Object.fromEntries(report.skills.map((s) => [s.skill, s.score]));
  const sent = await instituteApi
    .submitMock(assignmentId, { overall: report.overall, skills, questions: report.results.length })
    .then(
      () => 'yes' as const,
      () => 'failed' as const,
    );
  updateSitting(paperId, { sent });
}

function useTick(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);
  return now;
}

/** Scores one item. A skipped item keeps its marks available but earns none. */
async function scoreItem(q: Question, response: unknown, skipped = false): Promise<ItemResult> {
  const a = ANSWERABLE[q.type]!;
  const r = await a.score(q, skipped ? a.initial(q) : response);
  return { type: q.type, questionId: q.id, score: skipped ? 0 : r.score, max: r.max, skipped };
}

function useQuestions(types: QuestionType[]) {
  const [byId, setById] = useState<Map<string, Question> | null | undefined>(undefined);
  const key = types.join(',');
  useEffect(() => {
    let live = true;
    Promise.all(key.split(',').map((t) => loadQuestions(t as QuestionType))).then(
      (lists) => live && setById(new Map(lists.flat().map((q) => [q.id, q]))),
      () => live && setById(null),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return byId;
}

export function MockRun() {
  const { id = '' } = useParams();
  const sitting = useSittings().find((s) => s.paper.id === id);
  if (!sitting) return <NotFound />;
  if (sitting.report) return <Navigate to={`/mock/report/${id}`} replace />;
  return <Runner sitting={sitting} />;
}

function Runner({ sitting }: { sitting: Sitting }) {
  const { paper } = sitting;
  const items = paperItems(paper);
  const byId = useQuestions([...new Set(items.map((i) => i.type))]);

  // Finished every item: build the report once and count the scored items in practice history.
  const done = sitting.position >= items.length;
  useEffect(() => {
    if (!done) return;
    const now = Date.now();
    const report = buildReport(paper, sitting.results, now);
    for (const r of sitting.results) {
      if (r.max === 0 || r.skipped) continue;
      const def = getType(r.type)!;
      recordAttempt({ ...r, skill: def.skill, at: now });
    }
    updateSitting(paper.id, { report });
    if (paper.assignmentId) void sendToTeacher(paper.id, paper.assignmentId, report);
  }, [done, paper, sitting.results]);

  if (byId === null) return <p role="alert">The questions could not be loaded. Try again later.</p>;
  if (!byId || done) return <p>Loading…</p>;

  const item = items[sitting.position]!;
  const section = paper.sections[item.section]!;
  if (sitting.itemStartedAt === null)
    return (
      <SectionIntro
        sitting={sitting}
        sectionIndex={item.section}
        resume={items[sitting.position - 1]?.section === item.section}
      />
    );
  const question = byId.get(item.questionId);
  if (!question) return <p role="alert">This mock uses a question that no longer exists.</p>;
  return (
    <Item
      key={sitting.position}
      sitting={sitting}
      question={question}
      sectionLabel={section.label}
      sharedTimeS={section.sharedTimeS}
      byId={byId}
      total={items.length}
    />
  );
}

function SectionIntro({
  sitting,
  sectionIndex,
  resume,
}: {
  sitting: Sitting;
  sectionIndex: number;
  resume: boolean;
}) {
  const section = sitting.paper.sections[sectionIndex]!;
  const first = sectionIndex === 0 && !resume;
  const left = section.sharedTimeS - sitting.sectionUsedS;
  return (
    <section className="flex max-w-prose flex-col gap-4" aria-labelledby="part-heading">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">
        {sitting.paper.label}
      </p>
      <h1 id="part-heading" className="text-2xl font-bold">
        Part {sectionIndex + 1}: {section.label}
      </h1>
      {resume ? (
        <p>
          Paused at question {sitting.position + 1}. That question starts again when you continue.
          {section.sharedTimeS > 0 && ` ${clock(left)} left in this part.`}
        </p>
      ) : (
        <p>
          {section.items.length} question{section.items.length === 1 ? '' : 's'}.{' '}
          {section.sharedTimeS
            ? `${Math.round(section.sharedTimeS / 60)} minutes shared by the questions without their own timer.`
            : 'Each question has its own timer.'}
        </p>
      )}
      {first && (
        <ul className="list-disc pl-5 text-muted">
          <li>Questions come one at a time, as in the test. You cannot go back to a question.</li>
          <li>When time runs out your answer is submitted as it is.</li>
          <li>
            Speaking answers are recorded on this device but not scored in a mock. Practise them one
            by one to get feedback.
          </li>
          <li>Your progress is saved, so you can close the page and continue later.</li>
        </ul>
      )}
      <button
        type="button"
        onClick={() => updateSitting(sitting.paper.id, { itemStartedAt: Date.now() })}
        className="min-h-11 self-start rounded-token bg-brand px-6 font-semibold text-brand-ink"
      >
        {resume ? 'Continue' : `Start part ${sectionIndex + 1}`}
      </button>
    </section>
  );
}

function Item({
  sitting,
  question,
  sectionLabel,
  sharedTimeS,
  byId,
  total,
}: {
  sitting: Sitting;
  question: Question;
  sectionLabel: string;
  sharedTimeS: number;
  byId: Map<string, Question>;
  total: number;
}) {
  const def = getType(question.type)!;
  const answerable = ANSWERABLE[question.type]!;
  const [response, setResponse] = useState<unknown>(() => answerable.initial(question));
  const [busy, setBusy] = useState(false);
  const now = useTick(!busy);
  const elapsed = (now - sitting.itemStartedAt!) / 1000;
  const shared = sharedTimeS > 0 && def.timing.mode === 'section_shared';
  const sharedLeft = sharedTimeS - sitting.sectionUsedS - (shared ? elapsed : 0);
  const itemLeft =
    def.timing.mode === 'per_item' && !answerable.unscored ? def.timing.answer_s - elapsed : null;

  const submit = async (timeUp: 'item' | 'section' | null) => {
    if (busy) return;
    setBusy(true);
    const results = [await scoreItem(question, response)];
    if (timeUp === 'section') {
      const items = paperItems(sitting.paper);
      for (const i of restOfSection(sitting)) {
        const { type, questionId } = items[i]!;
        const q = byId.get(questionId);
        results.push(
          q
            ? await scoreItem(q, null, true)
            : { type, questionId, score: 0, max: 0, skipped: true },
        );
      }
    }
    // Read the latest copy in case another tab moved on meanwhile.
    const latest = getSitting(sitting.paper.id);
    if (!latest || latest.position !== sitting.position) return;
    updateSitting(sitting.paper.id, advance(latest, results, shared ? elapsed : 0, Date.now()));
  };
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  const sectionOver = shared && sharedLeft <= 0;
  const itemOver = itemLeft !== null && itemLeft <= 0;
  useEffect(() => {
    if (sectionOver) void submitRef.current('section');
    else if (itemOver) void submitRef.current('item');
  }, [sectionOver, itemOver]);

  const View = answerable.View;
  const timer =
    itemLeft !== null
      ? { label: 'Time left on this question', s: itemLeft }
      : shared
        ? { label: `Time left in ${sectionLabel}`, s: sharedLeft }
        : null;
  return (
    <div className="flex flex-col gap-5" data-testid="mock-item" data-type={question.type}>
      <div className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <p className="text-sm text-muted">
          <span className="font-semibold text-ink">{def.label}</span> · Question{' '}
          {sitting.position + 1} of {total}
        </p>
        {timer && (
          <p
            role="timer"
            aria-label={timer.label}
            className={`font-mono text-lg font-semibold tabular-nums ${timer.s <= 30 ? 'text-bad' : ''}`}
          >
            {clock(timer.s)}
          </p>
        )}
      </div>
      <View question={question} response={response} onChange={setResponse} review={false} exam />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit(null)}
          disabled={busy}
          className="min-h-11 rounded-token bg-brand px-6 font-semibold text-brand-ink disabled:opacity-60"
        >
          {busy ? 'Saving…' : sitting.position + 1 === total ? 'Finish test' : 'Next'}
        </button>
        <p className="text-sm text-muted">You cannot come back to this question.</p>
        <Link
          to="/mock"
          onClick={() =>
            updateSitting(sitting.paper.id, {
              sectionUsedS: sitting.sectionUsedS + (shared ? elapsed : 0),
              itemStartedAt: null,
            })
          }
          className="ml-auto text-sm text-muted underline"
        >
          Pause
        </Link>
      </div>
    </div>
  );
}
