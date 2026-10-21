#!/bin/sh
# Backs up the database and saved recordings into ./backups (keep copies off the server too).
#   ./scripts/backup.sh            # make a backup
# Restore: see docs/SELF_HOST.md, "Backups".
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U openpte --clean --if-exists openpte | gzip > "backups/db-$stamp.sql.gz"
docker compose exec -T api tar -C /data -czf - . > "backups/recordings-$stamp.tar.gz"
# Keep the newest 14 of each.
for kind in db recordings; do
  ls -1t backups/$kind-* 2>/dev/null | tail -n +15 | xargs -r rm --
done
echo "Saved backups/db-$stamp.sql.gz and backups/recordings-$stamp.tar.gz"
