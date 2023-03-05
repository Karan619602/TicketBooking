const { DataTypes } = require('sequelize');
const sequelize = require('./database');
const Screen = require('./screens');

const Show = sequelize.define('Show', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  }, 
  startTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  screenId: {
    type: DataTypes.INTEGER,
    references: {
      model: Screen,
      key: 'id'
    }
}
});

module.exports = Show;
