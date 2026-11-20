# Movie Ticket Booking Backend

A Node.js, Express and Sequelize API for movie-ticket booking, with SQLite for local development and PostgreSQL 16 for production-style integration and concurrency testing.

## Database setup

### Local SQLite (default)
Copy `.env.example` to `.env`. The default SQLite database is created automatically.

```bash
npm ci
npm test
npm start
```

### PostgreSQL 16
Start the included PostgreSQL 16 service with `docker compose up -d postgres` (or install PostgreSQL 16 locally), then set:

```env
DB_DIALECT=postgres
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=ticketbooking
DB_USER=postgres
DB_PASSWORD=postgres # docker-compose default; change for local installations
```

Install PostgreSQL 16 and ensure the server is running before executing:

```bash
npm ci
npm run test:postgres
npm start
```

The PostgreSQL concurrency test is `test/postgres.concurrency.test.js` and can be run alone with `npm run test:postgres:concurrency`. It verifies concurrent booking contention and FIFO waitlist promotion against PostgreSQL row locks.

## Waitlist API

- `POST /api/v1/shows/:showId/waitlist` with JSON `{ "userId": 123 }` — join a sold-out show's FIFO waitlist.
- `GET /api/v1/shows/:showId/waitlist` — list waitlist entries (optional `?userId=123` filter).
- `DELETE /api/v1/waitlist/:waitlistId` with JSON `{ "userId": 123 }` — leave an active waitlist.

When a confirmed booking is cancelled, the service promotes the oldest eligible waitlist entry and creates the replacement booking inside the same database transaction. The released seat is not exposed between cancellation and promotion.


## Authenticated checkout workflow

New accounts can use the credential-backed authentication endpoints. Passwords are derived with Node.js scrypt and access tokens are signed with HMAC-SHA256. Set `AUTH_TOKEN_SECRET` to a random value of at least 32 characters in production.

- `POST /api/v1/auth/register` — JSON `{ "name": "A User", "email": "a@example.com", "password": "at-least-12-characters" }`.
- `POST /api/v1/auth/login` — JSON `{ "email": "a@example.com", "password": "..." }`; returns a Bearer token.
- `POST /api/v1/shows/:showId/holds` — Bearer token + JSON `{ "seatId": 123 }`; creates a short-lived hold (default 5 minutes, configurable from 1 to 15 with `SEAT_HOLD_MINUTES`).
- `GET /api/v1/holds/:holdId` and `DELETE /api/v1/holds/:holdId` — inspect or release the caller's hold.
- `POST /api/v1/payment-intents` — Bearer token + JSON `{ "holdId": 123 }`; optional `Idempotency-Key` header.
- `POST /api/v1/payment-intents/:paymentId/confirm` — runs the local payment simulator and atomically creates a booking on success.
- `POST /api/v1/payment-intents/:paymentId/refund` — refunds a successful simulated payment, cancels its booking and invokes FIFO waitlist promotion in one transaction.

The payment adapter is deliberately a development simulator, not a real payment gateway. It never accepts card data. Set `PAYMENT_SIMULATOR_OUTCOME=decline` to exercise the failure path. A successful confirmation is idempotent; repeating it returns the existing booking. A failed payment releases the hold. Expiration is checked synchronously on hold/payment operations and a background worker periodically marks stale holds expired.

## Production workflow schema and migration

Sequelize creates the application tables for a fresh database. After initialization on PostgreSQL, apply the optional query-index migration with:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001-production-workflows.sql
```

The migration adds targeted indexes for hold expiry, FIFO waitlist retrieval, payment history and confirmed-seat lookups. Back up existing databases before applying schema changes. The project uses a modular monolith; the background expiration worker runs in-process and can be moved to a dedicated worker deployment when multiple application replicas are introduced.

## Environment variables

- `AUTH_TOKEN_SECRET`: production signing secret (32+ characters).
- `SEAT_HOLD_MINUTES`: temporary hold duration (1–15 minutes; default 5).
- `PAYMENT_SIMULATOR_OUTCOME`: `success` or `decline` for local testing.
- `DB_LOGGING`: set to `false` to suppress SQL logs in development.
