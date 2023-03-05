const express=require('express')

const router= express.Router()

const {CreateBooking,GetAllBookings,CancelSeatBooking} = require('../controllers/bookingcontroller')

router.post('/booking/create/:userId/:showId/:seatId',CreateBooking)
router.get('/bookings/',GetAllBookings)
router.post('/booking/cancel/:BookingId',CancelSeatBooking)

module.exports= router