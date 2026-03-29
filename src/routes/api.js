const express = require('express');
const claude = require('../services/claude');
const prompts = require('../services/prompts');
const config = require('../../config');
const logger = require('../utils/logger');
const db = require('../db/pool');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════
// ALEX EXTERNAL CHAT API
//
// Accepts messages from an external backend (e.g. developer's
// WhatsApp integration) and returns Alex's reply as JSON.
// Alex's full multi-agent brain is used — classification,
// routing, and agent execution all happen here.
//
// Auth:   x-api-key header matching CHAT_API_KEY env var
// Base:   /api/chat
// ═══════════════════════════════════════════════════════════════

// ─── Middleware: API key auth ──────────────────────────────────

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== config.chatApiKey) {
    return res.status(401).json({ error: 'Missing or invalid x-api-key' });
  }
  next();
}

// ─── Intent → system prompt mapping ───────────────────────────
// Maps classified intents to the correct agent prompt.
// Extend this map as new agents are added.

function promptForIntent(intent) {
  switch (intent.toUpperCase()) {
    case 'TASK_OUTREACH':    return prompts.PROMPTS.task();
    case 'TRAVEL':           return prompts.PROMPTS.travel();
    case 'PROJECT_MANAGEMENT': return prompts.PROMPTS.project();
    case 'PERSONAL_ADMIN':
    case 'CONVERSATIONAL':
    default:
      return prompts.PROMPTS.conversational();
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/chat/message
//
// Process a message through Alex's full intelligence stack
// and return the reply as JSON.
//
// Request body:
//   sender_number  {string}  WhatsApp number / user ID  (required)
//   sender_name    {string}  User's display name        (optional)
//   message_body   {string}  The text of the message    (required)
//   message_type   {string}  "text" | "image" | etc.   (optional)
//   platform       {string}  "whatsapp" | "instagram"   (optional)
//   media_url      {string}  Media URL if any           (optional)
//   timestamp      {string}  ISO 8601 message time      (optional)
//
// Response:
//   reply          {string}  Alex's response text
//   intent         {string}  Detected intent (e.g. CONVERSATIONAL)
//   sender_number  {string}  Echoed back
//   timestamp      {string}  ISO 8601 response time
// ═══════════════════════════════════════════════════════════════

router.post('/message', requireApiKey, async (req, res) => {
  const {
    sender_number,
    sender_name,
    message_body,
    message_type = 'text',
    platform = 'whatsapp',
  } = req.body;

  if (!sender_number) {
    return res.status(400).json({ error: 'sender_number is required' });
  }
  if (!message_body) {
    return res.status(400).json({ error: 'message_body is required' });
  }
  if (message_type !== 'text') {
    return res.json({
      reply: `Hi${sender_name ? ` ${sender_name}` : ''}! I can only handle text messages right now. Please type your message and I'll respond.`,
      intent: 'UNSUPPORTED_TYPE',
      sender_number,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // ── Step 1: Classify intent ──────────────────────────────
    const classificationRaw = await claude.call({
      callType: 'intent_classification',
      systemPrompt: prompts.PROMPTS.classification(),
      userMessage: `CLASSIFY THIS MESSAGE:\n\nchannel: ${platform}\nsender: ${sender_name || sender_number}\nmessage_text: "${message_body}"\nattachments: none\n\nRECENT CONTEXT: none`,
      maxTokens: 500,
    });

    const classification = claude.parseJSON(classificationRaw);
    const intent = classification?.classification?.primary_intent
      || classification?.primary_intent
      || 'CONVERSATIONAL';

    logger.info('API chat classified', {
      sender_number,
      intent,
      confidence: classification?.classification?.confidence || classification?.confidence,
    });

    // ── Step 2: Check if sender is a registered contact ─────
    const userLabel = sender_name || sender_number;
    let contactContext = '';
    try {
      const contact = await db.queryOne(
        'SELECT name, role, projects FROM contacts WHERE whatsapp = $1',
        [sender_number]
      );
      if (contact) {
        contactContext = `\n\nCONTACT VERIFIED: ${contact.name} is a registered contact in Max's database (${contact.role}). Process this message normally.`;
      } else {
        contactContext = `\n\nCONTACT STATUS: Sender number ${sender_number} is not in Max's contacts database.`;
      }
    } catch (dbErr) {
      logger.warn('Contact lookup failed', { error: dbErr.message });
    }

    // ── Step 3: Build user message with context ──────────────
    const userMessage = `${userLabel} says via ${platform}: "${message_body}"${contactContext}

Respond as Alex. Keep it concise — this will be delivered as a ${platform} message.`;

    // ── Step 4: Execute the appropriate agent ────────────────
    const systemPrompt = promptForIntent(intent);

    // ── CONTENT ENGINE HOOK ──────────────────────────────────
    // When the content engine (social media automation) is connected,
    // content-engine intents (status, pause, resume, approve, analytics)
    // will be handled here by calling the content engine API and
    // injecting the result into the context before the Claude call.
    //
    // Example (to be implemented):
    //   if (intent === 'CONTENT_ENGINE_STATUS') {
    //     const engineData = await contentEngine.getStatus(bearerToken);
    //     userMessage += `\n\nCONTENT ENGINE DATA:\n${JSON.stringify(engineData)}`;
    //   }
    // ────────────────────────────────────────────────────────

    const reply = await claude.call({
      callType: 'task_execution',
      systemPrompt,
      userMessage,
      maxTokens: 1024,
    });

    res.json({
      reply,
      intent,
      sender_number,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    logger.error('API chat error', { error: err.message, sender_number });
    res.status(500).json({ error: 'Failed to process message' });
  }
});

module.exports = router;
