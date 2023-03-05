const express=require('express')

const router= express.Router()

const {CreateUser} = require('../controllers/usercontroller')

router.post('/user/create',CreateUser)
module.exports= router