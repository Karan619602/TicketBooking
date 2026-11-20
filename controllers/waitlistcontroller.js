const HttpError = require('../utils/httpError');
const waitlistService = require('../services/waitlistservice');

async function JoinWaitlist(req, res, next) {
  try {
    const userId = Number(req.body.userId);
    const showId = Number(req.params.showId);
    if (![userId, showId].every((id) => Number.isInteger(id) && id > 0)) throw new HttpError(400, 'Valid userId and showId are required');
    const result = await waitlistService.joinWaitlist({ userId, showId });
    res.status(result.created ? 201 : 200).json({ message: result.created ? 'Added to waitlist' : 'Already on waitlist', entry: result.entry });
  } catch (error) { next(error); }
}
async function GetWaitlist(req, res, next) {
  try {
    const showId = Number(req.params.showId);
    const userId = req.query.userId === undefined ? undefined : Number(req.query.userId);
    if (!Number.isInteger(showId) || showId < 1 || (userId !== undefined && (!Number.isInteger(userId) || userId < 1))) throw new HttpError(400, 'Valid showId and optional userId are required');
    res.status(200).json({ entries: await waitlistService.getWaitlist({ showId, userId }) });
  } catch (error) { next(error); }
}
async function LeaveWaitlist(req, res, next) {
  try {
    const waitlistId = Number(req.params.waitlistId);
    const userId = Number(req.body.userId);
    if (![waitlistId, userId].every((id) => Number.isInteger(id) && id > 0)) throw new HttpError(400, 'Valid waitlistId and userId are required');
    res.status(200).json({ message: 'Removed from waitlist', entry: await waitlistService.leaveWaitlist({ waitlistId, userId }) });
  } catch (error) { next(error); }
}
module.exports = { JoinWaitlist, GetWaitlist, LeaveWaitlist };
