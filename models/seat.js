const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Seat = sequelize.define('Seat', {
  number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1 }
  },
  category: {
    type: DataTypes.ENUM('standard', 'premium', 'recliner'),
    allowNull: false,
    defaultValue: 'standard'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 }
  },
  screenId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'seats',
  indexes: [
    { unique: true, fields: ['screenId', 'number'] },
    { fields: ['screenId'] }
  ]
});

module.exports = Seat;
