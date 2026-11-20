const express = require('express');
const router = express.Router();
const { checkseats } = require('../controllers/seatcontroller');

router.get('/seat/available/:showId', checkseats);
router.get('/shows/:showId/seats', checkseats);

module.exports = router;
