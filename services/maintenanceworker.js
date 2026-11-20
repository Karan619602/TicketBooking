const { Op } = require('sequelize');
const { SeatHold } = require('../models');

async function expireSeatHolds({ batchSize = 500 } = {}) {
  const now = new Date();
  const [count] = await SeatHold.update({ status: 'expired' }, {
    where: { status: 'active', expiresAt: { [Op.lte]: now } },
    limit: batchSize
  });
  return count;
}

function startMaintenanceWorker({ intervalMs = 30000, logger = console } = {}) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await expireSeatHolds(); }
    catch (error) { logger.error('Seat-hold expiration worker failed', error); }
    finally { running = false; }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = { expireSeatHolds, startMaintenanceWorker };
