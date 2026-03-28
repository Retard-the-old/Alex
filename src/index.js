const express = require('express');
const config = require('../config');
const logger = require('./utils/logger');
const whatsappService = require('./services/whatsapp');
const orchestrator = require('./handlers/orchestrator');
const scheduler = require('./jobs/scheduler');
const db = require('./db/pool');

const app = express();
app.use(express.json());

// ─── Health Check ─────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'alex', timestamp: new Date().toISOString() });
});

app.get('/health', async (req, res) => {
  try {
    await db.queryOne('SELECT 1');
    res.json({ status: 'healthy', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// ─── WhatsApp Webhook Verification ────────────────────────────────────────

app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    logger.info('Webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', { mode, token });
  return res.sendStatus(403);
});

// ─── WhatsApp Webhook Handler ─────────────────────────────────────────────

// Multi-message batching: collect rapid-fire messages before processing
const messageBatch = {};
const BATCH_DELAY_MS = 5000; // Wait 5 seconds after last message

app.post('/webhook/whatsapp', async (req, res) => {
  // Always respond 200 immediately (Meta requires fast response)
  res.sendStatus(200);

  try {
    const message = whatsappService.parseWebhookMessage(req.body);
    if (!message) return; // Not a message event (could be status update, etc.)

    const { from, text, type } = message;

    // ─── Voice Note Transcription ───────────────────────────────────
    if (type === 'audio' && message.mediaId) {
      logger.info('Voice note received, transcribing...', { from });
      const buffer = await whatsappService.downloadMedia(message.mediaId);
      if (buffer) {
        const whisper = require('./services/whisper');
        const transcription = await whisper.transcribe(buffer);
        if (transcription) {
          message.text = transcription;
          logger.info('Transcription complete', { length: transcription.length });
        } else {
          message.text = '[voice note - transcription failed]';
        }
      }
    }

    // ─── Multi-Message Batching ─────────────────────────────────────
    // If Max sends 3 messages in quick succession, combine them
    if (config.registeredNumbers.some(n => from.endsWith(n.replace('+', '')))) {
      if (messageBatch[from]) {
        clearTimeout(messageBatch[from].timer);
        messageBatch[from].messages.push(message);
      } else {
        messageBatch[from] = { messages: [message] };
      }

      messageBatch[from].timer = setTimeout(async () => {
        const batch = messageBatch[from];
        delete messageBatch[from];

        if (batch.messages.length > 1) {
          // Combine multiple messages
          const combined = {
            ...batch.messages[batch.messages.length - 1],
            text: batch.messages.map(m => m.text).filter(Boolean).join('\n'),
          };
          logger.info('Batched messages', { count: batch.messages.length, from });
          await processMessage(combined);
        } else {
          await processMessage(batch.messages[0]);
        }
      }, BATCH_DELAY_MS);

    } else {
      // Third-party messages — process immediately, no batching
      await processThirdPartyMessage(message);
    }
  } catch (err) {
    logger.error('Webhook handler error', { error: err.message, stack: err.stack });
  }
});

// ─── Process Message from Max ─────────────────────────────────────────────

async function processMessage(message) {
  const { from, text } = message;

  // Check if this is an approval response to a pending escalation
  const wasApproval = await orchestrator.handleApprovalResponse(from, text);
  if (wasApproval) return;

  // Normal message — classify and route
  await orchestrator.handleInboundMessage(message);
}

// ─── Process Message from Third Party ─────────────────────────────────────

async function processThirdPartyMessage(message) {
  await orchestrator.handleThirdPartyReply(message);
}

// ─── Start Server ─────────────────────────────────────────────────────────

async function start() {
  // Verify database connection
  try {
    await db.queryOne('SELECT NOW()');
    logger.info('Database connected');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }

  // Start background jobs
  scheduler.startAll();

  // Start Express server
  app.listen(config.port, () => {
    logger.info(`Alex is running on port ${config.port}`, {
      env: config.env,
      registeredNumbers: config.registeredNumbers.length,
      smartModel: config.claude.modelSmart,
      fastModel: config.claude.modelFast,
    });
  });
}

start().catch(err => {
  logger.error('Failed to start', { error: err.message });
  process.exit(1);
});

module.exports = app;
