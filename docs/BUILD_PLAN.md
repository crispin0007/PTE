# openpte build plan

The step-by-step plan for building openpte as a full PTE platform. It turns the approved
[architecture plan](https://claude.ai/artifact/EQfz3eaJcANV28m5snXGii) and
[UI plan](https://claude.ai/artifact/Cc9FPQezCeC6ZwpAUFKAvK) into small steps that each ship on their own.
Where this file and AGENTS.md differ, this file wins.

Agreed on 2026-10-21.

## Scope: only what PTE preparation needs

| In                                                                                | Out (cut or deferred)                         |
| --------------------------------------------------------------------------------- | --------------------------------------------- |
| Guest practice, then accounts (email link, Google)                                | Courses, video, certificates                  |
| APEUni-style practice for all 22 question types                                   | Payments and billing                          |
| Scoring, including server speech scoring with word-by-word pronunciation feedback | SMS, push notifications                       |
| Mock tests (full, sectional, custom) and score reports                            | App-store builds (the PWA installs on phones) |
| Progress tracking                                                                 | Leaderboards, badges                          |
| Question bank admin with two-reviewer workflow                                    |                                               |
| Institutes, classes and students; multi-tenant and self-host                      |                                               |

Completely free: no paywall, no payments. Starts on free hosting tiers; server speech scoring has a fair
daily limit per learner, with on-device scoring after that.

Defaults until told otherwise: first students in Nepal, so the data region is the nearest free-tier region
(Mumbai or Hyderabad), times shown in the learner's local time zone, English UI.

## How each step works

1. Build the step on `main`, with tests for any logic.
2. Run lint, unit tests, content validation, build and the browser tests.
3. Push straight to `main` (crispin's rule: no pull requests).
4. Post phone and desktop screenshots, and what changed, what was skipped and any risk.

A step is one to five days of work. If a step grows, it is split, not stretched.

## Phase 1: practice core

The learner side ships first and works for guests with progress saved in the browser. The backend joins in
steps 1.8 to 1.10, and guest history then moves into the new account.

| Step                            | What ships                                                                                                                                                          | Done when                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1.1 Monorepo                    | npm workspaces: `apps/web` (the Phase 0 app), `packages/schema` (Zod schemas, validator, text helpers), shared configs; CI updated                                  | Every existing check passes from the new layout                        |
| 1.2 Look and app shell          | UI plan tokens (skill colours, light and dark), self-hosted fonts, bottom tabs on phone (Today, Practice, Progress, More), side rail on desktop                     | Shell renders on phone and desktop, axe clean, initial JS under budget |
| 1.3 Practice hub                | Skill tabs, type cards with tip text, question list with filters (new, wrong, bookmarked, difficulty)                                                               | Every type opens its list on phone and desktop                         |
| 1.4 Reading: answer and score   | Exam frame (timer, counter, Next), the 5 Reading types answerable, scoring rules in `scoring/` with hand-computed tests, result screen with the rule and arithmetic | Each Reading type can be answered, scored and explained                |
| 1.5 Listening: answer and score | Audio player (transcript fallback until TTS), the 8 Listening types answerable and scored, including Write from Dictation spelling                                  | Each Listening type can be answered, scored and explained              |
| 1.6 Writing: answer and check   | SWT, Essay and SST editors with live word count; form, word-limit and one-sentence checks; spelling (Hunspell); sample answers                                      | Each Writing type returns form and spelling feedback                   |
| 1.7 Today and Progress          | Attempt history in IndexedDB, daily goal, suggested set from weak types, mistake queue, skill bars, 30-day trend                                                    | A guest's history drives Today and Progress across reloads             |
| 1.8 Backend foundation          | `apps/api` (Fastify), PostgreSQL with Drizzle, migrations, Docker Compose, question bank seeded from YAML, practice reads questions from the API                    | `docker compose up` runs the full stack locally; API has tests         |
| 1.9 Accounts                    | Better Auth: email link and Google; sessions; roles; guest history merged into the account; sync of attempts                                                        | A guest signs up and keeps their history on another device             |
| 1.10 Question bank admin        | Question editor per type with live preview, review queue (two reviewers, not the author), publish, YAML export                                                      | An author publishes a question through the admin with two reviews      |

## Phase 2: speaking and writing scoring

| Step                    | What ships                                                                                                           | Done when                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 2.1 Recorder            | Exam-style status box (countdown, Recording, Completed), level check, Opus encoding, upload with consent             | A recording reaches storage and can be replayed                    |
| 2.2 Speech service      | `services/speech` (Python, FastAPI), job queue (Valkey + BullMQ), faster-whisper transcription with word time stamps | A recording comes back as a timed transcript                       |
| 2.3 Content and fluency | Alignment to the expected text, key-point coverage, speech rate, pauses and hesitations                              | Read Aloud and Repeat Sentence get content and fluency scores      |
| 2.4 Pronunciation       | wav2vec2 phoneme model, goodness of pronunciation per phoneme, word colours and sound hints                          | Words are coloured good, average or poor with named sounds         |
| 2.5 Speaking results    | Result screen: coloured transcript, waveform with pauses, side-by-side playback, tips; all 7 Speaking types          | Every Speaking type returns an explained result within 15 seconds  |
| 2.6 Writing scoring     | Self-hosted LanguageTool for grammar, vocabulary range, template-overuse check, errors marked inline                 | Essays and summaries show grammar errors in place                  |
| 2.7 Listening audio     | Text-to-speech for the 130 listening items, with sidecar metadata                                                    | Every Listening and Speaking item has audio                        |
| 2.8 Limits and fallback | Fair daily limit on server scoring, on-device fallback, 30-day audio retention and delete                            | Over the limit, scoring switches to on-device with a clear message |

## Phase 3: mock tests

| Step                            | What ships                                                                     | Done when                                             |
| ------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 3.1 Mock model                  | Mock definitions (full, sectional, custom), question selection rules, attempts | A mock can be defined and started                     |
| 3.2 Exam player                 | Exam-faithful timed player with section timing and no going back               | A full mock runs about 2 hours end to end             |
| 3.3 Score report                | Section and enabling-skill scores, weak areas, PDF download                    | A finished mock produces a downloadable report        |
| 3.4 Mock builder and re-marking | Custom mock builder; teacher re-marking of speaking and writing                | A teacher can override a score and the report updates |

## Phase 4: institutes and students

| Step                     | What ships                                                                  | Done when                                                     |
| ------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 4.1 Tenancy              | Institutes as tenants, data isolation on every query, institute admin role  | Tests prove one institute cannot read another's data          |
| 4.2 Classes and students | Teachers, classes, invite codes, CSV import                                 | An institute onboards a class from a CSV file                 |
| 4.3 Assignments          | Assign practice sets and mocks with due dates; "due this week" for students | A student sees and completes an assignment                    |
| 4.4 Teacher dashboard    | Class dashboard, student progress, marking queue                            | A teacher finds who needs help and marks shared answers       |
| 4.5 Branding             | Institute name, logo and colours; trademark notice and disclaimer stay      | An institute's space shows its branding                       |
| 4.6 Self-host package    | One-command Docker deploy, backups, admin guide                             | A fresh server runs a single-institute install from the guide |

## Not decided yet

- Which countries the first students are in (defaults above until answered).
- Whether to keep streaks or only a daily goal (UI plan open question).
