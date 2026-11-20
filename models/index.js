const sequelize = require('./database');
const Show = require('./shows');
const Screen = require('./screens');
const Seat = require('./seat');
const Booking = require('./booking');
const User = require('./user');

Screen.hasMany(Seat, { foreignKey: 'screenId' });
Seat.belongsTo(Screen, { foreignKey: 'screenId' });

Screen.hasMany(Show, { foreignKey: 'screenId' });
Show.belongsTo(Screen, { foreignKey: 'screenId' });

User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

Show.hasMany(Booking, { foreignKey: 'showId' });
Booking.belongsTo(Show, { foreignKey: 'showId' });

Seat.hasMany(Booking, { foreignKey: 'seatId' });
Booking.belongsTo(Seat, { foreignKey: 'seatId' });

async function initializeDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Database connected successfully');
}

module.exports = {
  sequelize,
  Show,
  Screen,
  Seat,
  Booking,
  User,
  initializeDatabase
};