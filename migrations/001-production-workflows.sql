-- PostgreSQL 16 production workflow indexes.
-- Run after the Sequelize models have created credentials, seat_holds and payment_intents.
CREATE INDEX IF NOT EXISTS idx_seat_holds_expiration
  ON "seat_holds" ("expiresAt") WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_seat_holds_show_status_expiry
  ON "seat_holds" ("showId", status, "expiresAt");
CREATE INDEX IF NOT EXISTS idx_payment_intents_user_status
  ON "payment_intents" ("userId", status, "createdAt");
CREATE INDEX IF NOT EXISTS idx_waitlist_fifo
  ON "waitlist" ("showId", "createdAt", id) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed_seat
  ON "Bookings" ("showId", "seatId") WHERE status = 'confirmed';
