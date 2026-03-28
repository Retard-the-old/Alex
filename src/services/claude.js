const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: config.claude.apiKey });

/**
 * Call types and their model assignments
 * 'smart' = Opus (complex reasoning) | 'fast' = Sonnet (quick tasks)
 */
const MODEL_ROUTING = {
  intent_classification: 'fast',
  task_execution: 'fast',
  conversation_continuation: 'smart',
  daily_briefing: 'smart',
  travel_search: 'fast',
  project_intelligence: 'smart',
  monitoring_extraction: 'fast',
  learning_extraction: 'fast',
};

/**
 * Make a Claude API call
 * @param {object} options
 * @param {string} options.callType - One of the MODEL_ROUTING keys
 * @param {string} options.systemPrompt - System prompt text
 * @param {string} options.userMessage - User message content
 * @param {number} [options.maxTokens=2000] - Max output tokens
 * @param {Array} [options.images] - Array of {base64, mediaType} for image inputs
 * @returns {Promise<string>} Claude's response text
 */
async function call({ callType, systemPrompt, userMessage, maxTokens = 2000, images = [] }) {
  const tier = MODEL_ROUTING[callType] || 'fast';
  const model = tier === 'smart' ? config.claude.modelSmart : config.claude.modelFast;

  // Build user content (text + optional images)
  const content = [];
  if (images.length > 0) {
    for (const img of images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
      });
    }
  }
  content.push({ type: 'text', text: userMessage });

  const start = Date.now();
  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    });

    const duration = Date.now() - start;
    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const inputTokens = response.usage?.input_tokens || 0;
    const outputTokens = response.usage?.output_tokens || 0;

    logger.info('Claude API call', {
      callType,
      model,
      inputTokens,
      outputTokens,
      duration,
    });

    return text;
  } catch (err) {
    const duration = Date.now() - start;
    logger.error('Claude API error', {
      callType,
      model,
      error: err.message,
      duration,
    });

    // Retry once with fast model if smart model fails (graceful degradation)
    if (tier === 'smart') {
      logger.warn('Retrying with fast model', { callType });
      try {
        const retry = await client.messages.create({
          model: config.claude.modelFast,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: [{ role: 'user', content }],
        });
        return retry.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } catch (retryErr) {
        logger.error('Retry also failed', { callType, error: retryErr.message });
      }
    }

    throw err;
  }
}

/**
 * Parse JSON from Claude's response
 * Handles cases where Claude wraps JSON in markdown code blocks
 */
function parseJSON(text) {
  if (!text) return null;
  
  // Strip everything before the first { or [
  let cleaned = text;
  const jsonStart = cleaned.search(/[\[{]/);
  if (jsonStart > 0) {
    cleaned = cleaned.substring(jsonStart);
  }
  
  // Strip everything after the last } or ]
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const jsonEnd = Math.max(lastBrace, lastBracket);
  if (jsonEnd > 0) {
    cleaned = cleaned.substring(0, jsonEnd + 1);
  }
  
  // Strip markdown code fences if still present
  cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error('Failed to parse Claude JSON response', {
      error: err.message,
      text: text.substring(0, 200),
    });
    return null;
  }
}

module.exports = { call, parseJSON };
