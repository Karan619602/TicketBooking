const {User} = require('../models/index')

const CreateUser= (async (req,res)=>{
    const {name,email}= req.body;
    const obj={
      name:name,
      email:email
    }
    const user = await User.create(obj);
   
    res.status(200).json({
        message: 'User Created successfully',
        user
      });
  })


  

  module.exports={CreateUser}