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

const parsePositiveInteger = (value, field, fallback, maximum) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\\d+$/.test(value)) {
    throw new HttpError(400, field + ' must be a positive integer');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (maximum && parsed > maximum)) {
    throw new HttpError(400, maximum
      ? field + ' must be between 1 and ' + maximum
      : field + ' must be a positive integer');
  }
  return parsed;
};

const GetAllShows = async (req, res, next) => {
  try {
    const query = req.query || {};
    const page = parsePositiveInteger(query.page, 'page', 1);
    const limit = parsePositiveInteger(query.limit, 'limit', 20, 100);
    const offset = (page - 1) * limit;
    if (!Number.isSafeInteger(offset)) throw new HttpError(400, 'Requested page is too large');

    const where = {};
    if (query.screenId !== undefined) {
      const screenId = parsePositiveInteger(query.screenId, 'screenId');
      where.screenId = screenId;
    }

    if (query.from !== undefined || query.to !== undefined) {
      where.startTime = {};
      if (query.from !== undefined) {
        if (typeof query.from !== 'string' || !query.from.trim()) {
          throw new HttpError(400, 'Invalid from date');
        }
        const from = new Date(query.from);
        if (Number.isNaN(from.getTime())) throw new HttpError(400, 'Invalid from date');
        where.startTime[Op.gte] = from;
      }
      if (query.to !== undefined) {
        if (typeof query.to !== 'string' || !query.to.trim()) {
          throw new HttpError(400, 'Invalid to date');
        }
        const to = new Date(query.to);
        if (Number.isNaN(to.getTime())) throw new HttpError(400, 'Invalid to date');
        where.startTime[Op.lte] = to;
      }
      if (where.startTime[Op.gte] && where.startTime[Op.lte] &&
          where.startTime[Op.gte] > where.startTime[Op.lte]) {
        throw new HttpError(400, 'from must be earlier than or equal to to');
      }
    }

    if (query.search !== undefined) {
      if (typeof query.search !== 'string') throw new HttpError(400, 'search must be a string');
      const search = query.search.trim();
      if (search.length > 100) throw new HttpError(400, 'search must be 100 characters or fewer');
      if (search) {
        const operator = ['postgres', 'postgresql'].includes(sequelize.getDialect())
          ? Op.iLike : Op.like;
        where.name = { [operator]: '%' + search + '%' };
      }
    }

    const sortColumns = {
      name: 'name',
      startTime: 'startTime',
      createdAt: 'createdAt'
    };
    const sortBy = query.sortBy === undefined ? 'startTime' : query.sortBy;
    if (typeof sortBy !== 'string' || !Object.prototype.hasOwnProperty.call(sortColumns, sortBy)) {
      throw new HttpError(400, 'sortBy must be one of: name, startTime, createdAt');
    }

    const sortOrder = query.sortOrder === undefined ? 'asc' : query.sortOrder;
    if (typeof sortOrder !== 'string' || !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
      throw new HttpError(400, 'sortOrder must be asc or desc');
    }

    const result = await Show.findAndCountAll({
      where,
      include: [{ model: Screen, attributes: ['id', 'name', 'location'] }],
      order: [[sortColumns[sortBy], sortOrder.toUpperCase()], ['id', 'ASC']],
      limit,
      offset
    });

    const total = Number(result.count);
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({
      shows: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && page <= totalPages
      }
    });
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
