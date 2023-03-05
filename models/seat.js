const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const Screen = require('./screens');
const User = require('./user');

const Seat = sequelize.define('seat', {
    number: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    screenId: {
        type: DataTypes.INTEGER,
        references: {
          model: Screen,
          key: 'id'
        }
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: 'id'
      }
      },
    
  });

module.exports = Seat;
