#!/bin/sh
# Dumps the source database to a file and restores it into the backup database. Only ever reads the
# source. See docs/BACKUPS.md.
#   SOURCE_DATABASE_URL  the database to back up (direct connection, not the pooler)
#   BACKUP_DATABASE_URL  the separate backup database
#   OUTPUT               where to write the dump
set -eu

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is not set}"
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set}"
: "${OUTPUT:?OUTPUT is not set}"

MARKER="_awaken_backup_copy"

# host:port/database, ignoring credentials, options and Neon's pooler suffix.
identity() {
  printf '%s' "$1" | sed -E 's#^[a-z]+://([^@]*@)?##; s#\?.*$##; s#-pooler\.#.#'
}
scalar() {
  psql "$1" -v ON_ERROR_STOP=1 -Atc "$2"
}
count_tables() {
  scalar "$1" "select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '$MARKER'"
}
has_marker() {
  [ "$(scalar "$1" "select to_regclass('public.$MARKER') is not null")" = "t" ]
}

# ── Safety: these checks stop the restore ever overwriting the real database ──
if [ "$(identity "$SOURCE_DATABASE_URL")" = "$(identity "$BACKUP_DATABASE_URL")" ]; then
  echo "REFUSED: the source and backup are the same database." >&2
  exit 1
fi
if has_marker "$SOURCE_DATABASE_URL"; then
  echo "REFUSED: the source is marked as a backup copy. Are the two settings swapped?" >&2
  exit 1
fi
if [ "$(count_tables "$BACKUP_DATABASE_URL")" != "0" ] && ! has_marker "$BACKUP_DATABASE_URL"; then
  echo "REFUSED: the backup database has tables but isn't marked as a backup copy, so it might be real data." >&2
  exit 1
fi

# ── Dump, then restore in one transaction: a failed restore leaves the last good copy intact ──
pg_dump "$SOURCE_DATABASE_URL" --format=custom --no-owner --no-privileges --file="$OUTPUT"
pg_restore --dbname="$BACKUP_DATABASE_URL" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error "$OUTPUT"
scalar "$BACKUP_DATABASE_URL" "create table if not exists public.$MARKER (restored_at timestamptz not null); delete from public.$MARKER; insert into public.$MARKER values (now())" >/dev/null

# ── Verify: same tables, and no fewer accounts or XP rows than the dump (live data may have grown) ──
source_tables=$(count_tables "$SOURCE_DATABASE_URL")
backup_tables=$(count_tables "$BACKUP_DATABASE_URL")
if [ "$source_tables" != "$backup_tables" ] || [ "$backup_tables" = "0" ]; then
  echo "FAILED: the source has $source_tables tables but the backup has $backup_tables." >&2
  exit 1
fi
for table in '"user"' xp_ledger player_progress; do
  source_rows=$(scalar "$SOURCE_DATABASE_URL" "select count(*) from $table")
  backup_rows=$(scalar "$BACKUP_DATABASE_URL" "select count(*) from $table")
  echo "$table: source $source_rows, backup $backup_rows"
  # Accounts can be deleted between the dump and this check, so allow a small difference downward too.
  if [ "$source_rows" -gt 0 ] && [ "$backup_rows" -eq 0 ]; then
    echo "FAILED: $table is empty in the backup." >&2
    exit 1
  fi
done

echo "Backup verified: $backup_tables tables, $(wc -c < "$OUTPUT" | tr -d ' ') bytes."
