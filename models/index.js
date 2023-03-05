const sequelize = require('./database');
const Show = require('./shows');
const Screen = require('./screens');
const Seat = require('./seat');
const Booking = require('./booking');
const User = require('./user');

// Define associations between models here
// ...

// Synchronize the database with the models

sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database and tables created!');
  })
  .catch((err) => {
    console.error('Error synchronizing the database:', err);
  });


module.exports = {
  Show,
  Screen,
  Seat,
  Booking,
  User
};
