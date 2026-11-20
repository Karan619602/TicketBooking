const HttpError = require('../utils/httpError');
const paymentService = require('../services/paymentservice');

async function CreatePaymentIntent(req, res, next) {
  try {
    const holdId = Number(req.body.holdId);
    if (!Number.isInteger(holdId) || holdId < 1) throw new HttpError(400, 'Valid holdId is required');
    const key = req.get('Idempotency-Key');
    if (key && (key.length > 128 || !/^[\\w.:\\-]+$/.test(key))) throw new HttpError(400, 'Invalid Idempotency-Key');
    const result = await paymentService.createIntent({ userId: req.auth.userId, holdId, idempotencyKey: key ? req.auth.userId + ':' + key : null });
    res.status(result.created ? 201 : 200).json({ message: 'Payment intent ready', ...result });
  } catch (error) { next(error); }
}
async function ConfirmPayment(req, res, next) {
  try {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId < 1) throw new HttpError(400, 'Valid paymentId is required');
    const result = await paymentService.confirmPayment({ userId: req.auth.userId, paymentId });
    res.status(result.payment.status === 'succeeded' ? (result.replayed ? 200 : 201) : 402).json({
      message: result.payment.status === 'succeeded' ? 'Payment successful and booking confirmed' : result.payment.failureReason || 'Payment failed',
      payment: result.payment, booking: result.booking, replayed: result.replayed
    });
  } catch (error) { next(error); }
}
async function RefundPayment(req, res, next) {
  try {
    const paymentId = Number(req.params.paymentId);
    if (!Number.isInteger(paymentId) || paymentId < 1) throw new HttpError(400, 'Valid paymentId is required');
    const result = await paymentService.refundPayment({ userId: req.auth.userId, paymentId });
    res.status(200).json({ message: 'Payment refunded and booking cancelled', ...result });
  } catch (error) { next(error); }
}
module.exports = { CreatePaymentIntent, ConfirmPayment, RefundPayment };
