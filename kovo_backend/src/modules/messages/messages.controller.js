'use strict';

const { sendMessage, getConversations, getConversationMessages } = require('./messages.service');
const { parsePageSize } = require('../../utils/pagination');

class MessagesController {
  static async send(req, res, next) {
    try {
      const message = await sendMessage(req.user.id, req.validatedBody);
      res.status(201).json({ data: message });
    } catch (error) { next(error); }
  }
  static async getConversations(req, res, next) {
    try {
      const result = await getConversations(req.user.id);
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
  static async getConversation(req, res, next) {
    try {
      const pageSize = parsePageSize(req.query.pageSize);
      const result = await getConversationMessages(req.user.id, req.params.otherUserId, { cursor: req.query.cursor || null, pageSize });
      res.status(200).json(result);
    } catch (error) { next(error); }
  }
}

module.exports = MessagesController;
