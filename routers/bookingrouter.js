const express = require('express');
const router = express.Router();
const { CreateBooking, GetAllBookings, CancelSeatBooking } = require('../controllers/bookingcontroller');

router.post('/bookings', CreateBooking);
router.get('/bookings', GetAllBookings);
router.post('/bookings/:bookingId/cancel', CancelSeatBooking);

// Keep the original routes working for existing clients.
router.post('/booking/create/:userId/:showId/:seatId', CreateBooking);
router.post('/booking/cancel/:BookingId', CancelSeatBooking);

module.exports = router;
