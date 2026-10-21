# Contributing to openpte

Thank you for helping. There are three ways to contribute: write questions, review questions, and write code.

## The rules that never bend

1. **Original content only.** Do not copy, paraphrase closely, scrape or reproduce questions, prediction files,
   "recalled" exam items, audio, images or templates from the real test, Pearson, or any practice platform
   (APEUni, Alfa PTE, Gurully, PTE Success, PTE Magic, Language Academy and others). Write your own, or adapt
   openly licensed sources and credit them.
2. **Honest scoring.** Never describe a score as official, guaranteed or "99% accurate".
3. **Privacy.** Nothing a learner records or writes may leave their device unless they choose it.
4. **No trackers, no paywalls** in this repo.

## Writing a question

1. Copy an existing file of the same type from `content/questions/<skill>/<type>/` and give it the next free id,
   for example `reading-mcq-single-0011.yaml`. The file name must equal the id.
2. Fill in the fields. The schema for every type is in `src/schema/questions.ts`, and `npm run schema` writes JSON
   Schema files for editor autocomplete. Blanks are `{{b1}}` markers; option answers are zero-based indexes.
3. Set the source fields honestly:
   - `source: original` if you wrote it from scratch.
   - `source: open-licensed` or `public-domain` with `source_url` and `attribution` if you used facts or text from
     an open source (for example Wikipedia, CC BY-SA). Write the question in your own words.
   - `originality_confirmed: true` confirms the rule above. `drafted_with: ai` if an AI helped draft it.
4. Set `status: in_review`, `author: <your GitHub handle>` and `reviewed_by: []`.
5. Images go in `content-assets/images/`, audio in `content-assets/audio/`. Every file needs a sidecar
   `<name>.meta.yaml` with `source`, `license`, `author` and, for audio, `voice: tts` or `voice: human`.
6. Run `npm run validate` and fix anything it reports, then open a pull request using the "New question" template.

## Reviewing a question

A question is published only after two reviewers, neither of them the author, approve it. Check:

- [ ] **Accuracy.** The answer key is right and there is only one defensible answer (or set of answers).
- [ ] **Format.** It matches the real item type's format, length and timing.
- [ ] **Language.** Natural, correct academic English; no ambiguity in options.
- [ ] **Difficulty.** The `difficulty` value (1 to 5) is fair.
- [ ] **Originality.** Search a distinctive sentence on the web. It must not match an exam bank or another platform.
- [ ] **Licence and source.** Source and attribution are present and correct.

When you approve, add your handle to `reviewed_by`. The second reviewer also changes `status` to `published`.

## Writing code

1. Read [AGENTS.md](AGENTS.md); it is the project spec.
2. `npm install`, then `npm run dev`.
3. Keep it simple: platform features before libraries, and ask in an issue before adding a dependency. Dependencies
   with GPL, AGPL, non-commercial or missing licences fail CI.
4. Every scoring rule lives in `src/scoring/` with tests and a comment citing its source.
5. Never trade away validation, error handling, security or accessibility to save lines.
6. Before you open a pull request, run `npm run lint`, `npm test`, `npm run validate` and `npm run build`.

By contributing you agree that code is licensed under AGPL-3.0 and content under CC BY-SA 4.0.
