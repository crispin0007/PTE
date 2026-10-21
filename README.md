# openpte

Free, open-source practice for the PTE Academic test. No account, no paywall, no trackers. Your answers are
processed on your own device.

> Independent open-source project. Not affiliated with, endorsed by, or connected to Pearson. PTE is a trademark
> of Pearson. Every score openpte shows is a practice estimate, not an official PTE score.

## Status

Phase 0 (foundations) is done: the app shell, question schema for all 22 PTE Academic item types, the content
validator, 220 seed questions awaiting human review, and CI. Answering and scoring arrive in Phase 1. The full
plan is in [AGENTS.md](AGENTS.md).

## Run it locally

You need Node.js 22 or later.

```sh
npm install
npm run dev        # http://localhost:5173, includes questions still in review
```

On Windows, run the same commands in PowerShell or the VS Code terminal.

| Command            | What it does                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `npm run dev`      | Start the app with hot reload                                                              |
| `npm run build`    | Type-check and build the static site into `apps/web/dist/`                                 |
| `npm run preview`  | Serve the built site                                                                       |
| `npm run validate` | Check every question and asset against the schema                                          |
| `npm test`         | Unit tests (schema, validator, scoring)                                                    |
| `npm run test:e2e` | Browser tests with accessibility checks (run `npx playwright install chromium` once first) |
| `npm run lint`     | ESLint, Prettier and TypeScript checks                                                     |
| `npm run schema`   | Write JSON Schema files to `schema/` for editor autocomplete                               |

## Self-host

`npm run build` produces a static site in `apps/web/dist/`. Upload it to any static host (GitHub Pages, Cloudflare Pages,
Netlify, or a plain web server). No server-side code is needed. Set `OPENPTE_INCLUDE_UNREVIEWED=1` when
building if you also want questions that are still in review.

This repo deploys itself to GitHub Pages on every push to `main` (see `.github/workflows/deploy.yml`). Turn it on
once under Settings, Pages, Source: GitHub Actions.

## Repository layout

| Folder                         | Contents                                           | Licence      |
| ------------------------------ | -------------------------------------------------- | ------------ |
| `apps/web/`                    | The web app: routes, screens, components           | AGPL-3.0     |
| `packages/schema/`             | Question schemas and the content validator         | AGPL-3.0     |
| `packages/scoring/`            | Scoring rules                                      | AGPL-3.0     |
| `scripts/`, `tools/`, `tests/` | Build helpers, audio generation, test fixtures     | AGPL-3.0     |
| `content/`                     | Item-type registry and one YAML file per question  | CC BY-SA 4.0 |
| `content-assets/`              | Images and audio, each with a `.meta.yaml` sidecar | CC BY-SA 4.0 |

The build plan is in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Contributing

Questions, reviews and code are all welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first; the most important
rule is that every question must be original or openly licensed, never copied from the real test, prediction
files or other practice platforms.

## Licence

Code: [GNU AGPL-3.0](LICENSE). Content: [CC BY-SA 4.0](content/LICENSE).
