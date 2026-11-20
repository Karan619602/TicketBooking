-- Run this once against an existing TicketBooking database before deploying
-- the updated API. Take a backup first. Do not run it on a fresh database;
-- Sequelize creates the current schema when the tables do not exist.

ALTER TABLE seats
  ADD COLUMN category ENUM('standard', 'premium', 'recliner') NOT NULL DEFAULT 'standard',
  ADD COLUMN price DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE Bookings
  ADD COLUMN status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  ADD COLUMN bookingReference CHAR(36) NULL,
  ADD COLUMN idempotencyKey VARCHAR(180) NULL,
  ADD COLUMN requestFingerprint CHAR(64) NULL,
  ADD COLUMN totalAmount DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE Bookings
SET bookingReference = UUID()
WHERE bookingReference IS NULL;

ALTER TABLE Bookings
  MODIFY COLUMN bookingReference CHAR(36) NOT NULL;

CREATE UNIQUE INDEX uq_seats_screen_number
  ON seats (screenId, number);

CREATE UNIQUE INDEX uq_bookings_reference
  ON Bookings (bookingReference);

CREATE UNIQUE INDEX uq_bookings_idempotency_key
  ON Bookings (idempotencyKey);

CREATE INDEX idx_bookings_show_seat_status
  ON Bookings (showId, seatId, status);

CREATE INDEX idx_bookings_user_created
  ON Bookings (userId, createdAt);

CREATE INDEX idx_shows_screen_start
  ON Shows (screenId, startTime);
