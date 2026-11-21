const { Sequelize } = require("sequelize");

const dialect = (process.env.DB_DIALECT || "postgres").toLowerCase();

const logging =
  process.env.DB_LOGGING === "true" ||
  (!process.env.DB_LOGGING && process.env.NODE_ENV === "development")
    ? console.log
    : false;

let sequelize;

if (dialect === "postgres" || dialect === "postgresql") {
  sequelize = new Sequelize(
    process.env.DB_NAME || "ticketbooking",
    process.env.DB_USER || "postgres",
    process.env.DB_PASSWORD || "postgres",
    {
      dialect: "postgres",
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT) || 5432,
      logging,
      dialectOptions:
        process.env.DB_SSL === "true"
          ? {
              ssl: {
                require: true,
                rejectUnauthorized: false,
              },
            }
          : {},
      pool: {
        max: Number(process.env.DB_POOL_MAX) || 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    },
  );
} else if (dialect === "mysql") {
  sequelize = new Sequelize(
    process.env.database_name,
    process.env.user_name,
    process.env.password,
    {
      dialect: "mysql",
      host: process.env.host || "localhost",
      port: Number(process.env.DB_PORT) || 3306,
      logging,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
    },
  );
} else {
  throw new Error(
    `Unsupported database dialect: ${dialect}. Use postgres or mysql.`,
  );
}

module.exports = sequelize;
