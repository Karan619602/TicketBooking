# Offline PostgreSQL 16 setup (Linux)

This project uses PostgreSQL. If the machine already has PostgreSQL 16 server binaries but does not allow sudo, package downloads, or Docker image pulls, initialize a database cluster owned by your current non-root user.

```bash
bash scripts/setup-postgres-offline.sh
```

The script creates a local cluster under `$HOME/.ticketbooking/postgres16`, starts it on `127.0.0.1:55432`, and creates database `ticketbooking`. It prints the environment variables to export in the shell running the Node application/tests:

```bash
export DB_DIALECT=postgres
export DB_HOST=127.0.0.1
export DB_PORT=55432
export DB_NAME=ticketbooking
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_SSL=false
npm ci
npm test
```

**Requirements:** PostgreSQL 16 server binaries (`initdb`, `pg_ctl`, `psql`, `createdb`) must already be installed and executable. If they are elsewhere, set `PG_BIN=/path/to/postgresql/16/bin`. This script does not install missing binaries or obtain elevated permissions. Local socket/TCP port access must be permitted. Existing clusters are reused; credentials cannot be reset automatically for an existing cluster.

Optional overrides: `PG_DATA`, `PG_PORT`, `PG_PASSWORD`, `PG_DB`, `PG_BIN`. For existing clusters, use the password chosen when that cluster was initialized.

To stop the database:

```bash
/usr/lib/postgresql/16/bin/pg_ctl -D "$HOME/.ticketbooking/postgres16" -m fast stop
```

This is a fallback for environments without a running PostgreSQL service. The existing `docker-compose.yml` remains an alternative when the PostgreSQL 16 image is already cached and Docker is permitted. No internet access is needed for the user-owned cluster method.
