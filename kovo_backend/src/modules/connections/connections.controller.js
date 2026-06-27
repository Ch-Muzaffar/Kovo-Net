'use strict';

const ConnectionsService = require('./connections.service');

class ConnectionsController {
  static async request(req, res, next) {
    try {
      const { receiver_id } = req.body;
      const connection = await ConnectionsService.sendRequest(req.user.id, receiver_id);
      res.status(200).json({ success: true, data: connection });
    } catch (error) { next(error); }
  }

  static async respond(req, res, next) {
    try {
      const { connection_id, action } = req.body;
      const connection = await ConnectionsService.respondRequest(req.user.id, connection_id, action);
      res.status(200).json({ success: true, data: connection });
    } catch (error) { next(error); }
  }

  static async getPending(req, res, next) {
    try {
      const pending = await ConnectionsService.getPendingRequests(req.user.id);
      res.status(200).json({ success: true, data: pending });
    } catch (error) { next(error); }
  }

  static async list(req, res, next) {
    try {
      const list = await ConnectionsService.getConnectionsList(req.user.id);
      res.status(200).json({ success: true, data: list });
    } catch (error) { next(error); }
  }

  static async status(req, res, next) {
    try {
      const { userId } = req.params;
      const status = await ConnectionsService.getConnectionStatus(req.user.id, userId);
      res.status(200).json({ success: true, data: status });
    } catch (error) { next(error); }
  }

  static async count(req, res, next) {
    try {
      const { userId } = req.params;
      const count = await ConnectionsService.getConnectionCount(userId);
      res.status(200).json({ success: true, data: { count } });
    } catch (error) { next(error); }
  }
}

module.exports = ConnectionsController;
