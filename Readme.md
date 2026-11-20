# Online Movie Ticket Booking System Backend

A REST API built with Node.js, Express, Sequelize and MySQL.

## Requirements

- Node.js
- MySQL

## Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Karan619602/TicketBooking.git
   cd TicketBooking
   npm install
   ```

2. Create a `.env` file in the project root:

   ```env
   database_name=ticketbooking
   user_name=root
   password=your_mysql_password
   host=localhost
   PORT=3000
   ```

3. Create the database in MySQL and start the server:

   ```bash
   npm start
   ```

The API runs on port 3000 by default. Use `GET /health` to check that it is running.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/user/create` | Create a user |
| POST | `/api/v1/screen/create` | Create a screen |
| GET | `/api/v1/screen/get` | Get all screens |
| POST | `/api/v1/show/create/:screenId` | Create a show |
| GET | `/api/v1/screen/get` | Get all shows (original route) |
| GET | `/api/v1/screen/get/:id` | Get a show by ID (original route) |
| GET | `/api/v1/seat/available/:showId` | Get seats available for a show |
| POST | `/api/v1/booking/create/:userId/:showId/:seatId` | Book a seat |
| GET | `/api/v1/bookings` | Get all bookings |
| POST | `/api/v1/booking/cancel/:BookingId` | Cancel a booking |

## Booking behaviour

A seat belongs to a screen, while a booking belongs to a particular show. Availability is therefore calculated for each show using its existing bookings. A seat booked for one show remains available for another show on the same screen.

Booking and cancellation run inside database transactions. Booking locks the seat row while checking for an existing booking, preventing two concurrent requests from reserving the same seat.

## Notes

The original API routes are retained to avoid breaking existing clients. This version does not yet include user authentication; the `userId` in the booking route is accepted as supplied by the caller and should not be treated as a verified identity in a public deployment.
