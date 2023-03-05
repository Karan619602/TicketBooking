const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Screen = sequelize.define('Screen', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
});

module.exports = Screen;
