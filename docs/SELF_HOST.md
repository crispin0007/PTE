# Self-hosting openpte

This guide sets up openpte on one server for a coaching centre or for many institutes. Everything
runs in Docker: PostgreSQL, the API, the speech scoring service, LanguageTool for grammar, the web
app and (optionally) Caddy for HTTPS.

## What you need

- A Linux server with Docker and the Compose plugin. 4 CPU cores and 8 GB of RAM run everything,
  including speech, pronunciation and grammar scoring. On 4 GB, set `PRONUNCIATION=off` (speaking
  pronunciation is then estimated from recognition confidence). To run on 1 GB, remove the
  `speech` and `languagetool` services: speaking is then self-checked and writing is scored for
  form and spelling only. An NVIDIA GPU is optional; see "Speech on a GPU" below.
- About 8 GB of disk to start: the app, the Whisper model (about 250 MB), the phoneme model (about
  1.2 GB) and room for recordings.
- For a public site: two DNS names pointing at the server, for example `pte.example.com` for the
  app and `api.pte.example.com` for the API.
- An email account that can send by SMTP, for sign-in links. Any provider works.

## Install

```sh
git clone https://github.com/crispin0007/PTE.git openpte
cd openpte
./scripts/selfhost-init.sh     # writes .env with fresh secrets
nano .env                      # see "Settings" below
docker compose up -d --build
```

Open `http://SERVER:8080`. The API answers at `http://SERVER:3000/health`.

### HTTPS on a public server

In `.env` set:

```sh
WEB_DOMAIN=pte.example.com
API_DOMAIN=api.pte.example.com
PUBLIC_WEB_URL=https://pte.example.com
PUBLIC_API_URL=https://api.pte.example.com
```

Then start with the `https` profile. Caddy fetches and renews the certificates itself.

```sh
docker compose --profile https up -d --build
```

Close ports 3000 and 8080 in the firewall once HTTPS works; only 80 and 443 need to be open.

## Settings

All settings live in `.env`. After changing it, run `docker compose up -d --build` again (the web
app is rebuilt when `PUBLIC_API_URL` changes).

| Setting                                    | What it does                                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `PUBLIC_WEB_URL`                           | Where people open the app. Sign-in links return here, and only this site may use accounts.    |
| `PUBLIC_API_URL`                           | Where the app reaches the API. Built into the web app.                                        |
| `BETTER_AUTH_SECRET`                       | Signs sessions. Made by the init script; changing it signs everyone out.                      |
| `POSTGRES_PASSWORD`                        | Database password. Made by the init script; set it before the first start.                    |
| `ADMIN_EMAILS`                             | Comma-separated emails of platform admins. They can make teachers in the question bank admin. |
| `SINGLE_INSTITUTE_NAME`                    | For one coaching centre: its name. Everyone who signs in joins it; admins become its owners.  |
| `INSTITUTE_CREATION`                       | With many institutes: `anyone` signed in may start one, or only an `admin`.                   |
| `SMTP_URL`, `MAIL_FROM`                    | Sign-in email, for example `smtps://user:password@smtp.example.com:465`.                      |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google sign-in. The redirect URL is `PUBLIC_API_URL/api/auth/callback/google`.       |
| `INCLUDE_UNREVIEWED`                       | `1` shows questions still waiting for two human reviews. The bundled bank is still in review. |
| `SPEECH_DAILY_LIMIT`                       | Server speech scores per learner per day.                                                     |
| `WHISPER_MODEL`                            | `small.en` (default), or `base.en` on a small server. Larger models are slower on CPU.        |
| `PRONUNCIATION`                            | `on` (default) scores each sound of each word; `off` saves about 1.5 GB of memory.            |
| `SPEECH_THREADS`                           | CPU threads for speech scoring. Set it to the number of cores you can spare.                  |
| `BROWSER_MODEL`                            | `on` (default) exports a 330 MB model that browsers run for the on-device check. See below.   |

Without `SMTP_URL`, sign-in links are printed in the API log, which is handy for a first test:

```sh
docker compose logs -f api
```

### Speech on a GPU

With an NVIDIA GPU and the NVIDIA Container Toolkit, add the GPU file. It also switches Whisper to
the more accurate `large-v3-turbo` model.

```sh
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
```

### Models

The speech service downloads its models into the `models` volume on first start, which takes a few
minutes; `docker compose logs -f speech` says `models ready` when it is done. To put the models in
the image instead (for a server without internet access later), build with
`docker compose build --build-arg PRELOAD_MODELS=1 speech`.

### Pronunciation on the learner's device

Learners who are not signed in, or whose daily server scores are used up, can check Read Aloud and
Repeat Sentence pronunciation in their own browser; the recording never leaves the device. With
`BROWSER_MODEL=on`, the speech service exports a small copy of the phoneme model once, in the
background, after the first start (this needs about 4 GB of free memory for a few minutes), and the
web app serves it at `/phonemes/`. Learners download it once, on their first check. If the export
was cut short, the speech log says so; delete the marker it names to try again.

## First steps after install

1. Sign in with an email listed in `ADMIN_EMAILS`. You are a platform admin.
2. Under **More > Institutes and classes**, open your institute (single-institute mode) or start
   one. Add classes, then share each class code or link with students, or import a CSV of emails.
3. Under the institute, **Branding** sets your colour and logo. The trademark notice and the
   practice-estimate notice always stay.
4. To let teachers write questions, make them teachers under **More > Question bank admin >
   People and roles**. A question is published after two other people approve it.

## Backups

```sh
./scripts/backup.sh
```

This writes the database and the saved recordings to `backups/` and keeps the newest 14 of each.
Copy that folder off the server regularly, for example with a nightly cron job:

```sh
0 2 * * * cd /home/you/openpte && ./scripts/backup.sh && rclone copy backups remote:openpte-backups
```

To restore onto a fresh install (same `.env`):

```sh
docker compose up -d db
gunzip -c backups/db-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U openpte openpte
docker compose up -d
docker compose exec -T api tar -C /data -xzf - < backups/recordings-YYYYMMDD-HHMMSS.tar.gz
```

Recordings are deleted 30 days after they are saved, so older recording backups only matter for
that window.

## Updating

```sh
git pull
docker compose up -d --build
```

Database changes are applied automatically when the API starts. Take a backup first.

## Privacy notes

- Practice history stays in the learner's browser unless they sign in.
- Speaking recordings are uploaded only when a learner ticks the consent box, and are deleted after
  30 days or when the learner deletes them.
- Teachers see a student's answer counts and marks by skill. They see an answer or recording only
  when the student sends it to them for marking.
- openpte loads no third-party scripts, fonts or trackers. Institute logos are served by your API.

## Troubleshooting

| Symptom                                      | Check                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Run ./scripts/selfhost-init.sh first` error | `.env` is missing or has no `BETTER_AUTH_SECRET`.                                    |
| Sign-in link opens but you are not signed in | `PUBLIC_WEB_URL` must match the address in the browser exactly, including `https`.   |
| No sign-in email arrives                     | `docker compose logs api` shows the link and any SMTP error.                         |
| Speaking scores fail                         | `docker compose logs speech`. The first start downloads the models; give it minutes. |
| No "Sounds to practise" after a score        | `PRONUNCIATION` is `off`, or the phoneme model failed to load: see the speech log.   |
| The app shows no accounts                    | `PUBLIC_API_URL` was empty or wrong when the web app was built. Fix it and rebuild.  |
