# Needs crispin

Things only crispin can do or decide. The build keeps going around them; each item says what it blocks.

## To do (accounts and settings)

1. **GitHub Actions does not start.** Every workflow, Dependabot included, ends in `startup_failure`
   before any step runs. That usually means Actions is turned off or limited for the account or repo.
   Check Settings > Actions > General ("Allow all actions") and the billing/spending page, then open
   one failed run and read the message at the top. Blocks: CI checks and the Pages deploy.
2. **Turn on GitHub Pages.** Settings > Pages > Source: GitHub Actions. Blocks: the public demo link.
3. **Hosting accounts (Phase 2).** Oracle Cloud Always Free signup and a Cloudflare account. Blocks:
   running the backend anywhere but a laptop.
4. **Google sign-in and email (Phase 2).** A Google OAuth client id and secret, and an email sending
   provider key (for sign-in links). Blocks: accounts on the hosted site. Local dev works without them.

## To decide

5. **Which countries are the first students in?** Default until you say otherwise: Nepal first, data
   stored in Mumbai or Hyderabad.
6. **Keep the Phase 0 code?** Assumed yes; the build continues on it.
7. **Streaks, or only a daily goal?** Default: daily goal only, no streak (gentler, no guilt).
8. **Text-to-speech voices.** Check the licences of the Piper or Kokoro voices before audio is
   generated for real. Until then listening questions show the transcript in practice mode.
