const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Credential = sequelize.define('Credential', {
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(128), allowNull: false },
  passwordSalt: { type: DataTypes.STRING(64), allowNull: false },
  role: { type: DataTypes.ENUM('customer', 'admin'), allowNull: false, defaultValue: 'customer' }
}, { tableName: 'credentials' });

module.exports = Credential;
