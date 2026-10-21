# openpte

Free, open-source practice for the PTE Academic test. No account, no paywall, no trackers. Your answers are
processed on your own device.

> Independent open-source project. Not affiliated with, endorsed by, or connected to Pearson. PTE is a trademark
> of Pearson. Every score openpte shows is a practice estimate, not an official PTE score.

## Status

Phase 1 is under way. Working today: Reading (5 types), Listening (8 types) and Writing (3 types) can be
answered and scored with the rule and arithmetic shown; Today and Progress pages built from your history on
this device; and an API with PostgreSQL that serves the question bank. Speaking (audio scoring) and accounts come
next. The step-by-step plan and progress are in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

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
| `npm run dev:api`  | Start the API on port 3000 (needs PostgreSQL; set `DATABASE_URL`)                          |

To run everything (PostgreSQL, the API and the web app) with Docker:

```sh
docker compose up --build   # web http://localhost:8080, API http://localhost:3000/health
```

## Self-host

There are two ways to run openpte.

- **Static site only.** `npm run build` produces a static site in `apps/web/dist/`. Upload it to any static host
  (GitHub Pages, Cloudflare Pages, Netlify, or a plain web server). Questions are bundled into the site. Set
  `OPENPTE_INCLUDE_UNREVIEWED=1` when building if you also want questions that are still in review.
- **With the API.** `docker compose up --build` runs PostgreSQL, the API and the web app on one machine. Build the
  web app with `VITE_API_URL` pointing at the API and it reads questions from there. Accounts, teachers and
  institutes will need this mode.

This repo deploys the static site to GitHub Pages on every push to `main` (see `.github/workflows/deploy.yml`).
Turn it on once under Settings, Pages, Source: GitHub Actions.

## Repository layout

| Folder                         | Contents                                           | Licence      |
| ------------------------------ | -------------------------------------------------- | ------------ |
| `apps/web/`                    | The web app: routes, screens, components           | AGPL-3.0     |
| `apps/api/`                    | The API: Fastify, PostgreSQL with Drizzle          | AGPL-3.0     |
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
