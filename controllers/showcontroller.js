const {Show} = require('../models/index')

const CreateShow= (async (req,res)=>{
    const {name,startTime,endTime}= req.body;
    const {screenId} =req.params;
    const obj={
      name:name,
      startTime:startTime,
      endTime:endTime,
      screenId:screenId,
    }
    const show = await Show.create(obj);
   
    res.status(200).json({
        message: 'Show Created successfully',
        show
      });
  })


  const GetAllShows= (async (req,res)=>{
    const show=await Show.findAll();
    res.status(200).json({
        show
      });
  })

  // particular show
  const GetShowById= (async (req,res)=>{
    const {id}= req.params;
    const show=await Show.findByPk(id);
    res.status(200).json({
        show
      });
  })
  


  module.exports={CreateShow, GetAllShows,GetShowById}