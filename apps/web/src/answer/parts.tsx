import { Fragment, useId, type ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Passage({ text }: { text: string }) {
  return (
    <div className="rounded-token border border-line bg-surface p-4 leading-relaxed whitespace-pre-line">
      {text}
    </div>
  );
}

/** Splits `{{bN}}` text and renders each blank with `renderBlank(index)`. */
export function BlankText({
  text,
  renderBlank,
}: {
  text: string;
  renderBlank: (index: number) => ReactNode;
}) {
  const parts = text.split(/\{\{b\d+\}\}/);
  return (
    <div className="rounded-token border border-line bg-surface p-4 leading-[2.4]">
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && renderBlank(i)}
        </Fragment>
      ))}
    </div>
  );
}

export type ReviewMark = 'right' | 'wrong' | 'missed' | null;

export const markClass: Record<Exclude<ReviewMark, null>, string> = {
  right: 'border-good bg-good-soft',
  wrong: 'border-bad bg-bad-soft',
  missed: 'border-good border-dashed',
};

export function MarkLabel({ mark }: { mark: ReviewMark }) {
  if (!mark) return null;
  const text = { right: 'Correct', wrong: 'Incorrect', missed: 'Correct answer' }[mark];
  return (
    <span
      className={`ml-auto shrink-0 text-xs font-bold ${mark === 'wrong' ? 'text-bad' : 'text-good'}`}
    >
      {mark === 'wrong' ? '✕' : '✓'} {text}
    </span>
  );
}

/** Radio or checkbox options with marking after submit. */
export function Choices({
  name,
  options,
  multiple,
  chosen,
  onChange,
  review,
  answers,
}: {
  name: string;
  options: string[];
  multiple: boolean;
  chosen: number[];
  onChange: (chosen: number[]) => void;
  review: boolean;
  answers: number[];
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        {multiple ? 'Choose all that apply' : 'Choose one'}
      </legend>
      {options.map((o, i) => {
        const picked = chosen.includes(i);
        const key = answers.includes(i);
        const mark: ReviewMark = !review
          ? null
          : picked
            ? key
              ? 'right'
              : 'wrong'
            : key
              ? 'missed'
              : null;
        return (
          <label
            key={i}
            className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-token border bg-surface p-3 ${
              mark ? markClass[mark] : picked ? 'border-brand' : 'border-line hover:border-muted'
            }`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={name}
              checked={picked}
              disabled={review}
              onChange={() =>
                onChange(multiple ? (picked ? chosen.filter((c) => c !== i) : [...chosen, i]) : [i])
              }
              className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
            />
            <span className="font-semibold text-muted">{String.fromCharCode(65 + i)}</span>
            <span>{o}</span>
            <MarkLabel mark={mark} />
          </label>
        );
      })}
    </fieldset>
  );
}

/** Deterministic shuffle so a question shows the same order on every visit. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const next = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
