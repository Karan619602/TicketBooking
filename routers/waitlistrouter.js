const express = require('express');
const router = express.Router();
const { JoinWaitlist, GetWaitlist, LeaveWaitlist } = require('../controllers/waitlistcontroller');
router.post('/shows/:showId/waitlist', JoinWaitlist);
router.get('/shows/:showId/waitlist', GetWaitlist);
router.delete('/waitlist/:waitlistId', LeaveWaitlist);
module.exports = router;
