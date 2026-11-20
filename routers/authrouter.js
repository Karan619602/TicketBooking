const express = require('express');
const router = express.Router();
const { Register, Login } = require('../controllers/authcontroller');
router.post('/auth/register', Register);
router.post('/auth/login', Login);
module.exports = router;
