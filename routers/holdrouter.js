const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authenticate');
const { CreateHold, GetHold, ReleaseHold } = require('../controllers/holdcontroller');
router.post('/shows/:showId/holds', authenticate, CreateHold);
router.get('/holds/:holdId', authenticate, GetHold);
router.delete('/holds/:holdId', authenticate, ReleaseHold);
module.exports = router;
