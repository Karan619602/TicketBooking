const {Screen} = require('../models/index')

const CreateScreen= (async (req,res)=>{
    const {name,capacity}= req.body;
    console.log(capacity);
    const obj={
      name:name,
      capacity:capacity
    }
    const screen = await Screen.create(obj);
   
    res.status(200).json({
        message: 'Screen Created successfully',
        screen
      });
  })


  const GetScreens= (async (req,res)=>{
    const screens=await Screen.findAll();
    res.status(200).json({
        screens
      });
  })
  


  module.exports={CreateScreen, GetScreens}