# Online Movie Ticket Booking API

A REST API for managing users, cinema screens, shows, seats and bookings. It uses Node.js, Express and Sequelize, with SQLite for zero-setup local development and MySQL support for deployments and database-specific concurrency testing.

## Requirements

- Node.js 18 or later
- npm

A local MySQL server is not required for the default setup.

## Run locally

1. Install packages:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env` if you want to customise the defaults.

3. Start the server:

   ```bash
   npm start
   ```

By default, the API uses SQLite and creates `data/ticketbooking.sqlite` automatically. The API listens on port 3000 by default. `GET /health` returns the service health.

### Using MySQL

MySQL remains supported. Set `DB_DIALECT=mysql` and configure `database_name`, `user_name`, `password`, `host` and `DB_PORT` in the environment. Create the database before starting the API.

### Existing database

Back up your database first. If you are upgrading a database created by the original MySQL version, run `migrations/001-booking-reliability.sql` once before starting the updated API. The script adds the new booking and seat fields and indexes while retaining the existing booking rows. Do not run it on a fresh database. Check for duplicate seat numbers within a screen before creating the new unique index.

## API

All endpoints are prefixed with `/api/v1`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/user/create` | Create a user |
| POST | `/screen/create` | Create a screen |
| GET | `/screen/get` | List screens |
| POST | `/screens/:screenId/seats` | Add seats to a screen |
| POST | `/show/create/:screenId` | Schedule a show |
| GET | `/shows` | List shows; accepts `screenId`, `from` and `to` filters |
| GET | `/shows/:showId` | Get show details |
| GET | `/seat/available/:showId` | Get seat availability for a show |
| POST | `/bookings` | Create a booking |
| GET | `/bookings` | List bookings with pagination and optional status |
| POST | `/bookings/:bookingId/cancel` | Cancel a booking |

The original booking and show routes are still available for existing clients.

### Create a booking

Send `POST /api/v1/bookings` with:

```json
{
  "userId": 12,
  "showId": 34,
  "seatId": 56
}
```

Include an `Idempotency-Key` header for safe retries:

```
Idempotency-Key: checkout-7f82d1
```

A repeated request with the same key and same booking details returns the original booking. Reusing that key for different details returns `409 Conflict`.

### Booking concurrency

A booking is tied to a show and a seat. A seat can be booked for different shows, but it can have only one confirmed booking for a given show.

The booking service locks the show row inside a MySQL transaction before checking availability and creating the booking. This serializes booking attempts for the same show across multiple API processes. The seat row is also locked while the booking is checked. SQLite does not provide equivalent row-level `SELECT ... FOR UPDATE` semantics; the SQLite functional suite therefore verifies booking workflows, not concurrent booking safety. Run the MySQL concurrency test to validate that guarantee.

The database has indexes for show/seat/status lookups, user booking history and show scheduling. A unique idempotency-key index protects retry handling at the database level.

### Cancellation and history

Cancellation changes the booking status to `cancelled` instead of deleting the row. This preserves booking history and makes the seat available again. A cancelled booking can be replaced with a new booking using a new idempotency key.

### Scheduling and seats

A screen cannot have overlapping shows. Show creation locks the screen row while checking for an overlap and inserting the new show. Seat creation also locks the screen row, checks the current seat count against capacity and creates the seats in the same transaction.

## Tests

Run the default functional tests using an in-memory SQLite database:

```bash
npm test
```

These tests do not require a local MySQL server and are not skipped.

Run the MySQL-specific concurrency test only against a dedicated test database:

```bash
DB_DIALECT=mysql RUN_DB_TESTS=true npm run test:mysql
```

On Windows Command Prompt:

```cmd
set DB_DIALECT=mysql&& set RUN_DB_TESTS=true&& npm run test:mysql
```

Do not run integration tests against production data. GitHub Actions runs both the SQLite functional test and the MySQL concurrency test using a MySQL 8 service.

## Current scope

Payment gateway integration is intentionally not included yet. Booking and cancellation are implemented independently so payment can be added later without mixing gateway calls into the seat-allocation transaction.

The current API retains the original userId-based routes and does not yet authenticate callers. A user ID supplied by the request is not proof of identity. Add authentication and authorization before exposing booking management endpoints publicly.
