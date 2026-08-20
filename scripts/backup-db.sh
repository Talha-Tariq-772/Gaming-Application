#!/usr/bin/env bash
#
# Dumps the database at $DATABASE_URL and writes a gzip-compressed,
# timestamped .sql.gz file into backups/ — the dump is streamed straight
# into gzip so an uncompressed .sql file is never written to disk.
#
# Requires: pg_dump (postgresql-client), gzip.
# Requires: DATABASE_URL env var (a standard postgres:// connection string).

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "backup-db.sh: DATABASE_URL is not set" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "backup-db.sh: pg_dump not found on PATH (install postgresql-client)" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
out_dir="${BACKUP_OUTPUT_DIR:-$script_dir/../backups}"
mkdir -p "$out_dir"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
out_file="$out_dir/backup-${timestamp}.sql.gz"
tmp_file="${out_file}.tmp"
trap 'rm -f "$tmp_file"' EXIT

echo "backup-db.sh: dumping database to $out_file" >&2
pg_dump "$DATABASE_URL" | gzip > "$tmp_file"
mv "$tmp_file" "$out_file"

echo "backup-db.sh: done ($(du -h "$out_file" | cut -f1))" >&2
echo "$out_file"
