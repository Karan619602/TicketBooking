const {Seat,Show,Screen} = require('../models/index')


// check all available show for particular show 

const checkseats= (async (req,res)=>{
    const {showId}= req.params
    const screen= await Show.findByPk(showId);
    const availableseats = await Seat.findAll({
        where:{
            screenId:screen.screenId,
            available:true
        }
    })
    res.status(200).json({
        availableseats
    })
})

module.exports= {checkseats}


