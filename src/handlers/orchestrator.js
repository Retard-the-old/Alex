const claude = require('../services/claude');
const context = require('../services/context');
const prompts = require('../services/prompts');
const whatsapp = require('../services/whatsapp');
const db = require('../db/pool');
const logger = require('../utils/logger');
const config = require('../../config');
const taskAgent = require('../agents/task');
const travelAgent = require('../agents/travel');
const projectAgent = require('../agents/project');
const personalAgent = require('../agents/personal');

/**
 * THE ORCHESTRATOR
 *
 * Every inbound message flows through here:
 * 1. Security check (registered number?)
 * 2. Store message in database
 * 3. Intent classification (Claude API call #1)
 * 4. Route to handler
 * 5. Execute agent (Claude API call #2)
 * 6. Send response
 * 7. Background learning extraction (Claude API call #3)
 */
async function handleInboundMessage(message) {
  const { from, text, whatsappMessageId, type: msgType } = message;

  // ─── 1. Security Check ──────────────────────────────────────────────────
  const isRegistered = from && from.length >= 10 && config.registeredNumbers.some(num => {
    const clean = num.replace('+', '');
    return from === clean || from.endsWith(clean) || clean.endsWith(from);
  });

  if (!isRegistered) {
    // Silent denial — no response, just log
    await db.query(`
      INSERT INTO audit_log (action, requesting_number, target, outcome, details)
      VALUES ('message_received', $1, 'inbound', 'denied_unregistered', $2)
    `, [from, text?.substring(0, 200)]);
    logger.warn('Unregistered number attempted contact', { from });
    return;
  }

  // Mark as read
  await whatsapp.markAsRead(whatsappMessageId);

  // ─── 2. Store Message ───────────────────────────────────────────────────
  await db.query(`
    INSERT INTO messages (direction, sender, channel, content, message_type, whatsapp_message_id)
    VALUES ('inbound', $1, 'whatsapp', $2, $3, $4)
  `, [from, text, msgType, whatsappMessageId]);

  // ─── 3. Intent Classification ───────────────────────────────────────────
  const classContext = await context.forClassification(from);
  const classificationRaw = await claude.call({
    callType: 'intent_classification',
    systemPrompt: prompts.PROMPTS.classification(),
    userMessage: `CLASSIFY THIS MESSAGE:\n\nchannel: whatsapp\nsender: ${from}\nmessage_text: "${text}"\nattachments: ${msgType !== 'text' ? msgType : 'none'}\n\nRECENT CONTEXT:\n${classContext}`,
    maxTokens: 500,
  });

  const classification = claude.parseJSON(classificationRaw);

  if (!classification) {
    logger.error('Failed to classify message, falling back to conversational', { text });
    await handleConversational(from, text);
    return;
  }

  const intent = classification.classification?.primary_intent || classification.primary_intent || 'CONVERSATIONAL';
  const confidence = classification.classification?.confidence || classification.confidence || 0;
  const urgency = classification.classification?.urgency || classification.urgency || 'normal';

  // Log classification
  const crypto = require('crypto');
  await db.query(`
    INSERT INTO classification_log
    (message_hash, channel, sender, message_preview, classified_intent, confidence, handler, urgency_level)
    VALUES ($1, 'whatsapp', $2, $3, $4, $5, $6, $7)
  `, [
    crypto.createHash('sha256').update(text || '').digest('hex').substring(0, 64),
    from, text?.substring(0, 500), intent, confidence,
    classification.classification?.handler || intent.toLowerCase(),
    urgency,
  ]);

  logger.info('Message classified', { intent, confidence, urgency, text: text?.substring(0, 50) });

  // ─── 4. Route to Handler ────────────────────────────────────────────────
  try {
    switch (intent.toUpperCase()) {
      case 'TASK_OUTREACH':
        await taskAgent.handle(from, text, message);
        break;

      case 'TRAVEL':
        await travelAgent.handle(from, text, message);
        break;

      case 'PROJECT_MANAGEMENT':
        await projectAgent.handle(from, text, message);
        break;

      case 'PERSONAL_ADMIN':
        await personalAgent.handle(from, text, message);
        break;

      case 'DOCUMENTS':
        await handleDocuments(from, text);
        break;

      case 'EMAIL_COMMAND':
        // Reclassify the forwarded email content
        await handleEmailCommand(from, text);
        break;

      case 'CROSS_DOMAIN':
        await handleCrossDomain(from, text, classification);
        break;

      case 'CONVERSATIONAL':
      default:
        await handleConversational(from, text);
        break;
    }
  } catch (err) {
    logger.error('Handler error', { intent, error: err.message, stack: err.stack });
    await whatsapp.sendMessage(from,
      `Something went wrong processing that. I've logged the error — try again or rephrase?`
    );
  }

  // ─── 7. Background Learning Extraction ──────────────────────────────────
  try {
    await extractLearnings(from, text, intent);
  } catch (err) {
    // Non-critical — don't let learning failures affect the main flow
    logger.error('Learning extraction failed', { error: err.message });
  }
}

