# Database backups

Self-hosted Postgres has no built-in point-in-time restore, so backups are the only safety net —
set this up before you have real players.

| Layer | What it protects against | How far back |
|---|---|---|
| **Local encrypted dumps** (`scripts/backup-local.sh`, nightly on the VM) | A bad change, a mistake, corruption | Last `KEEP_DAYS` nights (default 14) |
| **Off-box copy** (optional, step 4) | Losing the VM itself — disk failure, account issue, fat-fingered `rm` | As far back as you copy |

`scripts/backup-local.sh` **only reads** the database: it dumps, encrypts, verifies the file isn't
suspiciously small, and prunes old copies. It never writes to `awaken-db`.

## Setup (about 10 minutes)

### 1. Create a passphrase

```bash
openssl rand -base64 32 | tr -d '\n'
```

Save it in your password manager **first**. Without it, the encrypted copies can't be opened, by
anyone — including you.

### 2. Install the tools the script needs, once

The script runs *on the VM itself*, not in a container, so it needs `pg_dump` and `gpg` on the host:

```bash
sudo apt-get update && sudo apt-get install -y postgresql-client gnupg
```

### 3. Schedule it

A systemd timer survives reboots better than crontab and shows up in `systemctl status`. On the VM,
replace `/path/to/awaken` below with the repository's actual path, and `PASSWORD`/`PASSPHRASE`
with the real values (`POSTGRES_PASSWORD` from `.env.production`, and the passphrase from step 1):

```bash
sudo tee /etc/systemd/system/awaken-backup.service >/dev/null <<'EOF'
[Unit]
Description=AWAKEN database backup

[Service]
Type=oneshot
# docker-compose.prod.yml publishes awaken-db to 127.0.0.1 only, for exactly this: from the host's
# own perspective it's "localhost", not the "awaken-db" Docker DNS name the app container uses.
Environment=DATABASE_URL=postgres://awaken:PASSWORD@localhost:5432/awaken
Environment=BACKUP_PASSPHRASE=PASSPHRASE
ExecStart=/path/to/awaken/scripts/backup-local.sh
EOF
sudo chmod 600 /etc/systemd/system/awaken-backup.service

sudo tee /etc/systemd/system/awaken-backup.timer >/dev/null <<'EOF'
[Unit]
Description=Run the AWAKEN backup nightly

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now awaken-backup.timer
```

### 4. Run it once

```bash
sudo systemctl start awaken-backup.service
systemctl status awaken-backup.service
ls -la /var/backups/awaken
```

A file like `awaken-20261114T023000Z.dump.gpg` of a reasonable size (not a few hundred bytes) means
it worked.

### Optional: copy backups off the VM

Losing the VM loses every on-box backup too. Pick one, run after step 3's job (e.g. chained in the
same systemd service, or its own timer a few minutes later):

- **rclone** to an S3-compatible bucket (Backblaze B2's free tier covers this easily):
  `rclone copy /var/backups/awaken remote:awaken-backups`
- **scp** to another machine you control, including another Always Free Oracle VM in a different
  region.

## Restoring

Restoring changes production, so only the owner does it, deliberately. **Try the least drastic
option first.**

**A. The app container, not the data:** `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build awaken-app` rebuilds and restarts just the app. Doesn't touch `awaken-db`.

**B. A bad migration or a mistake you caught fast:** if `awaken-db`'s volume wasn't touched since,
stop the app (`docker compose … stop awaken-app`), restore from the most recent backup (option C)
into a **new, temporary** Postgres container first, check the data there, then swap it in.

**C. Restore an encrypted copy.** On the VM, with `pg_dump`/`psql` already installed (step 2) and
`awaken-db` reachable at `localhost:5432` (the loopback port `docker-compose.prod.yml` publishes):

```bash
gpg --decrypt --output awaken-backup.dump /var/backups/awaken/awaken-<timestamp>.dump.gpg
# Enter BACKUP_PASSPHRASE when prompted.

# A new, empty database on the same server first — never straight into "awaken" itself.
PGPASSWORD=<POSTGRES_PASSWORD> createdb -h localhost -U awaken awaken_restore_check
PGPASSWORD=<POSTGRES_PASSWORD> pg_restore --dbname="postgres://awaken:<POSTGRES_PASSWORD>@localhost:5432/awaken_restore_check" \
  --no-owner --no-privileges --single-transaction awaken-backup.dump
psql -h localhost -U awaken -d awaken_restore_check -c 'select count(*) from "user"'
```

Once you're confident it's good, stop the app
(`docker compose -f docker-compose.prod.yml --env-file .env.production stop awaken-app`) and
restore into the real database the same way, with `--clean --if-exists` added so it replaces what's
there:

```bash
PGPASSWORD=<POSTGRES_PASSWORD> pg_restore --dbname="postgres://awaken:<POSTGRES_PASSWORD>@localhost:5432/awaken" \
  --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error awaken-backup.dump
docker compose -f docker-compose.prod.yml --env-file .env.production start awaken-app
```

Then drop the check database and delete the decrypted file, since both hold player data:

```bash
PGPASSWORD=<POSTGRES_PASSWORD> dropdb -h localhost -U awaken awaken_restore_check
rm -f awaken-backup.dump
```
