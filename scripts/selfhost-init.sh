#!/bin/sh
# Writes .env from .env.example with fresh random secrets. Safe to re-run: it never overwrites.
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env already exists; leaving it alone."
  exit 0
fi
secret() { openssl rand -base64 48 | tr -d '/+=\n' | cut -c1-48; }
sed \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(secret)|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(secret)|" \
  -e "s|^SPEECH_TOKEN=.*|SPEECH_TOKEN=$(secret)|" \
  .env.example > .env
chmod 600 .env
echo "Wrote .env with new secrets. Add your email to ADMIN_EMAILS, then: docker compose up -d --build"