// ─── Handler: Conversational ──────────────────────────────────────────────

async function handleConversational(from, text) {
  const lowerText = (text || '').toLowerCase().trim();

  // Check for briefing triggers
  const briefingTriggers = ['brief me', 'good morning', 'morning', 'what did i miss', 'catch me up', 'status update'];
  if (briefingTriggers.some(t => lowerText.includes(t))) {
    return handleBriefing(from);
  }

  // General conversational response
  const profileContext = await context.forClassification(from);
  const response = await claude.call({
    callType: 'task_execution',
    systemPrompt: prompts.PROMPTS.conversational(),
    userMessage: `Max says: "${text}"\n\nCONTEXT:\n${profileContext}\n\nRespond as Alex. Keep it to 2-3 sentences on WhatsApp.`,
    maxTokens: 500,
  });

  await whatsapp.sendMessage(from, response);
}

// ─── Handler: Briefing ────────────────────────────────────────────────────

async function handleBriefing(from) {
  const briefingContext = await context.forDailyBriefing();
  const now = new Date().toLocaleString('en-GB', { timeZone: config.timezone });

  const response = await claude.call({
    callType: 'daily_briefing',
    systemPrompt: prompts.PROMPTS.briefing(),
    userMessage: `Generate Max's daily briefing. Current time: ${now}.\n\nDATA:\n${briefingContext}`,
    maxTokens: 4000,
  });

  await whatsapp.sendMessage(from, response);
}

// ─── Handler: Documents ───────────────────────────────────────────────────

async function handleDocuments(from, text) {
  // Placeholder — requires Google Drive integration
  await whatsapp.sendMessage(from,
    `I'll look for that in your Drive. Give me a moment.`
  );
  // TODO: Implement Google Drive search and retrieval
  await whatsapp.sendMessage(from,
    `Drive integration is being set up. For now, can you tell me the file name and I'll note the request?`
  );
}

// ─── Handler: Email Command ───────────────────────────────────────────────

async function handleEmailCommand(from, text) {
  // Forwarded email — extract instruction and reclassify
  const response = await claude.call({
    callType: 'intent_classification',
    systemPrompt: prompts.PROMPTS.classification(),
    userMessage: `RECLASSIFY — this is a forwarded email with an instruction.\n\nForwarded content: "${text}"\n\nExtract the instruction Max wants me to act on, then classify the underlying intent.`,
    maxTokens: 500,
  });

  const reclassification = claude.parseJSON(response);
  if (reclassification) {
    // Re-route with the reclassified intent
    await handleInboundMessage({
      from,
      text: reclassification.extracted_instruction || text,
      whatsappMessageId: null,
      type: 'text',
    });
  } else {
    await whatsapp.sendMessage(from,
      `I got the forwarded email but I'm not sure what you want me to do with it. Can you add a quick instruction?`
    );
  }
}

// ─── Handler: Cross-Domain ────────────────────────────────────────────────

async function handleCrossDomain(from, text, classification) {
  // Decompose into sub-tasks
  const decomposition = classification.classification?.sub_tasks || [];

  if (decomposition.length === 0) {
    // Claude didn't decompose — ask for clarification or handle as conversational
    await whatsapp.sendMessage(from,
      `That covers a few different things. Want me to handle them one at a time?`
    );
    return;
  }

  await whatsapp.sendMessage(from,
    `Got it — I'll handle ${decomposition.length} things for you.`
  );

  // Execute sub-tasks sequentially (or in parallel if independent)
  for (const subtask of decomposition) {
    await handleInboundMessage({
      from,
      text: subtask.instruction || subtask.description || subtask,
      whatsappMessageId: null,
      type: 'text',
    });
  }
}

// ─── Background: Learning Extraction ──────────────────────────────────────

