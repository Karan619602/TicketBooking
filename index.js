const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const { initializeDatabase } = require('./models');

const screenrouter = require('./routers/screenrouter');
const userrouter = require('./routers/userrouter');
const showsrouter = require('./routers/showsrouter');
const seatrouter = require('./routers/seatrouter');
const bookingrouter = require('./routers/bookingrouter');

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1', screenrouter);
app.use('/api/v1', userrouter);
app.use('/api/v1', showsrouter);
app.use('/api/v1', seatrouter);
app.use('/api/v1', bookingrouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log('Server is running on port ' + PORT);
      });
    })
    .catch((err) => {
      console.error('Could not connect to the database:', err);
      process.exit(1);
    });
}

module.exports = app;