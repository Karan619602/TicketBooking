const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { CreateBooking, GetAllBookings, CancelSeatBooking } = require('../controllers/bookingcontroller');

// Authenticated API: user identity is derived from the verified token.
router.post('/bookings', authenticate, CreateBooking);
router.get('/bookings', authenticate, GetAllBookings);
router.post('/bookings/:bookingId/cancel', authenticate, CancelSeatBooking);

// Legacy compatibility routes. Keep disabled at the edge before public deployment.
router.post('/booking/create/:userId/:showId/:seatId', CreateBooking);
router.post('/booking/cancel/:BookingId', CancelSeatBooking);

module.exports = router;