async function extractLearnings(from, text, intent) {
  const existingPrefs = await context.forLearningExtraction();

  const response = await claude.call({
    callType: 'learning_extraction',
    systemPrompt: prompts.PROMPTS.learning(),
    userMessage: `INTERACTION:\nMax: "${text}"\nClassified as: ${intent}\n\n${existingPrefs}\n\nExtract any learnings.`,
    maxTokens: 500,
  });

  const result = claude.parseJSON(response);
  if (!result?.learnings?.length) return;

  for (const learning of result.learnings) {
    if (learning.store_action === 'store_now' || learning.store_action === 'update_existing') {
      await db.query(`
        INSERT INTO learned_preferences (category, key, value, confidence, source)
        VALUES ($1, $2, $3, $4, 'behavioural')
        ON CONFLICT (category, key) DO UPDATE SET
          value = $3,
          confidence = $4,
          evidence_count = learned_preferences.evidence_count + 1,
          updated_at = NOW()
      `, [learning.category, learning.key, learning.value, learning.confidence]);
    }
  }

  logger.info('Learnings extracted', { count: result.learnings.length });
}

// ─── Handle Third-Party Reply ─────────────────────────────────────────────
// Called when someone who is NOT Max sends a message to Alex's number

async function handleThirdPartyReply(message) {
  const { from, text, whatsappMessageId } = message;

  // Find the active thread for this sender
  const thread = await db.queryOne(`
    SELECT ct.*, c.name as contact_name
    FROM conversation_threads ct
    JOIN contacts c ON c.id = ct.contact_id
    WHERE c.whatsapp = $1
    AND ct.status IN ('awaiting_reply', 'in_progress', 'initiated')
    ORDER BY ct.updated_at DESC LIMIT 1
  `, [from]);

  if (!thread) {
    // Unknown sender with no active thread — ignore or log
    await db.query(`
      INSERT INTO audit_log (action, requesting_number, target, outcome, details)
      VALUES ('unknown_third_party', $1, 'inbound', 'no_active_thread', $2)
    `, [from, text?.substring(0, 200)]);
    return;
  }

  // Store the message
  await db.query(`
    INSERT INTO messages (thread_id, direction, sender, channel, content, whatsapp_message_id)
    VALUES ($1, 'inbound', $2, 'whatsapp', $3, $4)
  `, [thread.id, thread.contact_name, text, whatsappMessageId]);

  // Update thread status
  await db.query(`
    UPDATE conversation_threads SET status = 'in_progress', updated_at = NOW()
    WHERE id = $1
  `, [thread.id]);

  // Get conversation context and decide: autonomous or escalate?
  const convContext = await context.forConversationContinuation(thread.id);
  if (!convContext) return;

  const response = await claude.call({
    callType: 'conversation_continuation',
    systemPrompt: prompts.PROMPTS.approval(),
    userMessage: `THIRD PARTY REPLY RECEIVED. Decide: respond autonomously or escalate to Max.\n\n${convContext.context}`,
    maxTokens: 2000,
  });

  // Parse the response to determine action
  const lowerResponse = response.toLowerCase();
  const shouldEscalate = lowerResponse.includes('escalat') || lowerResponse.includes('ask max');

  if (shouldEscalate) {
    // Send escalation to Max
    const maxNumber = config.registeredNumbers[0];
    await whatsapp.sendMessage(maxNumber, response);

    // Update thread
    await db.query(`
      UPDATE conversation_threads
      SET escalation_status = 'pending_approval', escalation_sent_at = NOW()
      WHERE id = $1
    `, [thread.id]);

    // Log autonomy
    await db.query(`
      INSERT INTO autonomy_ledger (action_type, was_autonomous, context, thread_id)
      VALUES ('third_party_reply', false, $1, $2)
    `, [text?.substring(0, 200), thread.id]);

  } else {
    // Extract the message to send from Claude's response
    // Look for quoted text in the response
    const messageMatch = response.match(/"([^"]+)"/);
    const outboundText = messageMatch ? messageMatch[1] : response;

    await whatsapp.sendMessage(from, outboundText);

    // Store outbound message
    await db.query(`
      INSERT INTO messages (thread_id, direction, sender, channel, content)
      VALUES ($1, 'outbound', 'alex', 'whatsapp', $2)
    `, [thread.id, outboundText]);

    // Log autonomy
    await db.query(`
      INSERT INTO autonomy_ledger (action_type, was_autonomous, max_approved, thread_id)
      VALUES ('third_party_reply', true, NULL, $1)
    `, [thread.id]);
  }
}

