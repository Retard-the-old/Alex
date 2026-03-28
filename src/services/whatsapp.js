const axios = require('axios');
const config = require('../../config');
const logger = require('../utils/logger');

const GRAPH_API = 'https://graph.facebook.com/v21.0';

/**
 * Send a text message via WhatsApp
 * @param {string} to - Recipient phone number (with country code)
 * @param {string} text - Message text
 * @returns {Promise<string|null>} WhatsApp message ID
 */
async function sendMessage(to, text) {
  try {
    const response = await axios.post(
      `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const messageId = response.data?.messages?.[0]?.id;
    logger.info('WhatsApp message sent', { to, messageId, length: text.length });
    return messageId;
  } catch (err) {
    logger.error('Failed to send WhatsApp message', {
      to,
      error: err.response?.data || err.message,
    });
    return null;
  }
}

/**
 * Send an image message
 */
async function sendImage(to, imageUrl, caption = '') {
  try {
    const response = await axios.post(
      `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'image',
        image: { link: imageUrl, caption },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data?.messages?.[0]?.id;
  } catch (err) {
    logger.error('Failed to send image', { to, error: err.message });
    return null;
  }
}

/**
 * Send a document message
 */
async function sendDocument(to, documentUrl, filename, caption = '') {
  try {
    const response = await axios.post(
      `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'document',
        document: { link: documentUrl, filename, caption },
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data?.messages?.[0]?.id;
  } catch (err) {
    logger.error('Failed to send document', { to, error: err.message });
    return null;
  }
}

/**
 * Mark a message as read
 */
async function markAsRead(messageId) {
  try {
    await axios.post(
      `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      },
      {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    // Non-critical — don't throw
    logger.debug('Failed to mark as read', { messageId });
  }
}

/**
 * Download media (voice notes, images, documents)
 * @param {string} mediaId - WhatsApp media ID
 * @returns {Promise<Buffer|null>}
 */
async function downloadMedia(mediaId) {
  try {
    // Step 1: Get the media URL
    const urlResponse = await axios.get(`${GRAPH_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
    });
    const mediaUrl = urlResponse.data.url;

    // Step 2: Download the binary
    const mediaResponse = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${config.whatsapp.accessToken}` },
      responseType: 'arraybuffer',
    });
    return Buffer.from(mediaResponse.data);
  } catch (err) {
    logger.error('Failed to download media', { mediaId, error: err.message });
    return null;
  }
}

/**
 * Parse inbound webhook payload into a normalised message object
 * @param {object} body - Webhook body from Meta
 * @returns {object|null} Normalised message or null if not a message event
 */
function parseWebhookMessage(body) {
  try {
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) return null;

    const msg = value.messages[0];
    const contact = value.contacts?.[0];

    const parsed = {
      whatsappMessageId: msg.id,
      from: msg.from,
      senderName: contact?.profile?.name || 'Unknown',
      timestamp: new Date(parseInt(msg.timestamp) * 1000),
      type: msg.type, // text, image, audio, document, location, reaction, etc.
      text: null,
      mediaId: null,
      caption: null,
      isForwarded: false,
      replyContext: null,
    };

    // Extract content based on type
    switch (msg.type) {
      case 'text':
        parsed.text = msg.text.body;
        break;
      case 'audio':
        parsed.mediaId = msg.audio.id;
        parsed.text = '[voice_note]'; // placeholder until transcribed
        break;
      case 'image':
        parsed.mediaId = msg.image.id;
        parsed.caption = msg.image.caption || null;
        parsed.text = parsed.caption || '[image]';
        break;
      case 'document':
        parsed.mediaId = msg.document.id;
        parsed.caption = msg.document.caption || null;
        parsed.text = parsed.caption || `[document: ${msg.document.filename}]`;
        break;
      case 'location':
        parsed.text = `[location: ${msg.location.latitude},${msg.location.longitude}]`;
        break;
      case 'reaction':
        parsed.text = `[reaction: ${msg.reaction.emoji}]`;
        break;
      default:
        parsed.text = `[${msg.type}]`;
    }

    // Forwarding context
    if (msg.context?.forwarded || msg.context?.frequently_forwarded) {
      parsed.isForwarded = true;
    }

    // Reply context
    if (msg.context?.id) {
      parsed.replyContext = msg.context.id;
    }

    return parsed;
  } catch (err) {
    logger.error('Failed to parse webhook message', { error: err.message });
    return null;
  }
}

module.exports = {
  sendMessage,
  sendImage,
  sendDocument,
  markAsRead,
  downloadMedia,
  parseWebhookMessage,
};
