const express=require('express')

const router= express.Router()

const {checkseats} = require('../controllers/seatcontroller')

router.get('/seat/available/:showId',checkseats)
module.exports= router