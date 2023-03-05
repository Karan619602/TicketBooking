const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const Show = require('./shows');
const Seat = require('./seat');
const User = require('./user');

const Booking = sequelize.define('Booking', {
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: User,
        key: 'id'
      }
      },
    seatId: {
        type: DataTypes.INTEGER,
        references: {
          model: Seat,
          key: 'id'
        }
      },
      showId: {
        type: DataTypes.INTEGER,
        references: {
          model: Show,
          key: 'id'
        }
      },
      date: {
        type:DataTypes.DATE,
        defaultValue: sequelize.NOW
      }
});

module.exports = Booking;
