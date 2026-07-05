'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { BadRequestError } = require('../../utils/errors');
const logger = require('../../utils/logger');

async function createFeedback(userId, data) {
  const insertPayload = {
    user_id: data.is_anonymous ? null : userId,
    rating: data.rating,
    category: data.category,
    message: data.message,
    is_anonymous: data.is_anonymous,
  };

  const { data: feedback, error } = await supabaseAdmin
    .from('feedback')
    .insert(insertPayload)
    .select('id, rating, category, message, is_anonymous, created_at')
    .maybeSingle();

  if (error) {
    logger.error('Failed to save feedback to db', { error });
    throw new BadRequestError('Failed to save feedback');
  }

  logger.info('User feedback submitted successfully', { feedbackId: feedback.id, category: data.category });
  return feedback;
}

module.exports = { createFeedback };
