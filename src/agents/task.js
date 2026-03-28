const claude = require('../services/claude');
const context = require('../services/context');
const prompts = require('../services/prompts');
const whatsapp = require('../services/whatsapp');
const db = require('../db/pool');
const logger = require('../utils/logger');

/**
 * TASK AGENT
 * Handles: restaurant bookings, business enquiries, quote requests,
 * messaging individuals, mass outreach, screenshot-to-outreach
 */
async function handle(from, text, message) {
  // Get context for task execution
  // Try to extract target name from the message
  const targetName = await extractTargetName(text);
  const { context: taskContext, contact } = await context.forTaskExecution(targetName || '');

  // Generate the outbound message and response to Max
  const response = await claude.call({
    callType: 'task_execution',
    systemPrompt: prompts.PROMPTS.task(),
    userMessage: `TASK: ${text}\n\n${taskContext}\n\nGenerate:\n1. The outbound WhatsApp message to the target (if contacting someone)\n2. The confirmation message to Max`,
    maxTokens: 2000,
    images: message.type === 'image' ? await getImageData(message) : [],
  });

  // Parse response — Claude should provide structured output
  // Look for the confirmation to Max and the outbound message
  const sections = parseAgentResponse(response);

  // Create task in database
  const taskResult = await db.queryOne(`
    INSERT INTO tasks (type, description, status, target, channel, project)
    VALUES ($1, $2, 'in_progress', $3, 'whatsapp', $4)
    RETURNING id
  `, [
    detectTaskType(text),
    text,
    targetName,
    null, // project — inferred later
  ]);

  // If we have a contact and outbound message, send it
  if (sections.outbound && contact?.whatsapp) {
    const msgId = await whatsapp.sendMessage(contact.whatsapp, sections.outbound);

    // Create conversation thread
    await db.query(`
      INSERT INTO conversation_threads (contact_id, task_id, channel, status, disclosure_level)
      VALUES ($1, $2, 'whatsapp', 'awaiting_reply', 1)
    `, [contact.id, taskResult.id]);

    // Store outbound message
    const thread = await db.queryOne(`
      SELECT id FROM conversation_threads WHERE task_id = $1
    `, [taskResult.id]);

    await db.query(`
      INSERT INTO messages (thread_id, direction, sender, channel, content, whatsapp_message_id)
      VALUES ($1, 'outbound', 'alex', 'whatsapp', $2, $3)
    `, [thread.id, sections.outbound, msgId]);

  } else if (sections.outbound && !contact?.whatsapp) {
    // No WhatsApp number — try to find one
    sections.maxConfirmation = `I found ${targetName || 'the business'} but don't have their WhatsApp number. Want me to search for it?`;
  }

  // Send confirmation to Max
  await whatsapp.sendMessage(from, sections.maxConfirmation || response);
}

/**
 * Extract the target business/person name from the message
 */
async function extractTargetName(text) {
  const lowerText = (text || '').toLowerCase();

  // Common patterns: "Book Nobu", "Message Farhan", "Contact Smith's"
  const patterns = [
    /book\s+(.+?)(?:\s+for|\s+on|\s+at|\s*$)/i,
    /contact\s+(.+?)(?:\s+about|\s+for|\s+and|\s*$)/i,
    /message\s+(.+?)(?:\s+about|\s+for|\s+and|\s*$)/i,
    /call\s+(.+?)(?:\s+about|\s+for|\s+and|\s*$)/i,
    /get\s+(?:a\s+)?quote\s+from\s+(.+?)(?:\s+for|\s*$)/i,
    /check\s+with\s+(.+?)(?:\s+about|\s+for|\s*$)/i,
  ];

  for (const pattern of patterns) {
    const match = text?.match(pattern);
    if (match) return match[1].trim();
  }

  // Check against known contacts
  const contacts = await db.queryAll(`SELECT name FROM contacts`);
  for (const c of contacts) {
    if (lowerText.includes(c.name.toLowerCase())) return c.name;
  }

  return null;
}

/**
 * Detect task type from message text
 */
function detectTaskType(text) {
  const lower = (text || '').toLowerCase();
  // Restaurant: explicit keywords OR "book [name] for [time]" pattern
  if (lower.includes('restaurant') || lower.includes('table') || lower.includes('reservation')) return 'restaurant_booking';
  if (/book\s+\w+.*\b(for|at)\b/.test(lower) && /\d+\s*(pm|am|people|pax|guests)/.test(lower)) return 'restaurant_booking';
  if (lower.includes('book') && (lower.includes('flight') || lower.includes('hotel'))) return 'flight_search';
  if (lower.includes('flight') || lower.includes('hotel')) return 'flight_search';
  if (lower.includes('quote') || lower.includes('price')) return 'quote_request';
  if (lower.includes('search maps') || lower.includes('find nearby')) return 'mass_outreach';
  if (lower.includes('message') || lower.includes('tell') || lower.includes('ask')) return 'message_individual';
  return 'business_enquiry';
}

/**
 * Parse Claude's agent response into structured sections
 */
function parseAgentResponse(response) {
  const result = { outbound: null, maxConfirmation: null };

  // Try to find labelled sections
  const outboundMatch = response.match(/(?:outbound|to\s+\w+|message\s+to\s+send)[:\s]*["']?(.+?)["']?(?:\n\n|$)/is);
  const confirmMatch = response.match(/(?:confirmation|to\s+max|max)[:\s]*(.+?)(?:\n\n|$)/is);

  if (outboundMatch) result.outbound = outboundMatch[1].trim();
  if (confirmMatch) result.maxConfirmation = confirmMatch[1].trim();

  // If no structured parsing worked, use the whole response as max confirmation
  if (!result.maxConfirmation) result.maxConfirmation = response;

  return result;
}

/**
 * Get image data for Claude Vision (screenshot-to-outreach)
 */
async function getImageData(message) {
  if (!message.mediaId) return [];
  const buffer = await whatsapp.downloadMedia(message.mediaId);
  if (!buffer) return [];
  return [{
    base64: buffer.toString('base64'),
    mediaType: 'image/jpeg',
  }];
}

module.exports = { handle };
