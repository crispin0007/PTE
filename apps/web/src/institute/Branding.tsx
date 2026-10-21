import { useId, useState } from 'react';
import { brandColorProblem } from '@openpte/schema/brand';
import { API_URL } from '../content/catalog.ts';
import { chooseInstitute, refreshBranding, useBranding } from '../practice/branding.ts';
import { instituteApi, type Institute } from './api.ts';

const DEFAULT = '#3149d6';

/** Owners pick the institute's colour and logo. The trademark notice and disclaimer never change. */
export function BrandingPanel({ inst, onChange }: { inst: Institute; onChange: () => void }) {
  const colorId = useId();
  const textId = useId();
  const [color, setColor] = useState(inst.brandColor ?? DEFAULT);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const problem = brandColorProblem(color);
  const done = (msg: string) => {
    setError(null);
    setSaved(msg);
    onChange();
    void refreshBranding();
  };
  const fail = (e: Error) => {
    setSaved(null);
    setError(e.message);
  };
  return (
    <section
      aria-labelledby="brand-heading"
      className="flex flex-col gap-3 rounded-token border border-line bg-surface p-5"
    >
      <h2 id="brand-heading" className="text-xl font-semibold">
        Branding
      </h2>
      <p className="text-sm text-muted">
        Students in this institute see its name, logo and colour. The trademark notice and the
        practice-estimate notice always stay.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={colorId} className="flex flex-col gap-1 text-sm">
          Colour
          <input
            id={colorId}
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-16 rounded-token border border-line bg-bg"
          />
        </label>
        <label htmlFor={textId} className="flex flex-col gap-1 text-sm">
          Hex code
          <input
            id={textId}
            value={color}
            onChange={(e) => setColor(e.target.value.trim())}
            className="min-h-11 w-32 rounded-token border border-line bg-bg px-3 font-mono"
          />
        </label>
        <span
          aria-hidden="true"
          className="grid min-h-11 place-items-center rounded-token px-4 font-semibold text-white"
          style={{ background: problem ? '#888' : color }}
        >
          Preview
        </span>
        <button
          type="button"
          disabled={!!problem}
          onClick={() =>
            instituteApi.setColor(inst.id, color).then(() => done('Colour saved.'), fail)
          }
          className="min-h-11 rounded-token bg-brand px-5 font-semibold text-brand-ink disabled:opacity-60"
        >
          Save colour
        </button>
        {inst.brandColor && (
          <button
            type="button"
            onClick={() =>
              instituteApi.setColor(inst.id, null).then(() => {
                setColor(DEFAULT);
                done('Back to the openpte colour.');
              }, fail)
            }
            className="min-h-11 rounded-token border border-line px-4 text-sm font-semibold"
          >
            Use the default
          </button>
        )}
      </div>
      {problem && <p className="text-sm text-bad">{problem}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {inst.logoVersion && (
          <img
            src={`${API_URL}/v1/institutes/${inst.id}/logo?v=${inst.logoVersion}`}
            alt={`${inst.name} logo`}
            className="size-14 rounded-lg border border-line object-contain"
          />
        )}
        <label className="grid min-h-11 cursor-pointer place-items-center rounded-token border border-line px-4 text-sm font-semibold">
          {inst.logoVersion ? 'Replace logo' : 'Upload logo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file)
                instituteApi.uploadLogo(inst.id, file).then(() => done('Logo saved.'), fail);
            }}
          />
        </label>
        {inst.logoVersion && (
          <button
            type="button"
            onClick={() => instituteApi.removeLogo(inst.id).then(() => done('Logo removed.'), fail)}
            className="min-h-11 text-sm text-bad underline"
          >
            Remove logo
          </button>
        )}
        <span className="text-sm text-muted">PNG, JPEG or WebP, square, up to 200 KB.</span>
      </div>
      {saved && <p aria-live="polite">{saved}</p>}
      {error && (
        <p role="alert" className="text-bad">
          {error}
        </p>
      )}
    </section>
  );
}

/** For people in more than one institute: which one's look the app shows. */
export function ShowThisLook({ inst }: { inst: Institute }) {
  const brand = useBranding();
  if (brand?.id === inst.id) return null;
  return (
    <button
      type="button"
      onClick={() => {
        chooseInstitute(inst.id);
        void refreshBranding();
      }}
      className="min-h-11 self-start rounded-token border border-line bg-surface px-4 text-sm font-semibold"
    >
      Show this institute’s look
    </button>
  );
}
