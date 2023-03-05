const express = require('express');
const app= express();
const bodyParser= require('body-parser');
const dotenv= require('dotenv')
app.use(bodyParser.urlencoded({extended:true}))

dotenv.config({ path: '.env' })
require('./models')
app.use(express.json())

// import routes
const screenrouter= require('./routers/screenrouter')
const userrouter= require('./routers/userrouter')
const showsrouter= require('./routers/showsrouter')
const seatrouter= require('./routers/seatrouter')
const bookingrouter= require('./routers/bookingrouter')


app.use('/api/v1',screenrouter)
app.use('/api/v1',userrouter)
app.use('/api/v1',showsrouter)
app.use('/api/v1',seatrouter)
app.use('/api/v1',bookingrouter)

app.listen(3000,()=>{
  console.log("post 3000");
})
