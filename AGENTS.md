# openpte: build spec for coding agents

Save this file as `AGENTS.md` (and a copy as `CLAUDE.md`) in the repo root. It replaces the original build brief and merges in three reviewed documents: the Phase 0 proposal, the scoring strategy and the product plan. Where this file and an older document differ, this file wins.

Status: Phase 0 built on 2026-10-21. Do not start Phase 1 until the Phase 0 review is done.

---

## 1. Mission

A free, open-source web app for practising PTE Academic. It covers all four skills, scores answers automatically where possible, tracks progress, runs on a phone over a slow connection, and costs close to nothing to host. Anyone can fork it, self-host it and contribute questions.

Three audiences:

1. **Learners practising alone.** Free forever, no login, everything on their device.
2. **Teachers and institutes.** Classes, assignments and marking, through an optional self-hosted server (Phase 4).
3. **Consultancies and sellers.** White-label and self-host it, and earn from coaching and services rather than from paywalling the software.

## 2. Non-negotiables

1. Free forever for learners. No paywall. No login for solo practice. Accounts exist only on the optional server.
2. Original content only. Never copy, scrape or reproduce questions, prediction files, audio, images or templates from APEUni, Alfa PTE, Gurully, PTE Success, PTE Magic, Language Academy or Pearson. Never import "recalled" or "predicted" exam questions.
3. Never reverse-engineer or copy competitors' code or scoring engines.
4. Honest scoring. Scores are practice estimates, never official PTE scores. A disclaimer appears on every score screen and cannot be turned off in config.
5. Trademark footer on every page: "Independent open-source project. Not affiliated with, endorsed by, or connected to Pearson. PTE is a trademark of Pearson." No Pearson logos.
6. Privacy by default. Recordings and essays are processed on the device. Nothing is uploaded unless the user opts in for that specific purpose (class sharing, data donation, sync). No third-party trackers.
7. Licences: code **AGPL-3.0**, content **CC BY-SA 4.0**, in separate folders with separate LICENSE files.

## 3. Decisions (settled defaults)

| Topic                        | Decision                                                                                                                                                                                  | Reason                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Code licence                 | AGPL-3.0                                                                                                                                                                                  | Keeps the scoring code open: a seller who runs a modified copy must publish the changes. MIT would let a paid platform close it. |
| Content licence              | CC BY-SA 4.0                                                                                                                                                                              | Compatible with Wikipedia-sourced passages.                                                                                      |
| Framework                    | React + TypeScript + Vite, static build                                                                                                                                                   | No SSR needed; smaller than a Next.js static export.                                                                             |
| Routing                      | React Router, hash routes                                                                                                                                                                 | Works on GitHub Pages and any static host with no rewrites.                                                                      |
| Styling                      | Tailwind v4 + CSS variables in `src/styles/tokens.css`                                                                                                                                    | Dark mode is a variable swap.                                                                                                    |
| Local storage                | Dexie (IndexedDB), added in Phase 1                                                                                                                                                       | Phase 0 stores nothing.                                                                                                          |
| Schema                       | Zod is the single source; JSON Schema generated from it                                                                                                                                   | Validates in the app and CI; gives contributors YAML autocomplete.                                                               |
| Content format               | YAML, one file per question, compiled to JSON at build time                                                                                                                               | Easy to write and review.                                                                                                        |
| Content loading              | `import.meta.glob`, one lazy chunk per item type                                                                                                                                          | Phones download only the type being practised.                                                                                   |
| Package manager / runtime    | npm, Node 22 LTS                                                                                                                                                                          | Fewest setup steps, including on Windows.                                                                                        |
| Tests                        | Vitest (logic), Playwright + `@axe-core/playwright` (flows, accessibility)                                                                                                                | One e2e run covers both.                                                                                                         |
| Grammar checking             | **No LanguageTool by default.** In-browser rule checks + Hunspell spelling (nspell). Grammar via a LanguageTool server only if the user enters a server URL in settings (off by default). | LanguageTool has no in-browser build, and its public API sends essay text to a third party.                                      |
| Speech recognition (Phase 2) | Whisper via transformers.js, word timestamps on                                                                                                                                           | Maintained WASM/WebGPU path.                                                                                                     |
| Hosting                      | GitHub Pages (Cloudflare Pages works too)                                                                                                                                                 | Free; same static build.                                                                                                         |
| Optional server (Phase 4)    | Node + SQLite in one Docker image, `server/` folder                                                                                                                                       | Easiest thing for an institute to self-host. Revisit Supabase only if needed.                                                    |
| Item type ids                | The 22 ids in `content/item-types.yaml` from the seed bank                                                                                                                                | Already used by 220 seed questions.                                                                                              |

