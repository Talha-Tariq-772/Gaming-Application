#!/usr/bin/env bash
#
# Dumps the database at $DATABASE_URL and writes a gzip-compressed,
# timestamped .sql.gz file into backups/ — the dump is streamed straight
# into gzip so an uncompressed .sql file is never written to disk.
#
# Requires: pg_dump (postgresql-client), gzip.
# Requires: DATABASE_URL env var (a standard postgres:// connection string).
# Optional: PG_DUMP_BIN — path/name of the pg_dump binary to use (defaults
# to whatever "pg_dump" resolves to on PATH). Set this to an exact
# versioned path (e.g. /usr/lib/postgresql/17/bin/pg_dump) when the
# server's major version doesn't match whatever pg_dump a generic
# package install puts on PATH — a client older than the server can
# fail outright, so pin it explicitly rather than trust PATH ordering.

set -euo pipefail

pg_dump_bin="${PG_DUMP_BIN:-pg_dump}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "backup-db.sh: DATABASE_URL is not set" >&2
  exit 1
fi

if ! command -v "$pg_dump_bin" >/dev/null 2>&1; then
  echo "backup-db.sh: $pg_dump_bin not found on PATH (install postgresql-client, or set PG_DUMP_BIN)" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
out_dir="${BACKUP_OUTPUT_DIR:-$script_dir/../backups}"
mkdir -p "$out_dir"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
out_file="$out_dir/backup-${timestamp}.sql.gz"
tmp_file="${out_file}.tmp"
trap 'rm -f "$tmp_file"' EXIT

echo "backup-db.sh: using $(command -v "$pg_dump_bin") ($("$pg_dump_bin" --version))" >&2
echo "backup-db.sh: dumping database to $out_file" >&2
"$pg_dump_bin" "$DATABASE_URL" | gzip > "$tmp_file"
mv "$tmp_file" "$out_file"

echo "backup-db.sh: done ($(du -h "$out_file" | cut -f1))" >&2
echo "$out_file"
