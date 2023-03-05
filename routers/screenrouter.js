const express=require('express')

const router= express.Router()

const {CreateScreen,GetScreens} = require('../controllers/screencontroller')

router.post('/screen/create',CreateScreen)
router.get('/screen/get',GetScreens)
module.exports= router