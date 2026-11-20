const sequelize = require('./database');
const User = require('./user');
const Screen = require('./screens');
const Show = require('./shows');
const Seat = require('./seat');
const Booking = require('./booking');

Screen.hasMany(Seat, { foreignKey: 'screenId', onDelete: 'CASCADE' });
Seat.belongsTo(Screen, { foreignKey: 'screenId' });

Screen.hasMany(Show, { foreignKey: 'screenId', onDelete: 'CASCADE' });
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
  User,
  Screen,
  Show,
  Seat,
  Booking,
  initializeDatabase
};
