import { TRADEMARK_NOTICE } from '../../components/Footer.tsx';

export function About() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">About openpte</h1>
      <p>
        openpte is a free, open-source practice platform for the PTE Academic test. It needs no
        account, has no paywall and no trackers, and processes your answers on your own device.
      </p>
      <h2 className="text-lg font-semibold">Scores</h2>
      <p>
        Every score openpte shows is a practice estimate made by open, auditable code. It is not an
        official PTE score.
      </p>
      <h2 className="text-lg font-semibold">Questions</h2>
      <p>
        Every question is written for this project or adapted from openly licensed sources, which
        are credited on the question. Nothing is copied from the real test, prediction files or
        other practice platforms.
      </p>
      <h2 className="text-lg font-semibold">Licences</h2>
      <ul className="list-disc pl-6">
        <li>Code: GNU Affero General Public License v3.0 (AGPL-3.0).</li>
        <li>
          Questions, audio and images: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0).
        </li>
      </ul>
      <h2 className="text-lg font-semibold">Trademark</h2>
      <p>{TRADEMARK_NOTICE}</p>
    </div>
  );
}