// ─── Handle Max's Approval Response ───────────────────────────────────────

async function handleApprovalResponse(from, text) {
  // Find the most recent pending escalation
  const thread = await db.queryOne(`
    SELECT ct.*, c.whatsapp as contact_whatsapp, c.name as contact_name
    FROM conversation_threads ct
    JOIN contacts c ON c.id = ct.contact_id
    WHERE ct.escalation_status = 'pending_approval'
    ORDER BY ct.escalation_sent_at DESC LIMIT 1
  `);

  if (!thread) return false; // No pending escalation

  const lowerText = (text || '').toLowerCase().trim();
  const isApproval = ['yes', 'yep', 'yeah', 'go ahead', 'send it', 'approved', 'do it', 'ok', 'sure'].some(t =>
    lowerText === t
  );

  if (isApproval) {
    // Get the proposed reply from the escalation message
    const lastOutbound = await db.queryOne(`
      SELECT content FROM messages
      WHERE thread_id = $1 AND direction = 'outbound'
      ORDER BY created_at DESC LIMIT 1
    `, [thread.id]);

    // If Max said just "yes", find the proposed reply
    // If Max modified it, use Max's version
    let messageToSend;
    if (lowerText === 'yes' || lowerText === 'yep' || lowerText === 'yeah' || lowerText === 'ok' || lowerText === 'sure' || lowerText === 'send it' || lowerText === 'go ahead' || lowerText === 'approved' || lowerText === 'do it') {
      // Use the proposed reply — extract from the escalation
      // The proposed reply is in the last escalation message
      const escalationMsg = await db.queryOne(`
        SELECT content FROM messages
        WHERE sender = $1 AND direction = 'outbound'
        AND content LIKE '%Proposed reply%'
        ORDER BY created_at DESC LIMIT 1
      `, [from]);

      const proposedMatch = escalationMsg?.content?.match(/Proposed reply:\s*["'](.+?)["']/s);
      messageToSend = proposedMatch ? proposedMatch[1] : null;

      if (!messageToSend) {
        await whatsapp.sendMessage(from, `I couldn't find the proposed reply. Can you type out what you want me to send?`);
        return true;
      }

      // Log: not modified
      await db.query(`
        INSERT INTO autonomy_ledger (action_type, was_autonomous, max_approved, max_modified, thread_id)
        VALUES ('approval_response', false, true, false, $1)
      `, [thread.id]);

    } else {
      // Max provided a custom reply — use their text instead
      messageToSend = text;

      // Log: modified
      await db.query(`
        INSERT INTO autonomy_ledger (action_type, was_autonomous, max_approved, max_modified, modification_details, thread_id)
        VALUES ('approval_response', false, true, true, $1, $2)
      `, [text, thread.id]);

      // Log draft convergence
      const escalationMsg = await db.queryOne(`
        SELECT content FROM messages
        WHERE sender = $1 AND direction = 'outbound'
        AND content LIKE '%Proposed reply%'
        ORDER BY created_at DESC LIMIT 1
      `, [from]);
      const proposedMatch = escalationMsg?.content?.match(/Proposed reply:\s*["'](.+?)["']/s);
      if (proposedMatch) {
        await db.query(`
          INSERT INTO draft_convergence (original_draft, max_modified_to, context_type, channel, thread_id)
          VALUES ($1, $2, 'third_party_reply', 'whatsapp', $3)
        `, [proposedMatch[1], text, thread.id]);
      }
    }

    // Send to the third party
    const msgId = await whatsapp.sendMessage(thread.contact_whatsapp, messageToSend);

    // Store outbound message
    await db.query(`
      INSERT INTO messages (thread_id, direction, sender, channel, content, whatsapp_message_id)
      VALUES ($1, 'outbound', 'alex', 'whatsapp', $2, $3)
    `, [thread.id, messageToSend, msgId]);

    // Update thread
    await db.query(`
      UPDATE conversation_threads
      SET escalation_status = NULL, status = 'awaiting_reply', updated_at = NOW()
      WHERE id = $1
    `, [thread.id]);

    await whatsapp.sendMessage(from, `Sent ✅`);
    return true;
  }

  return false; // Not an approval — let normal classification handle it
}

module.exports = {
  handleInboundMessage,
  handleThirdPartyReply,
  handleApprovalResponse,
  handleBriefing,
};
