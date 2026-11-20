const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Payment = sequelize.define('Payment', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  holdId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  bookingId: { type: DataTypes.INTEGER, allowNull: true },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
  status: { type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded'), allowNull: false, defaultValue: 'pending' },
  idempotencyKey: { type: DataTypes.STRING(180), allowNull: true, unique: true },
  providerReference: { type: DataTypes.STRING(100), allowNull: true, unique: true },
  failureReason: { type: DataTypes.STRING(255), allowNull: true }
}, {
  tableName: 'payment_intents',
  indexes: [{ fields: ['userId', 'status', 'createdAt'] }]
});

module.exports = Payment;
