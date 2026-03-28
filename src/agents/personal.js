const claude = require('../services/claude');
const prompts = require('../services/prompts');
const whatsapp = require('../services/whatsapp');
const db = require('../db/pool');
const logger = require('../utils/logger');

/**
 * PERSONAL ADMIN AGENT
 * Handles: reminders, personal info storage/retrieval, key dates,
 * knowledge store queries
 */
async function handle(from, text, message) {
  const lowerText = (text || '').toLowerCase();

  // Check if it's retrieving information (check BEFORE store — "what's my" contains "my")
  if (lowerText.includes('what is my') || lowerText.includes("what's my") || lowerText.includes('do you know my')) {
    return handleRetrieve(from, text);
  }

  // Check if it's a reminder request
  if (lowerText.includes('remind')) {
    return handleReminder(from, text);
  }

  // Check if it's storing information
  if (lowerText.includes('remember') || lowerText.includes('my ') || lowerText.includes('save')) {
    return handleStore(from, text);
  }

  // General personal query — use Claude to figure it out
  const profile = await db.queryAll(`
    SELECT category, key, value, is_sensitive FROM knowledge_store
    ORDER BY category, key
  `);

  let profileText = 'KNOWLEDGE STORE:\n';
  for (const r of profile) {
    const val = r.is_sensitive ? `****${r.value.slice(-4)}` : r.value;
    profileText += `- [${r.category}] ${r.key}: ${val}\n`;
  }

  const response = await claude.call({
    callType: 'task_execution',
    systemPrompt: prompts.PROMPTS.conversational(),
    userMessage: `Max says: "${text}"\n\n${profileText}\n\nThis is a personal admin request. Handle it — store info, retrieve info, set reminders, etc.`,
    maxTokens: 1000,
  });

  await whatsapp.sendMessage(from, response);
}

async function handleReminder(from, text) {
  // Use Claude to parse the reminder
  const response = await claude.call({
    callType: 'task_execution',
    systemPrompt: `You parse reminder requests into structured data. Return JSON:
{
  "description": "what to remind about",
  "datetime": "ISO datetime for when to fire",
  "type": "one_off|recurring",
  "recurrence": null,
  "confirmation": "Human-friendly confirmation message"
}
Current timezone: Asia/Dubai (GST, UTC+4).
Current time: ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}`,
    userMessage: `Parse this reminder: "${text}"`,
    maxTokens: 300,
  });

  const parsed = claude.parseJSON(response);
  if (parsed && parsed.datetime) {
    await db.query(`
      INSERT INTO reminders (description, reminder_type, next_fire, recurrence_rule)
      VALUES ($1, $2, $3, $4)
    `, [parsed.description, parsed.type || 'one_off', parsed.datetime, parsed.recurrence]);

    await whatsapp.sendMessage(from, parsed.confirmation || `Reminder set: ${parsed.description}`);
  } else {
    await whatsapp.sendMessage(from, `Got it, but I couldn't parse the timing. Can you be more specific? E.g., "Remind me at 3pm tomorrow to call Susan"`);
  }
}

async function handleStore(from, text) {
  const response = await claude.call({
    callType: 'task_execution',
    systemPrompt: `You extract personal information to store. Return JSON:
{
  "category": "personal|documents|access_codes|key_dates|preferences|loyalty|household|notes",
  "key": "descriptive key",
  "value": "the value to store",
  "is_sensitive": false,
  "confirmation": "Human-friendly confirmation"
}`,
    userMessage: `Store this: "${text}"`,
    maxTokens: 300,
  });

  const parsed = claude.parseJSON(response);
  if (parsed && parsed.key) {
    await db.query(`
      INSERT INTO knowledge_store (category, key, value, is_sensitive, source)
      VALUES ($1, $2, $3, $4, 'max_direct')
      ON CONFLICT (category, key) DO UPDATE SET
        value = $3, is_sensitive = $4, updated_at = NOW()
    `, [parsed.category, parsed.key, parsed.value, parsed.is_sensitive || false]);

    await whatsapp.sendMessage(from, parsed.confirmation || `Stored: ${parsed.key}`);
  } else {
    await whatsapp.sendMessage(from, `I'll remember that.`);
  }
}

async function handleRetrieve(from, text) {
  // Search knowledge store
  const results = await db.queryAll(`
    SELECT category, key, value, is_sensitive FROM knowledge_store
    WHERE LOWER(key) LIKE $1 OR LOWER(value) LIKE $1
    LIMIT 5
  `, [`%${text.toLowerCase().replace(/what('s| is) my /i, '').trim()}%`]);

  if (results.length > 0) {
    const items = results.map(r => {
      const val = r.is_sensitive ? `****${r.value.slice(-4)}` : r.value;
      return `${r.key}: ${val}`;
    }).join('\n');
    await whatsapp.sendMessage(from, items);
  } else {
    await whatsapp.sendMessage(from, `I don't have that stored. Want to tell me?`);
  }
}

module.exports = { handle };