Ask before adding paid services, telemetry, or any dependency with a GPL, AGPL, non-commercial or missing licence (AGPL is fine for our own code, not as a new dependency without review).

## 4. Repo layout

```
openpte/
├─ LICENSE                    # AGPL-3.0 (code)
├─ README.md                  # what it is, disclaimer, run locally, self-host
├─ CONTRIBUTING.md            # code + question contribution, review checklist
├─ CODE_OF_CONDUCT.md
├─ AGENTS.md / CLAUDE.md      # this file
├─ .github/
│  ├─ workflows/ci.yml        # lint, test, content, build, e2e
│  ├─ workflows/deploy.yml    # GitHub Pages on push to main
│  ├─ ISSUE_TEMPLATE/new-question.yml
│  ├─ pull_request_template.md
│  └─ dependabot.yml
├─ src/
│  ├─ app/                    # routes, layout, Footer (trademark notice)
│  ├─ components/             # ScoreDisclaimer, Timer, ThemeToggle
│  ├─ items/                  # one renderer folder per item type (Phase 1+)
│  ├─ scoring/                # every scoring rule + tests, each citing its source
│  ├─ schema/                 # Zod: base + one schema per item type
│  ├─ content/                # loader for compiled question bundles
│  └─ styles/tokens.css
├─ content/                   # CC BY-SA 4.0
│  ├─ LICENSE
│  ├─ item-types.yaml         # data-driven registry of item types
│  └─ questions/<skill>/<type>/<id>.yaml
├─ content-assets/            # CC BY-SA 4.0
│  ├─ LICENSE
│  ├─ audio/<id>.mp3 + <id>.meta.yaml
│  └─ images/<id>.svg + <id>.meta.yaml
├─ server/                    # reserved for Phase 4 (README only in Phase 0)
├─ scripts/
│  ├─ validate-content.ts     # CI and `npm run validate`
│  └─ build-schema.ts         # writes JSON Schema for editors
├─ tests/
│  ├─ e2e/
│  └─ fixtures/bad-question.yaml
└─ public/
```

Every media file has a `.meta.yaml` sidecar: `source`, `license`, `author`, `voice: tts | human` (audio), `attribution` where needed.

## 5. Content

### 5.1 Item-type registry

`content/item-types.yaml` holds everything about a type that is not a question: `id`, `label`, `skill`, `section`, `enabled`, `scoring_rule`, `timing` (`per_item` with `prep_s`/`answer_s`, or `section_shared`), `word_limits`, `enabling_skills`. Renaming, retiming or hiding a type is a data edit. A new type still needs a schema and a renderer. Verify timings and word limits against Pearson's current official guide and cite the page in a comment.

