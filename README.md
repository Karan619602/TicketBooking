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
