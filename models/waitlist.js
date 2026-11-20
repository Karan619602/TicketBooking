const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Waitlist = sequelize.define('Waitlist', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  showId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('waiting', 'promoted', 'cancelled'), allowNull: false, defaultValue: 'waiting' },
  promotedBookingId: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'waitlist',
  indexes: [
    { fields: ['showId', 'status', 'createdAt'] },
    { unique: true, fields: ['showId', 'userId', 'status'] }
  ]
});
module.exports = Waitlist;