The 22 types (PTE Academic, tests after 7 August 2025, per https://www.pearsonpte.com/pte-updates-2025/):

- Speaking & Writing: `speaking_read_aloud`, `speaking_repeat_sentence`, `speaking_describe_image`, `speaking_retell_lecture`, `speaking_answer_short_question`, `speaking_summarize_group_discussion`, `speaking_respond_to_situation`, `writing_summarize_written_text`, `writing_essay`
- Reading: `reading_fib_dropdown`, `reading_mcq_multiple`, `reading_reorder_paragraphs`, `reading_fib_drag_drop`, `reading_mcq_single`
- Listening: `listening_summarize_spoken_text`, `listening_mcq_multiple`, `listening_fib`, `listening_highlight_correct_summary`, `listening_mcq_single`, `listening_select_missing_word`, `listening_highlight_incorrect_words`, `listening_write_from_dictation`

### 5.2 Base fields (every question)

| Field                       | Rule                                                               |
| --------------------------- | ------------------------------------------------------------------ |
| `id`                        | `<type-slug>-NNNN`, unique, matches the file name                  |
| `type`                      | exists in the registry; skill comes from the registry              |
| `tags`, `difficulty`        | free tags; difficulty 1 to 5                                       |
| `status`                    | `draft`, `in_review`, `published`; only `published` ships          |
| `source`                    | `original`, `contributor`, `public-domain`, `open-licensed`        |
| `source_url`, `attribution` | required unless `source: original`                                 |
| `license`                   | allowlist: CC-BY-SA-4.0, CC-BY-4.0, CC0-1.0, public domain         |
| `author`, `reviewed_by`     | GitHub handles; `published` needs 2 reviewers, neither the author  |
| `drafted_with`              | optional `ai`; such items still need 2 human reviewers             |
| `originality_confirmed`     | `true`: not copied from any exam, prediction file or paid platform |
| `explanation`               | optional, shown in review mode                                     |

### 5.3 Per-type fields

Blanks are `{{b1}}` markers in text. Option answers are zero-based indexes. Media fields are paths into `content-assets/`. Every audio item has a `transcript`.

| Type                             | Fields                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read Aloud                       | `text`                                                                                                                                                                 |
| Repeat Sentence                  | `audio`, `transcript`                                                                                                                                                  |
| Describe Image                   | `image`, `alt_text`, `key_points[]`, `sample_answer`                                                                                                                   |
| Re-tell Lecture                  | `audio`, `transcript`, `key_points[]`, `image?`, `sample_answer`                                                                                                       |
| Answer Short Question            | `audio`, `transcript`, `accepted_answers[]`                                                                                                                            |
| Summarize Group Discussion       | `audio`, `transcript` (lines `Name: text`), `speakers[]` (3), `key_points[]`, `sample_answer`                                                                          |
| Respond to a Situation           | `situation_text` (max 60 words), `audio`, `key_points[]`, `sample_answer`                                                                                              |
| Summarize Written Text           | `passage`, `sample_answer`                                                                                                                                             |
| Write Essay                      | `prompt`, `sample_answer`                                                                                                                                              |
| Reading & Writing FIB (dropdown) | `passage`, `blanks[]` of `{id, options[], answer}`                                                                                                                     |
| Reading MCQ multiple             | `passage`, `question`, `options[]`, `answers[]`                                                                                                                        |
| Re-order Paragraphs              | `paragraphs[]` in correct order (shuffled at runtime)                                                                                                                  |
| Reading FIB (drag and drop)      | `passage`, `blanks[]` of `{id, answer}`, `distractors[]`                                                                                                               |
| Reading MCQ single               | `passage`, `question`, `options[]`, `answer`                                                                                                                           |
| Summarize Spoken Text            | `audio`, `transcript`, `sample_answer`                                                                                                                                 |
| Listening MCQ multiple           | `audio`, `transcript`, `question`, `options[]`, `answers[]`                                                                                                            |
| Listening FIB                    | `audio`, `transcript` with markers, `blanks[]` of `{id, answer}`                                                                                                       |
| Highlight Correct Summary        | `audio`, `transcript`, `options[]`, `answer`                                                                                                                           |
| Listening MCQ single             | `audio`, `transcript`, `question`, `options[]`, `answer`                                                                                                               |
| Select Missing Word              | `audio` (ends in a beep), `transcript` (stops at the beep), `options[]`, `answer`                                                                                      |
| Highlight Incorrect Words        | `audio`, `transcript` (as spoken), `swaps[]` of `{index, shown}`; `index` is a position in `transcript.split()`, `shown` is the full displayed token incl. punctuation |
| Write from Dictation             | `audio`, `sentence`                                                                                                                                                    |

Cross-field checks (Zod refinements): every marker has a blank and vice versa; answer indexes in range; MCQ multiple has at least one answer; swap indexes point at real words; SGD has exactly 3 speakers.

### 5.4 Seed bank

The repo ships 220 seed questions, 10 per type, in `content/questions/`, plus 10 SVG charts with sidecars in `content-assets/images/` and 130 TTS scripts in `content-assets/audio/audio-jobs.json`. All items are `status: in_review`, `author: openpte-seed`, `reviewed_by: []`, `drafted_with: ai`. Audio is generated with `python3 tools/generate_audio.py --voices <dir>` (Piper TTS); check each voice's model-card licence before publishing audio. Sources are listed in `content/SOURCES.md`.

Only `published` questions ship by default. Set `OPENPTE_INCLUDE_UNREVIEWED=1` at build time (always on in `npm run dev`) to include `in_review` questions; each one then shows a "not yet reviewed" banner.

### 5.5 Contribution pipeline (Phase 4a; documented in CONTRIBUTING from Phase 0)

1. Write in the in-app editor (form per item type, live preview, TTS or upload for media).
2. Declare the source and confirm originality.
3. Submit: the editor opens a GitHub PR, or downloads the YAML for people without GitHub. CI checks schema, licence and assets.
4. Two reviewers check accuracy, difficulty, natural English and originality; a plagiarism check compares against known public banks and the web.
5. Merge publishes with the next deploy.

Institutes may keep private questions on their own server; those stay out of the public repo.

## 6. Scoring

All rules live in `src/scoring/`, one function per rule, each with unit tests against hand-computed cases and a comment citing Pearson's published score guide. Verify each rule against the current guide before coding it.

### 6.1 Reading and Listening (exact)

- MCQ single, Highlight Correct Summary, Select Missing Word: 1 or 0.
- MCQ multiple (reading and listening): +1 per correct option, -1 per incorrect option, floor 0.
- Re-order Paragraphs: 1 per correctly ordered adjacent pair.
- FIB (all kinds): 1 per correct blank; type-in blanks check spelling.
- Highlight Incorrect Words: +1 per correct highlight, -1 per wrong highlight, floor 0.
- Write from Dictation: 1 per correct word in the reference sentence, spelling checked.

### 6.2 Writing (rule-based, then learned)

Form (word limits, one sentence for SWT), spelling (Hunspell), vocabulary range, paragraphing and discourse markers, template-overuse detection by n-gram overlap. Grammar only via the opt-in LanguageTool server URL. From Phase 2 to 3: a small fine-tuned transformer (DeBERTa-v3-small class, quantised, about 50 to 100 MB) predicts rubric scores in the browser. Optional bring-your-own-key LLM gives feedback in words only, never the score; off by default.

### 6.3 Speaking (estimates)

| Sub-score     | Method                                                                                            | Model                             | Approx. download |
| ------------- | ------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------- |
| Transcript    | Whisper, word timestamps                                                                          | tiny.en / base.en, 8-bit          | 40 to 80 MB      |
| Content       | Word alignment for Read Aloud / Repeat Sentence; key-point coverage by meaning for open responses | MiniLM-class sentence embeddings  | about 25 MB      |
| Oral fluency  | Speech rate, articulation rate, pauses, fillers, restarts → small regressor                       | tiny                              | under 1 MB       |
| Pronunciation | Phoneme recognition + forced alignment, goodness of pronunciation per phoneme                     | wav2vec2 phoneme model, quantised | 100 to 300 MB    |

Two modes: **Lite** (default; Whisper + features) and **Accurate** (downloads the larger models once, cached, offline afterwards). Audio never leaves the device.

### 6.4 Getting to near-Pearson quality

1. Benchmark on open rated data: speechocean762 (CC BY 4.0) for pronunciation; L2-ARCTIC and learner-essay corpora (ELLIPSE, ASAP-style) for research and testing only where non-commercial. Check every dataset licence before shipping a model trained on it.
2. Community rating loop (needs the Phase 4 server): opt-in answer donation → two volunteer raters score against a public rubric (third rater on disagreement) → track rater agreement → retrain → ship only if the new model beats the old one on a held-out set.
3. Calibration: users may enter official PTE sub-scores next to practice scores to map raw scores to the 10 to 90 scale.
4. Public accuracy page: per item type, correlation with human ratings and mean absolute error in points.

### 6.5 Enabling skills

Report grammar, oral fluency, pronunciation, spelling, vocabulary and written discourse wherever the data supports it.

## 7. Analytics (per learner, on device)

| View            | Shows                                                                 |
| --------------- | --------------------------------------------------------------------- |
| Overview        | Estimated score per skill and overall, 30-day trend, streak           |
| By item type    | Accuracy, average score, attempts, time per question for all 22 types |
| Enabling skills | The six skills over time                                              |
| Mock history    | Section scores, time, comparison with earlier mocks                   |
| Mistake review  | Wrong answers with correct answer, explanation, recording replay      |
| Time management | Time used against exam limits per item and section                    |
| Weak-area plan  | Three weakest types and skills, with a suggested practice set         |

Export as PDF report or JSON backup. Nothing leaves the device unless the learner joins a class or turns on sync.

## 8. Teachers, institutes, sellers (Phase 4, optional server)

Roles:

| Role                   | Can do                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| Student                | Practise, join classes by invite code, choose what to share, leave with their data                     |
| Teacher                | Classes, assignments with due dates, student analytics, listen to shared recordings, score and comment |
| Institute admin        | Teachers and classes, CSV bulk import, branding, private questions, institute reports, multi-branch    |
| Contributor / reviewer | Public question bank only; no student data                                                             |

Teacher tools: class dashboard (sortable by who needs help), assignments (by type, difficulty, tag, or mock), marking queue (shared answers; human scores can feed the rating loop with consent), PDF progress reports, short comments.

Institute and seller needs: white-label from a config file (logo, colours, name, domain; disclaimer and "Powered by openpte" stay), bulk onboarding, branded reports, private question sets and mocks, multi-branch admin, one-click Docker deploy with an admin guide.

Allowed seller models: coaching and counselling; paid hosting and setup; paid human marking; their own private premium questions. Not allowed: claiming official or guaranteed scores. Under AGPL, modified copies run for others must publish their source.

Conflict resolutions: accounts exist only in `server/`; recording sharing is per class and per answer, off by default, revocable; the public app stays free; institutes are responsible for data on their own server, which ships with no trackers, export and delete built in, and a privacy-policy template.

## 9. Roadmap and acceptance criteria

**Phase 0, foundations (about 1 week).** Repo, licences, README, CONTRIBUTING, CODE_OF_CONDUCT, CI, deploy, Dependabot, design tokens, empty app shell with footer and score disclaimer, Zod schemas for all 22 types, registry, validator, seed bank imported, `server/` reserved.
Done when: CI is green; a sample question of each skill renders; `tests/fixtures/bad-question.yaml` is rejected by a unit test with a readable message; all 220 seed items pass validation.

**Phase 1, Reading, Listening, Writing MVP (3 to 4 weeks).** All Reading and Listening types playable, SWT and Essay with local checks, exam timers, local progress (Dexie), local analytics (overview, by type, mistake review, time management), 100+ reviewed questions published.
Done when: every item type is playable end to end; scoring has unit tests against hand-computed cases; Lighthouse accessibility is 95+ (add Lighthouse CI here).

**Phase 2, Speaking (3 to 4 weeks).** Recording UI, Whisper in the browser, content / fluency / pronunciation estimates, Lite and Accurate modes, shadowing mode, enabling-skills trend for Speaking.
Done when: each Speaking type works offline after the first model download, and the score screen explains each sub-score.

**Phase 3, mocks and analytics (3 weeks).** Sectional and full mocks, report with enabling skills, mock history, weak-area plan, custom mock builder, PDF export, learned writing model.
Done when: a full mock runs about 2 hours with exam-style timing and produces a downloadable report.

**Phase 4a, contribution.** In-app question editor that opens PRs; plagiarism check in review.
**Phase 4b, server.** Accounts, classes, invite codes, assignments, consent-based sharing, marking queue, rating loop, optional sync.
**Phase 4c, institutes.** Admin role, CSV import, branding config, private questions, branded reports, multi-branch, Docker deploy. Later: PTE Core, UI translations.

## 10. CI (GitHub Actions, Node 22, on every PR and push to main)

| Job     | Runs                                       | Fails when                                                                                                                               |
| ------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| lint    | ESLint, `prettier --check`, `tsc --noEmit` | style, lint or type errors                                                                                                               |
| test    | Vitest                                     | any unit test fails (incl. bad-fixture test)                                                                                             |
| content | `npm run validate`                         | schema error, duplicate id, id/file mismatch, missing asset or sidecar, licence not allowed, `published` without 2 independent reviewers |
| build   | `vite build` + size check                  | build error, or initial JS over 150 KB gzipped                                                                                           |
| e2e     | Playwright (Chromium) + axe                | sample question not rendered, footer or disclaimer missing, serious/critical axe violation                                               |

Plus: `deploy.yml` to GitHub Pages on push to main; Dependabot weekly for npm and Actions; a dependency licence check that fails on GPL, AGPL, non-commercial or unlicensed packages.

## 11. Working rules for the coding agent

- Start each phase by proposing a short plan (2 to 4 steps) and wait for approval before writing code.
- Simplest thing that works: reuse the repo, then platform features (HTML inputs, Web APIs), then the standard library, then an existing dependency, then new code.
- Never cut validation, error handling, security or accessibility to save lines.
- Anything with branches, parsing or scoring gets a small test.
- Every scoring rule in `src/scoring/`, with a comment citing its source.
- End each task with what changed, what was skipped or not verified, and any risk.
- Ask before adding paid services, telemetry or a restrictively licensed dependency.
- Do not mark seed questions `published`; only human reviewers do that.

## 12. Still open (does not block Phase 0)

- PTE Success, PTE Magic and Language Academy still need a manual feature review before the Phase 3 roadmap is locked.
- Piper voice licences must be checked before any generated audio is published.
- Hunspell English dictionary licence to confirm when spelling is added in Phase 1.
- Whether the project later offers its own hosted institute plan to fund maintenance (learners stay free either way).
