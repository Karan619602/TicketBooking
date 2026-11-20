const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Screen = sequelize.define('Screen', {
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: { notEmpty: true, len: [1, 100] }
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 1000 }
  },
  location: {
    type: DataTypes.STRING(160),
    allowNull: true
  }
});

module.exports = Screen;
