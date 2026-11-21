#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL 16 must already be installed. This script never uses sudo,
# apt, Docker pulls, or network package installation.
if [ "$(id -u)" -eq 0 ]; then
  echo "Run as a normal user; PostgreSQL initdb refuses to run as root." >&2
  exit 1
fi

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
if [ ! -x "$PG_BIN/initdb" ]; then
  PG_BIN="$(dirname "$(command -v initdb 2>/dev/null || true)")"
fi
if [ ! -x "$PG_BIN/initdb" ] || [ ! -x "$PG_BIN/pg_ctl" ]; then
  echo "PostgreSQL server binaries (initdb and pg_ctl) are missing." >&2
  echo "This machine must provide PostgreSQL 16 binaries in PATH or PG_BIN." >&2
  exit 1
fi

PG_DATA="${PG_DATA:-$HOME/.ticketbooking/postgres16}"
PG_PORT="${PG_PORT:-55432}"
PG_PASSWORD="${PG_PASSWORD:-postgres}"
PG_DB="${PG_DB:-ticketbooking}"
mkdir -p "$PG_DATA"
chmod 700 "$PG_DATA"
PG_LOG="$PG_DATA/server.log"
PG_SOCKET_DIR="${PG_SOCKET_DIR:-$PG_DATA}"

if [ ! -f "$PG_DATA/PG_VERSION" ]; then
  PASSFILE="$(mktemp)"
  trap 'rm -f "$PASSFILE"' EXIT
  chmod 600 "$PASSFILE"
  printf '%s\n' "$PG_PASSWORD" > "$PASSFILE"
  "$PG_BIN/initdb" -D "$PG_DATA" -U postgres --auth-host=scram-sha-256 --auth-local=trust --pwfile="$PASSFILE"
  rm -f "$PASSFILE"
  trap - EXIT
fi

if [ "$(cat "$PG_DATA/PG_VERSION")" != "16" ]; then
  echo "Existing cluster is not PostgreSQL 16: $PG_DATA" >&2
  exit 1
fi

if ! "$PG_BIN/pg_ctl" -D "$PG_DATA" status >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$PG_DATA" -l "$PG_LOG" -o "-h 127.0.0.1 -p $PG_PORT -k $PG_SOCKET_DIR" -w start
fi

export PGPASSWORD="$PG_PASSWORD"
# Verify the TCP endpoint, not merely that a cluster is running.
"$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -Atqc "SHOW server_version" | grep -q "^16" || { echo "PostgreSQL 16 is not reachable at 127.0.0.1:$PG_PORT" >&2; exit 1; }
if ! "$PG_BIN/psql" -h 127.0.0.1 -p "$PG_PORT" -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$PG_DB'" | grep -qx 1; then
  "$PG_BIN/createdb" -h 127.0.0.1 -p "$PG_PORT" -U postgres -O postgres "$PG_DB"
fi

cat <<EOF
PostgreSQL 16 is ready.
Use these environment variables in the same shell before npm test:
export DB_DIALECT=postgres
export DB_HOST=127.0.0.1
export DB_PORT=$PG_PORT
export DB_NAME=$PG_DB
export DB_USER=postgres
export DB_PASSWORD=$PG_PASSWORD
export DB_SSL=false

To stop: $PG_BIN/pg_ctl -D "$PG_DATA" -m fast stop
EOF
