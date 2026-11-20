const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '1mb' }));

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

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    status = 400;
    message = err.errors ? err.errors.map((item) => item.message).join(', ') : message;
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    status = 400;
    message = 'A referenced record does not exist or is still in use';
  }

  if (status >= 500) {
    console.error(err);
    message = process.env.NODE_ENV === 'production' ? 'Internal server error' : message;
  }

  res.status(status).json({ message });
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
