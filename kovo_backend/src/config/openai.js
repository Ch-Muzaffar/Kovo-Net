'use strict';

const env = require('./env');

let openai = null;

try {
  if (env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 5000 });
  }
} catch {
  // SDK not available — moderation will be skipped with a warning
}

/**
 * Checks text against OpenAI Moderation API.
 * Returns { flagged: boolean, categories: object }.
 */
async function moderateText(text) {
  if (!openai) {
    if (env.MODERATION_FAIL_OPEN) {
      console.warn('[WARN] OpenAI moderation unavailable — allowing content (fail-open)');
      return { flagged: false, categories: {} };
    }
    throw new Error('Content moderation service is unavailable');
  }

  try {
    const response = await openai.moderations.create({ input: text });
    const result = response.results[0];

    const severeCategories = {
      sexual: result.categories.sexual,
      hate: result.categories.hate,
      harassment: result.categories.harassment,
      'self-harm': result.categories['self-harm'],
      sexual_minors: result.categories['sexual/minors'],
      hate_threatening: result.categories['hate/threatening'],
      harassment_threatening: result.categories['harassment/threatening'],
      'self-harm_intent': result.categories['self-harm/intent'],
      'self-harm_instructions': result.categories['self-harm/instructions'],
      violence: result.categories.violence,
      violence_graphic: result.categories['violence/graphic'],
    };

    const flagged = Object.values(severeCategories).some(Boolean);
    return { flagged, categories: severeCategories };
  } catch (error) {
    if (env.MODERATION_FAIL_OPEN) {
      console.error('[WARN] Moderation API error — allowing content:', error.message);
      return { flagged: false, categories: {} };
    }
    throw new Error('Content moderation check failed');
  }
}

module.exports = { moderateText };
