const sequelize = require('./database');
const User = require('./user');
const Screen = require('./screens');
const Show = require('./shows');
const Seat = require('./seat');
const Booking = require('./booking');
const Waitlist = require('./waitlist');
const Credential = require('./credential');
const SeatHold = require('./seathold');
const Payment = require('./payment');

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

User.hasMany(Waitlist, { foreignKey: 'userId' });
Waitlist.belongsTo(User, { foreignKey: 'userId' });
Show.hasMany(Waitlist, { foreignKey: 'showId' });
Waitlist.belongsTo(Show, { foreignKey: 'showId' });

User.hasOne(Credential, { foreignKey: 'userId', onDelete: 'CASCADE' });
Credential.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(SeatHold, { foreignKey: 'userId' });
SeatHold.belongsTo(User, { foreignKey: 'userId' });
Show.hasMany(SeatHold, { foreignKey: 'showId' });
SeatHold.belongsTo(Show, { foreignKey: 'showId' });
Seat.hasMany(SeatHold, { foreignKey: 'seatId' });
SeatHold.belongsTo(Seat, { foreignKey: 'seatId' });
User.hasMany(Payment, { foreignKey: 'userId' });
Payment.belongsTo(User, { foreignKey: 'userId' });
SeatHold.hasOne(Payment, { foreignKey: 'holdId' });
Payment.belongsTo(SeatHold, { foreignKey: 'holdId' });
Booking.hasMany(Payment, { foreignKey: 'bookingId' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId' });

async function initializeDatabase() {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log('Database connected successfully (' + sequelize.getDialect() + ')');
}

module.exports = {
  sequelize, User, Screen, Show, Seat, Booking, Waitlist, Credential, SeatHold, Payment, initializeDatabase
};
