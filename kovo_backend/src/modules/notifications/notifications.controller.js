'use strict';

const { getNotifications, markRead, markAllRead } = require('./notifications.service');
const { parsePageSize } = require('../../utils/pagination');

class NotificationsController {
  static async index(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getNotifications(req.user.id, {
        cursor: req.query.cursor || null,
        pageSize,
        unreadOnly: req.query.unread || 'false',
      });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
  static async markRead(req, res, next) {
    try {
      const result = await markRead(req.params.notificationId, req.user.id);
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }
  static async markAllRead(req, res, next) {
    try {
      const result = await markAllRead(req.user.id);
      res.status(200).json({ data: result });
    } catch (error) { next(error); }
  }
}

module.exports = NotificationsController;
