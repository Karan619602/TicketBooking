const HttpError = require('../utils/httpError');
const holdService = require('../services/seatholdservice');

async function CreateHold(req, res, next) {
  try {
    const showId = Number(req.params.showId), seatId = Number(req.body.seatId);
    if (![showId, seatId].every((n) => Number.isInteger(n) && n > 0)) throw new HttpError(400, 'Valid showId and seatId are required');
    const result = await holdService.createHold({ userId: req.auth.userId, showId, seatId });
    res.status(result.created ? 201 : 200).json({ message: result.created ? 'Seat held temporarily' : 'Existing active hold returned', hold: result.hold });
  } catch (error) { next(error); }
}
async function GetHold(req, res, next) {
  try {
    const holdId = Number(req.params.holdId);
    if (!Number.isInteger(holdId) || holdId < 1) throw new HttpError(400, 'Valid holdId is required');
    res.status(200).json({ hold: await holdService.getHold({ holdId, userId: req.auth.userId }) });
  } catch (error) { next(error); }
}
async function ReleaseHold(req, res, next) {
  try {
    const holdId = Number(req.params.holdId);
    if (!Number.isInteger(holdId) || holdId < 1) throw new HttpError(400, 'Valid holdId is required');
    res.status(200).json({ message: 'Seat hold released', hold: await holdService.releaseHold({ holdId, userId: req.auth.userId }) });
  } catch (error) { next(error); }
}
module.exports = { CreateHold, GetHold, ReleaseHold };
