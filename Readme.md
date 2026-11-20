# Online Movie Ticket Booking API

A REST API for managing users, cinema screens, shows, seats and bookings. It uses Node.js, Express, Sequelize and MySQL.

## Requirements

- Node.js 18 or later
- MySQL 8 or a compatible MySQL server

## Run locally

1. Install packages:

   ```bash
   npm install
   ```

2. Create a MySQL database named `ticketbooking` (or choose another name).

3. Copy `.env.example` to `.env` and set the database credentials.

4. Start the server:

   ```bash
   npm run dev
   ```

The API listens on port 3000 by default. `GET /health` returns the service health.

### Existing database

Back up your database first. If you are upgrading a database created by the original version, run `migrations/001-booking-reliability.sql` once before starting the updated API. The script adds the new booking and seat fields and indexes while retaining the existing booking rows. Do not run it on a fresh database. Check for duplicate seat numbers within a screen before creating the new unique index.

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

The booking service locks the show row inside a MySQL transaction before checking availability and creating the booking. This serializes booking attempts for the same show across multiple API processes. The seat row is also locked while the booking is checked.

The database has indexes for show/seat/status lookups, user booking history and show scheduling. A unique idempotency-key index protects retry handling at the database level.

### Cancellation and history

Cancellation changes the booking status to `cancelled` instead of deleting the row. This preserves booking history and makes the seat available again. A cancelled booking can be replaced with a new booking using a new idempotency key.

### Scheduling and seats

A screen cannot have overlapping shows. Show creation locks the screen row while checking for an overlap and inserting the new show. Seat creation also locks the screen row, checks the current seat count against capacity and creates the seats in the same transaction.

## Tests

Run the test suite:

```bash
npm test
```

The MySQL integration test is opt-in locally. Use a dedicated test database, configure the database variables in `.env`, set `RUN_DB_TESTS=true`, and run `npm test`. The test creates and removes its own records; do not point it at production data.

GitHub Actions starts a MySQL 8 service and runs the integration test on pushes and pull requests. It covers simultaneous booking attempts, idempotent retries, reusing a seat for another show, cancellation and booking the released seat again.

## Current scope

Payment gateway integration is intentionally not included yet. Booking and cancellation are implemented independently so payment can be added later without mixing gateway calls into the seat-allocation transaction.

The current API retains the original userId-based routes and does not yet authenticate callers. A user ID supplied by the request is not proof of identity. Add authentication and authorization before exposing booking management endpoints publicly.
