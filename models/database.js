const { Sequelize } = require('sequelize');
const fs = require('node:fs');
const path = require('node:path');

const dialect = process.env.DB_DIALECT || 'sqlite';

let sequelize;

if (dialect === 'sqlite') {
  const storage = process.env.DB_STORAGE || './data/ticketbooking.sqlite';

  if (storage !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(storage)), { recursive: true });
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: { max: 1, min: 0 }
  });
} else if (dialect === 'mysql') {
  sequelize = new Sequelize(
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
} else {
  throw new Error(`Unsupported database dialect: ${dialect}`);
}

module.exports = sequelize;
