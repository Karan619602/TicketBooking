const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.database_name,
  process.env.user_name,
  process.env.password,
  {
    dialect: 'mysql',
    host: process.env.host || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
