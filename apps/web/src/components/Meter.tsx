/** A labelled horizontal meter. The fill carries the colour; the numbers stay in ink. */
export function Meter({
  label,
  value,
  color,
  detail,
}: {
  label: string;
  value: number | null;
  color: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{label}</span>
        <span className="text-sm text-muted">{detail}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? 0 : Math.round(value * 100)}
        aria-valuetext={value === null ? 'not practised yet' : `${Math.round(value * 100)}%`}
        className="h-2.5 overflow-hidden rounded-full bg-sunken"
      >
        {value !== null && (
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${Math.max(2, value * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}
