const { DataTypes } = require('sequelize');
const sequelize = require('./database');

const Show = sequelize.define('Show', {
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: { notEmpty: true, len: [1, 150] }
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  screenId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  validate: {
    validShowTime() {
      if (this.startTime && this.endTime && new Date(this.endTime) <= new Date(this.startTime)) {
        throw new Error('Show end time must be after start time');
      }
    }
  },
  indexes: [
    { fields: ['screenId', 'startTime'] },
    { fields: ['startTime'] }
  ]
});

module.exports = Show;
