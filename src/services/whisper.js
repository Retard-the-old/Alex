const axios = require('axios');
const FormData = require('form-data');
const config = require('../../config');
const logger = require('../utils/logger');

/**
 * Transcribe audio buffer using OpenAI Whisper API
 * @param {Buffer} audioBuffer - Audio file buffer (ogg/opus from WhatsApp)
 * @returns {Promise<string|null>} Transcription text
 */
async function transcribe(audioBuffer) {
  try {
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: 'voice_note.ogg',
      contentType: 'audio/ogg',
    });
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          ...form.getHeaders(),
        },
        maxContentLength: 25 * 1024 * 1024, // 25MB limit
      }
    );

    const text = response.data?.text?.trim();
    logger.info('Voice note transcribed', { length: text?.length });
    return text || null;
  } catch (err) {
    logger.error('Whisper transcription failed', { error: err.message });
    return null;
  }
}

module.exports = { transcribe };
