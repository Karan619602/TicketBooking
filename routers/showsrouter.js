const express = require('express');
const router = express.Router();
const { CreateShow, GetAllShows, GetShowById } = require('../controllers/showcontroller');

router.post('/show/create/:screenId', CreateShow);
router.get('/shows', GetAllShows);
router.get('/shows/:showId', GetShowById);

// Original routes retained for backwards compatibility.
router.get('/screen/get', GetAllShows);
router.get('/screen/get/:id', GetShowById);

module.exports = router;
