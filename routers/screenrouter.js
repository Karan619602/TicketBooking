const express = require('express');
const router = express.Router();
const { CreateScreen, GetScreens, CreateSeats } = require('../controllers/screencontroller');

router.post('/screen/create', CreateScreen);
router.get('/screen/get', GetScreens);
router.post('/screens/:screenId/seats', CreateSeats);

module.exports = router;
