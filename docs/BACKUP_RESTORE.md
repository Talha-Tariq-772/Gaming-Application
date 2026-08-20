# Database Backup & Restore

Nightly backups run automatically via [`.github/workflows/backup.yml`](../.github/workflows/backup.yml)
(GitHub Actions, scheduled + manually triggerable) and are produced by
[`scripts/backup-db.sh`](../scripts/backup-db.sh). Each run uploads a
gzip-compressed `.sql.gz` dump as a workflow artifact, kept for 14 days.

This is a free-tier-appropriate setup — no Cloudflare/S3 dependency required.
See the note inside `backup.yml` for when to outgrow it.

## Downloading a backup

1. Go to the repo's **Actions** tab on GitHub.
2. Click **Nightly Database Backup** in the left sidebar.
3. Click the run you want (most recent is at the top; runs are dated).
4. Scroll to the **Artifacts** section at the bottom of the run summary page.
5. Click the artifact (named `db-backup-<run id>`) to download it as a zip.
6. Unzip it — inside is a single file like `backup-20260821-220000.sql.gz`
   (the timestamp is UTC).

Artifacts older than 14 days are pruned automatically by GitHub — download
anything you need before then.

## Restoring a backup

### ⚠️ Read this before running anything

**Restoring overwrites data in whatever database you point it at.** If you
restore into the *same live Supabase project* the backup came from, you will
overwrite all current data with the backup's (older) snapshot — including
any orders, users, or credentials created since that backup ran.

- **Testing a restore, verifying a backup is good, or poking around an old
  snapshot?** Always restore into a **fresh, separate Supabase project** —
  never the live one.
- **Only restore into the live project if this is a genuine disaster
  recovery situation** (e.g. the live database is lost, corrupted, or you've
  been explicitly told to roll back), and you understand you are discarding
  everything written since the backup was taken.

### Steps

1. Unzip the downloaded artifact to get `backup-<timestamp>.sql.gz`.

2. Decompress it:

   ```bash
   gunzip backup-<timestamp>.sql.gz
   # -> backup-<timestamp>.sql
   ```

3. Get a connection string for the **target** database:
   - For a fresh test project: Supabase dashboard → Project Settings →
     Database → Connection string (URI format).
   - For the live project (disaster recovery only): the same, but for the
     actual production project — double-check you have the right one
     before proceeding.

4. Restore with `psql` (works for a plain-SQL dump, which is what
   `pg_dump`'s default format produces):

   ```bash
   psql "postgres://<user>:<password>@<host>:<port>/<database>" \
     -f backup-<timestamp>.sql
   ```

   If you don't have `psql` installed locally:
   - macOS: `brew install postgresql`
   - Ubuntu/Debian: `sudo apt-get install postgresql-client`
   - Or run it via Docker: `docker run --rm -v "$PWD":/backup postgres:16 \
     psql "<connection-string>" -f /backup/backup-<timestamp>.sql`

5. Verify the restore: spot-check a few tables (`select count(*) from
   games;`, `select count(*) from orders;`, etc.) against what you expect
   before treating the target database as trustworthy.

### Notes

- The dump is a plain SQL script (`pg_dump`'s default format), so `psql`
  is what you want — not `pg_restore` (that's for the custom/directory
  archive formats, which this setup doesn't produce). The task's mention
  of `pg_restore` is why it's referenced above for completeness, but for
  this project's `.sql.gz` output, `psql -f` is the correct tool.
- A restore replays every statement in the dump (schema + data). If the
  target database already has conflicting objects (e.g. you're restoring
  into a project that already ran migrations), expect errors on `CREATE
  TABLE`/etc. for anything that already exists — restoring into a truly
  empty fresh project avoids this.
