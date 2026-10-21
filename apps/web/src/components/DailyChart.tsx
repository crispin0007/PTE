import { useState } from 'react';

type Day = { day: string; n: number; accuracy: number | null };

const label = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Questions answered per day, one bar per day. Thin bars with rounded tops on a quiet baseline,
 * a hover or focus readout, and a table view for screen readers and anyone who prefers numbers.
 */
export function DailyChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...days.map((d) => d.n));
  const W = 300;
  const H = 120;
  const slot = W / days.length;
  const bar = Math.max(2, slot - 2);
  const shown = hover === null ? null : days[hover];
  const total = days.reduce((n, d) => n + d.n, 0);
  return (
    <figure className="flex flex-col gap-2">
      <p className="min-h-6 text-sm text-muted" aria-live="polite">
        {shown
          ? `${label(shown.day)}: ${shown.n} answered${
              shown.accuracy === null ? '' : `, ${Math.round(shown.accuracy * 100)}% of marks`
            }`
          : `${total} answered in the last ${days.length} days`}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H + 1}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
        role="img"
        aria-label={`Bar chart: questions answered per day over the last ${days.length} days, ${total} in total. A table follows.`}
        onMouseLeave={() => setHover(null)}
      >
        <line
          x1={0}
          x2={W}
          y1={H}
          y2={H}
          stroke="var(--line)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {days.map((d, i) => {
          const h = d.n ? Math.max(3, (d.n / max) * (H - 8)) : 0;
          const x = i * slot + (slot - bar) / 2;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              {/* Hit target taller and wider than the bar. */}
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H} v${-(h - 2)} q0,-2 2,-2 h${bar - 4} q2,0 2,2 v${h - 2} z`}
                  fill="var(--brand)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex justify-between text-xs text-muted">
        <span>{label(days[0]!.day)}</span>
        <span>Today</span>
      </figcaption>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 font-semibold">
                Day
              </th>
              <th scope="col" className="py-1 font-semibold">
                Answered
              </th>
              <th scope="col" className="py-1 font-semibold">
                Marks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days
              .filter((d) => d.n)
              .map((d) => (
                <tr key={d.day}>
                  <td className="py-1">{label(d.day)}</td>
                  <td className="py-1 font-mono">{d.n}</td>
                  <td className="py-1 font-mono">
                    {d.accuracy === null ? '–' : `${Math.round(d.accuracy * 100)}%`}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
