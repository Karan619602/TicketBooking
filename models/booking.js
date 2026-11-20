const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Booking = sequelize.define('Booking', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  seatId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  showId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('confirmed', 'cancelled'),
    allowNull: false,
    defaultValue: 'confirmed'
  },
  bookingReference: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    defaultValue: DataTypes.UUIDV4
  },
  idempotencyKey: {
    type: DataTypes.STRING(180),
    allowNull: true,
    unique: true
  },
  requestFingerprint: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  }
}, {
  indexes: [
    { fields: ['showId', 'seatId', 'status'] },
    { fields: ['userId', 'createdAt'] },
    { fields: ['showId', 'status'] }
  ]
});

module.exports = Booking;
