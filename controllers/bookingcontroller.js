const { Booking, Show, Seat, User } = require('../models');
const bookingService = require('../services/bookingservice');
const HttpError = require('../utils/httpError');

const CreateBooking = async (req, res, next) => {
  try {
    const userId = req.auth ? req.auth.userId : Number(req.body.userId || req.params.userId);
    const showId = Number(req.body.showId || req.params.showId);
    const seatId = Number(req.body.seatId || req.params.seatId);
    const idempotencyKey = req.get('Idempotency-Key');
    if (![userId, showId, seatId].every((value) => Number.isInteger(value) && value > 0)) throw new HttpError(400, 'Valid userId, showId and seatId are required');
    if (idempotencyKey && (idempotencyKey.length > 128 || !/^[\w.:\-]+$/.test(idempotencyKey))) throw new HttpError(400, 'Idempotency-Key must be at most 128 valid characters');
    const result = await bookingService.createBooking({ userId, showId, seatId, idempotencyKey });
    const booking = result.booking;
    res.status(result.replayed ? 200 : 201).json({
      message: result.replayed ? 'Existing booking returned' : 'Seat booked successfully',
      replayed: result.replayed,
      booking: { id: booking.id, bookingReference: booking.bookingReference, userId: booking.userId,
        showId: booking.showId, seatId: booking.seatId, status: booking.status,
        totalAmount: booking.totalAmount, createdAt: booking.createdAt }
    });
  } catch (error) { next(error); }
};

const GetAllBookings = async (req, res, next) => {
  try {
    const where = {};
    if (req.auth && req.auth.role !== 'admin') where.userId = req.auth.userId;
    if (req.query.status) {
      if (!['confirmed', 'cancelled'].includes(req.query.status)) throw new HttpError(400, 'status must be confirmed or cancelled');
      where.status = req.query.status;
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const result = await Booking.findAndCountAll({
      where,
      include: [
        { model: Show, attributes: ['id', 'name', 'startTime', 'endTime'] },
        { model: Seat, attributes: ['id', 'number', 'category'] },
        { model: User, attributes: ['id', 'name', 'email'] }
      ],
      order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit, distinct: true
    });
    res.status(200).json({ bookings: result.rows, pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) } });
  } catch (error) { next(error); }
};

const CancelSeatBooking = async (req, res, next) => {
  try {
    const bookingId = Number(req.params.bookingId || req.params.BookingId);
    if (!Number.isInteger(bookingId) || bookingId < 1) throw new HttpError(400, 'A valid booking ID is required');
    const result = await bookingService.cancelBooking({ bookingId, userId: req.auth ? req.auth.userId : (req.body.userId || req.query.userId) });
    res.status(200).json({
      message: result.promotion ? 'Booking cancelled and next waitlisted customer promoted' : 'Booking cancelled successfully',
      booking: { id: result.booking.id, bookingReference: result.booking.bookingReference, status: result.booking.status },
      promotion: result.promotion ? { waitlistId: result.promotion.entry.id, bookingId: result.promotion.booking.id, userId: result.promotion.booking.userId } : null
    });
  } catch (error) { next(error); }
};

module.exports = { CreateBooking, GetAllBookings, CancelSeatBooking };
