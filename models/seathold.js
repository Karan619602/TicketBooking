const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const SeatHold = sequelize.define('SeatHold', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  showId: { type: DataTypes.INTEGER, allowNull: false },
  seatId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('active', 'confirmed', 'released', 'expired'), allowNull: false, defaultValue: 'active' },
  expiresAt: { type: DataTypes.DATE, allowNull: false }
}, {
  tableName: 'seat_holds',
  indexes: [
    { unique: true, fields: ['showId', 'seatId'], where: { status: 'active' } },
    { fields: ['userId', 'status', 'expiresAt'] },
    { fields: ['showId', 'status', 'expiresAt'] }
  ]
});

module.exports = SeatHold;
