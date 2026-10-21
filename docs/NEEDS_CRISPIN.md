# Needs crispin

Things only crispin can do or decide. The build keeps going around them; each item says what it blocks.

## To do (accounts and settings)

1. **GitHub Actions is blocked by billing.** Every run stops before any step with "The job was not
   started because your account is locked due to a billing issue." Open GitHub > Settings > Billing
   and plans, clear the failed payment or spending limit, then re-run the latest workflow. Public
   repos get Actions free once the lock is gone. Blocks: CI checks and the Pages deploy. Everything
   was tested here instead: 74 unit tests, 68 browser tests on phone and desktop, lint clean.
2. **Turn on GitHub Pages.** Settings > Pages > Source: GitHub Actions. Blocks: the public demo link.
3. **Hosting accounts.** Oracle Cloud Always Free signup and a Cloudflare account. Blocks: running the
   API and database anywhere but a laptop.
4. **Sign-in email.** An SMTP login from any email provider (for example Brevo, Resend or Zoho free
   tiers), set as `SMTP_URL`. Until then sign-in links are printed in the API log, which is fine
   locally. Blocks: accounts on the hosted site.
5. **Google sign-in (optional).** A Google OAuth client id and secret (`GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`). Email links work without it.
6. **Your admin email.** Put it in `ADMIN_EMAILS` so your account becomes the first admin. Then you can
   make teachers under More > Question bank admin > People and roles.
7. **Try Docker once.** The self-host package (docs/SELF_HOST.md: `./scripts/selfhost-init.sh`, then
   `docker compose up -d --build`) is written but could not be run here (no Docker daemon in the
   build machine). Each part was checked on its own without Docker.
8. **Speech scoring model.** The speech service could not download Whisper here (huggingface.co is
   blocked in the build machine), so it was tested with a fake engine. On your machine or server,
   `docker compose up speech` downloads the model on first start. It needs about 2 GB of RAM for the
   `small` model. Blocks: real speaking scores.
9. **Grammar checking (2.6).** Built and tested against a stand-in; Docker Compose now includes a
   LanguageTool container (about 1 GB of memory). Nothing to do unless the server is small, in
   which case remove the `languagetool` service.

## To decide

10. **Which countries are the first students in?** Default until you say otherwise: Nepal first, data
    stored in Mumbai or Hyderabad.
11. **Keep the Phase 0 code?** Assumed yes; everything since builds on it.
12. **Streaks, or only a daily goal?** Built with a daily goal only, no streak (gentler, no guilt).
13. **Text-to-speech voices.** Check the licences of the Piper or Kokoro voices before audio is
    generated for real. Until then the browser's own voice reads listening questions.
14. **Who may start an institute on the hosted site?** Default: anyone signed in (it is free). Set
    `INSTITUTE_CREATION=admin` to allow only admins. A self-hosted coaching centre sets
    `SINGLE_INSTITUTE_NAME` instead.

## Try it

```sh
git pull
npm install
npm run dev          # practice app, no server needed: http://localhost:5173
```

With accounts and the admin (needs PostgreSQL running locally):

```sh
set DATABASE_URL=postgres://user:pass@localhost:5432/openpte   # PowerShell: $env:DATABASE_URL="..."
set ADMIN_EMAILS=you@example.com
npm run dev:api      # API on http://localhost:3000; sign-in links appear in this window
set VITE_API_URL=http://localhost:3000
npm run dev
```

New since last night, to click through: **Practice > Mock tests** (full, mini, sectional or your own
mix, with a printable report), and with the API running **More > Institutes and classes** (start an
institute, add a class, share its code or import a CSV, set assignments, brand it with a colour
and logo, and see who needs help).
