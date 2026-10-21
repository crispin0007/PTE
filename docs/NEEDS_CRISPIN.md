# Needs crispin

Things only crispin can do or decide. The build keeps going around them; each item says what it blocks.

## To do (accounts and settings)

1. **GitHub Actions does not start.** Every workflow, Dependabot included, ends in `startup_failure`
   before any step runs. That usually means Actions is turned off or limited for the account or repo.
   Check Settings > Actions > General ("Allow all actions") and the billing/spending page, then open
   one failed run and read the message at the top. Blocks: CI checks and the Pages deploy.
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
7. **Try Docker once.** `docker compose up --build` is written but could not be run here (no Docker
   daemon in the build machine). The API install and start were checked without Docker.

## To decide

8. **Which countries are the first students in?** Default until you say otherwise: Nepal first, data
   stored in Mumbai or Hyderabad.
9. **Keep the Phase 0 code?** Assumed yes; everything since builds on it.
10. **Streaks, or only a daily goal?** Built with a daily goal only, no streak (gentler, no guilt).
11. **Text-to-speech voices.** Check the licences of the Piper or Kokoro voices before audio is
    generated for real. Until then the browser's own voice reads listening questions.

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
