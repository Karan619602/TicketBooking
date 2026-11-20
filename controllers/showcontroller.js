const { Op } = require('sequelize');
const { sequelize, Show, Screen } = require('../models');
const HttpError = require('../utils/httpError');

const CreateShow = async (req, res, next) => {
  try {
    const screenId = Number(req.params.screenId);
    const { name, startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (!Number.isInteger(screenId) || screenId < 1) {
      throw new HttpError(400, 'A valid screen ID is required');
    }
    if (typeof name !== 'string' || !name.trim()) {
      throw new HttpError(400, 'Show name is required');
    }
    if (!startTime || !endTime || Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) || end <= start) {
      throw new HttpError(400, 'Valid startTime and endTime are required; endTime must be later');
    }

    const show = await sequelize.transaction(async (transaction) => {
      const screen = await Screen.findByPk(screenId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!screen) throw new HttpError(404, 'Screen not found');

      const overlap = await Show.findOne({
        where: {
          screenId,
          startTime: { [Op.lt]: end },
          endTime: { [Op.gt]: start }
        },
        transaction
      });
      if (overlap) {
        throw new HttpError(409, 'This screen already has a show scheduled during that time');
      }

      return Show.create({
        name: name.trim(),
        startTime: start,
        endTime: end,
        screenId
      }, { transaction });
    });

    res.status(201).json({ message: 'Show created successfully', show });
  } catch (error) {
    next(error);
  }
};

const GetAllShows = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.screenId) {
      const screenId = Number(req.query.screenId);
      if (!Number.isInteger(screenId) || screenId < 1) {
        throw new HttpError(400, 'screenId must be a positive integer');
      }
      where.screenId = screenId;
    }
    if (req.query.from || req.query.to) {
      where.startTime = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (Number.isNaN(from.getTime())) throw new HttpError(400, 'Invalid from date');
        where.startTime[Op.gte] = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        if (Number.isNaN(to.getTime())) throw new HttpError(400, 'Invalid to date');
        where.startTime[Op.lte] = to;
      }
    }

    const shows = await Show.findAll({
      where,
      include: [{ model: Screen, attributes: ['id', 'name', 'location'] }],
      order: [['startTime', 'ASC']]
    });
    res.status(200).json({ shows });
  } catch (error) {
    next(error);
  }
};

const GetShowById = async (req, res, next) => {
  try {
    const showId = Number(req.params.id || req.params.showId);
    if (!Number.isInteger(showId) || showId < 1) {
      throw new HttpError(400, 'A valid show ID is required');
    }
    const show = await Show.findByPk(showId, {
      include: [{ model: Screen, attributes: ['id', 'name', 'location'] }]
    });
    if (!show) throw new HttpError(404, 'Show not found');
    res.status(200).json({ show });
  } catch (error) {
    next(error);
  }
};

module.exports = { CreateShow, GetAllShows, GetShowById };
