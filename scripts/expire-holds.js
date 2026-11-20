require('dotenv').config();
const { initializeDatabase, sequelize } = require('../models');
const { expireSeatHolds } = require('../services/maintenanceworker');

(async () => {
  try {
    await initializeDatabase();
    const expired = await expireSeatHolds();
    process.stdout.write('Expired ' + expired + ' seat hold(s).\\n');
  } catch (error) {
    console.error('Could not expire seat holds:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
