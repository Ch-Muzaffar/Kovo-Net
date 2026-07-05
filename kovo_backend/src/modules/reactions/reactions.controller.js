'use strict';

const { toggleReaction } = require('./reactions.service');

class ReactionsController {
  static async toggle(req, res, next) {
    try {
      const result = await toggleReaction(req.user.id, req.body);
      
      // Let's broadcast reaction changes via websocket so other users in the chat or post see reactions immediately!
      try {
        const { broadcast } = require('../../utils/websocket');
        broadcast({
          type: 'reaction_update',
          targetId: req.body.targetId,
          targetType: req.body.targetType,
          userId: req.user.id,
          ...result
        });
      } catch (wsErr) {
        console.error('Failed to broadcast reaction update via websocket', wsErr);
      }

      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ReactionsController;
