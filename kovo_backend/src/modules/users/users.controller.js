'use strict';

const { getProfile, updateProfile, updateDemographics, getPoints, getLedgerHistory, deactivateUser } = require('./users.service');
const { parsePageSize } = require('../../utils/pagination');

class UsersController {
  static async deactivate(req, res, next) {
    try {
      const result = await deactivateUser(req.user.id);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }

  static async getProfile(req, res, next) {
    try {
      const profile = await getProfile(req.params.userId);
      res.status(200).json({ data: profile });
    } catch (error) { next(error); }
  }

  static async getMyProfile(req, res, next) {
    try {
      const profile = await getProfile(req.user.id);
      res.status(200).json({ data: profile });
    } catch (error) { next(error); }
  }

  static async updateProfile(req, res, next) {
    try {
      const profile = await updateProfile(req.user.id, req.validatedBody);
      res.status(200).json({ data: profile });
    } catch (error) { next(error); }
  }

  static async updateDemographics(req, res, next) {
    try {
      const profile = await updateDemographics(req.user.id, req.validatedBody);
      res.status(200).json({ data: profile });
    } catch (error) { next(error); }
  }

  static async getMyPoints(req, res, next) {
    try {
      const points = await getPoints(req.user.id);
      res.status(200).json({ data: points });
    } catch (error) { next(error); }
  }

  static async getMyLedger(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getLedgerHistory(req.user.id, { cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}

module.exports = UsersController;
