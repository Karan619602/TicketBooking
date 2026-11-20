const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { CreatePaymentIntent, ConfirmPayment, RefundPayment } = require('../controllers/paymentcontroller');
router.post('/payment-intents', authenticate, CreatePaymentIntent);
router.post('/payment-intents/:paymentId/confirm', authenticate, ConfirmPayment);
router.post('/payment-intents/:paymentId/refund', authenticate, RefundPayment);
module.exports = router;
