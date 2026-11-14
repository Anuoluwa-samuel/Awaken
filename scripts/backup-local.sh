#!/bin/sh
# Runs ON THE VM (not in CI, which can't reach a private database). Dumps the awaken-db
# container, encrypts the copy, and keeps the last $KEEP_DAYS days. See docs/BACKUPS.md.
#   DATABASE_URL     the database to back up (the same value the app uses is fine)
#   BACKUP_PASSPHRASE   encrypts the dump; without it the copies can't be opened, by anyone
#   BACKUP_DIR        where dated .dump.gpg files are kept (default /var/backups/awaken)
#   KEEP_DAYS         how many days of backups to keep (default 14)
set -eu

: "${DATABASE_URL:?DATABASE_URL is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is not set}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/awaken}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP="$BACKUP_DIR/awaken-$STAMP.dump"
ENCRYPTED="$DUMP.gpg"

pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --file="$DUMP"

printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
  --symmetric --cipher-algo AES256 --output "$ENCRYPTED" "$DUMP"
rm -f "$DUMP"

SIZE=$(wc -c < "$ENCRYPTED" | tr -d ' ')
if [ "$SIZE" -lt 1024 ]; then
  echo "FAILED: $ENCRYPTED is only $SIZE bytes — refusing to call this a backup." >&2
  rm -f "$ENCRYPTED"
  exit 1
fi
echo "Backed up: $ENCRYPTED ($SIZE bytes)."

# Prune anything older than KEEP_DAYS. -mtime +N means "more than N days old".
find "$BACKUP_DIR" -name 'awaken-*.dump.gpg' -mtime "+$KEEP_DAYS" -print -delete
