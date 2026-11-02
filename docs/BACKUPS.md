# Database backups

Three independent layers, so no single mistake or outage loses player data:

| Layer | What it protects against | How far back |
|---|---|---|
| **Neon instant restore** (built in) | A bad change you notice quickly | 1–30 days, depending on your Neon plan |
| **Backup database** (a separate Neon project) | Losing or corrupting the main database | Last night |
| **Encrypted copies** (GitHub Actions artifacts) | A mistake you notice late, or losing Neon access | 30 days |

Every night at 02:30 UTC, `.github/workflows/backup.yml` runs `scripts/backup-database.sh`. It **only reads**
production, encrypts a copy, refreshes the backup database and checks the result. If it fails, GitHub emails you.

**It can't overwrite the real database:** it refuses to run if the two settings point at the same database,
if the source is marked as a backup copy (settings swapped), or if the target has tables but isn't marked as a
backup copy. A failed restore rolls back and keeps the last good copy.

## Setup (about 10 minutes)

### 1. Create the backup database

In Vercel → **Storage** → **Create Database** → **Neon**, create a new database named `awaken-backup`, ideally
in a different region from the main one. **Don't connect it to the AWAKEN project**, or Vercel may add
variables that clash with the real database. Copy its direct URL (`DATABASE_URL_UNPOOLED`).

### 2. Create a passphrase

```bash
openssl rand -base64 32 | tr -d '\n' | pbcopy
```

Save it in your password manager **first**. Without it, the encrypted copies can't be opened, by anyone.

### 3. Add three secrets

In GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `BACKUP_SOURCE_DATABASE_URL` | The **main** database's direct URL (host without `-pooler`) |
| `BACKUP_TARGET_DATABASE_URL` | The **backup** database's direct URL |
| `BACKUP_PASSPHRASE` | The passphrase from step 2 |

Check which is which before saving. If they're swapped, the job refuses to run.

### 4. Run it once

GitHub → **Actions → Backup database → Run workflow**. A green tick means the backup was made and verified.
In the log, source and backup row counts should match.

### Optional: read-only access

The source URL normally has full access. For extra safety, make a role that can only read: in the Neon
console for the main database, add a role named `backup_reader`, run `GRANT pg_read_all_data TO backup_reader;`
in its SQL editor, and use that role's URL as `BACKUP_SOURCE_DATABASE_URL`.

## Restoring

Restoring changes production, so only the owner does it, deliberately. **Try the least drastic option first.**

**A. A recent mistake:** in the Neon console, use **Instant restore** to create a branch from a moment before the
problem, check the data there, then restore. This is the simplest and most precise option.

**B. Main database lost:** the backup database is a complete working copy. Point the app's `DATABASE_URL`
at it in Vercel and redeploy. You lose anything since last night's backup.

**C. An older copy:** download the artifact from **Actions → Backup database → (a run) → Artifacts**, unzip it, then:

```bash
gpg --decrypt --output awaken-backup.dump awaken-backup.dump.gpg
```

Restore it into a **new, empty** database first and check it there:

```bash
pg_restore --dbname="<URL of the new, empty database>" --no-owner --no-privileges --single-transaction awaken-backup.dump
```

Then point the app at that database. Delete the decrypted file when you're done, since it holds player data.

## Keeping it working

- **Practise a restore** every few months. A backup you've never restored is only a hope.
- **Check it now and then.** GitHub emails you when a run fails, but look at the Actions tab occasionally. If the
  repository ever becomes public, GitHub pauses scheduled jobs after 60 days without activity.
- **Rotate the secrets** if a database password changes, or the job will fail (and email you).
- **Version:** the job uses Postgres 17 tools. If Neon's server moves to a newer major version, update the
  version in `backup.yml`.
- **Deleted accounts** leave the backup database the next night and the encrypted copies within 30 days, as the
  Privacy Policy says.
