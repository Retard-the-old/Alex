const { CronJob } = require('cron');
const config = require('../../config');
const db = require('../db/pool');
const whatsapp = require('../services/whatsapp');
const orchestrator = require('../handlers/orchestrator');
const logger = require('../utils/logger');

/**
 * BACKGROUND JOBS
 * Scheduled tasks that run independently of inbound messages.
 */

function startAll() {
  logger.info('Starting background jobs', { timezone: config.timezone });

  // Daily Briefing — 11:30 AM GST
  new CronJob(
    `${config.briefing.minute} ${config.briefing.hour} * * *`,
    dailyBriefing,
    null, true, config.timezone
  );

  // Follow-up checker — every hour
  new CronJob('0 * * * *', checkFollowUps, null, true, config.timezone);

  // Reminder checker — every 15 minutes
  new CronJob('*/15 * * * *', checkReminders, null, true, config.timezone);

  // Stale detection — daily at 12:00 PM (after briefing)
  new CronJob('0 12 * * *', checkStaleNodes, null, true, config.timezone);

  // Knowledge decay — weekly on Sundays at 3:00 AM
  new CronJob('0 3 * * 0', runKnowledgeDecay, null, true, config.timezone);

  logger.info('All background jobs scheduled');
}

// ─── Daily Briefing ───────────────────────────────────────────────────────

async function dailyBriefing() {
  logger.info('Running daily briefing');
  try {
    const maxNumber = config.registeredNumbers[0];
    if (maxNumber) {
      await orchestrator.handleBriefing(maxNumber);
    }
  } catch (err) {
    logger.error('Daily briefing failed', { error: err.message });
  }
}

// ─── Follow-Up Checker ────────────────────────────────────────────────────

async function checkFollowUps() {
  try {
    // Find threads awaiting reply that need follow-up
    const threads = await db.queryAll(`
      SELECT ct.id, ct.follow_ups_sent, ct.created_at, ct.last_follow_up_at,
             c.name, c.whatsapp
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.status = 'awaiting_reply'
      AND ct.follow_ups_sent < 2
    `);

    const now = Date.now();

    for (const thread of threads) {
      const lastContact = thread.last_follow_up_at || thread.created_at;
      const hoursSince = (now - new Date(lastContact).getTime()) / 3600000;

      if (thread.follow_ups_sent === 0 && hoursSince >= 24) {
        // First follow-up at 24 hours
        await sendFollowUp(thread, 1);
      } else if (thread.follow_ups_sent === 1 && hoursSince >= 24) {
        // Second follow-up at 48 hours (24h after first follow-up)
        await sendFollowUp(thread, 2);
      }
    }

    // Mark threads as stalled after 2 follow-ups with no reply
    const stalledThreads = await db.queryAll(`
      SELECT ct.id, c.name
      FROM conversation_threads ct
      JOIN contacts c ON c.id = ct.contact_id
      WHERE ct.status = 'awaiting_reply'
      AND ct.follow_ups_sent >= 2
      AND ct.last_follow_up_at < NOW() - INTERVAL '24 hours'
    `);

    for (const thread of stalledThreads) {
      await db.query(`
        UPDATE conversation_threads
        SET status = 'stalled', stalled_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [thread.id]);

      // Notify Max
      const maxNumber = config.registeredNumbers[0];
      if (maxNumber) {
        await whatsapp.sendMessage(maxNumber,
          `${thread.name} hasn't responded after 2 follow-ups. Want me to try a different channel or leave it?`
        );
      }

      logger.info('Thread marked as stalled', { threadId: thread.id, contact: thread.name });
    }
  } catch (err) {
    logger.error('Follow-up check failed', { error: err.message });
  }
}

async function sendFollowUp(thread, followUpNumber) {
  const messages = [
    `Hi, just following up on my earlier message. Would love to hear back when you get a chance. Thanks!`,
    `Hi, just checking in one more time. Please let me know if you're able to help. Thanks!`,
  ];

  const text = messages[followUpNumber - 1] || messages[0];
  const msgId = await whatsapp.sendMessage(thread.whatsapp, text);

  if (msgId) {
    await db.query(`
      UPDATE conversation_threads
      SET follow_ups_sent = $1, last_follow_up_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [followUpNumber, thread.id]);

    await db.query(`
      INSERT INTO messages (thread_id, direction, sender, channel, content, whatsapp_message_id)
      VALUES ($1, 'outbound', 'alex', 'whatsapp', $2, $3)
    `, [thread.id, text, msgId]);

    logger.info('Follow-up sent', { contact: thread.name, followUpNumber });
  }
}

// ─── Reminder Checker ─────────────────────────────────────────────────────

async function checkReminders() {
  try {
    const dueReminders = await db.queryAll(`
      SELECT id, description, reminder_type, recurrence_rule
      FROM reminders
      WHERE status = 'active' AND next_fire <= NOW()
    `);

    const maxNumber = config.registeredNumbers[0];

    for (const reminder of dueReminders) {
      if (maxNumber) {
        await whatsapp.sendMessage(maxNumber, `⏰ Reminder: ${reminder.description}`);
      }

      if (reminder.reminder_type === 'recurring' && reminder.recurrence_rule) {
        // Calculate next fire based on recurrence
        const nextFire = calculateNextFire(reminder.recurrence_rule);
        await db.query(`
          UPDATE reminders SET next_fire = $1 WHERE id = $2
        `, [nextFire, reminder.id]);
      } else {
        await db.query(`
          UPDATE reminders SET status = 'fired' WHERE id = $1
        `, [reminder.id]);
      }

      logger.info('Reminder fired', { id: reminder.id, description: reminder.description });
    }
  } catch (err) {
    logger.error('Reminder check failed', { error: err.message });
  }
}

function calculateNextFire(rule) {
  const now = new Date();
  switch (rule) {
    case 'daily': return new Date(now.getTime() + 86400000);
    case 'weekly': return new Date(now.getTime() + 7 * 86400000);
    case 'monthly': return new Date(now.setMonth(now.getMonth() + 1));
    case 'yearly': return new Date(now.setFullYear(now.getFullYear() + 1));
    default: return new Date(now.getTime() + 86400000);
  }
}

// ─── Stale Detection ──────────────────────────────────────────────────────

async function checkStaleNodes() {
  try {
    const staleNodes = await db.queryAll(`
      SELECT pn.id, pn.title, pn.path, pn.assigned_to, pn.last_activity,
             pn.stale_threshold_days, pn.status
      FROM project_nodes pn
      WHERE pn.status = 'active'
      AND pn.node_type IN ('workstream', 'task')
      AND pn.assigned_to IS NOT NULL
      AND (
        pn.last_activity IS NULL
        OR pn.last_activity < NOW() - (pn.stale_threshold_days || ' days')::INTERVAL
      )
    `);

    if (staleNodes.length > 0) {
      logger.info('Stale nodes detected', { count: staleNodes.length });

      // Update status indicators (used in next briefing)
      for (const node of staleNodes) {
        await db.query(`
          INSERT INTO project_updates (node_id, update_type, content, source)
          VALUES ($1, 'note', $2, 'alex_inference')
        `, [
          node.id,
          `No activity detected in ${node.stale_threshold_days}+ days. Last activity: ${node.last_activity || 'never'}.`,
        ]);
      }
    }
  } catch (err) {
    logger.error('Stale detection failed', { error: err.message });
  }
}

// ─── Knowledge Decay ──────────────────────────────────────────────────────

async function runKnowledgeDecay() {
  try {
    // Demote preferences that haven't been confirmed in a long time
    const decayed = await db.query(`
      UPDATE learned_preferences
      SET confidence = 'low', updated_at = NOW()
      WHERE confidence IN ('confirmed', 'high', 'medium')
      AND last_confirmed < NOW() - (decay_after_days || ' days')::INTERVAL
      AND last_confirmed IS NOT NULL
      RETURNING key, category
    `);

    if (decayed.rowCount > 0) {
      logger.info('Knowledge decay applied', { count: decayed.rowCount });
    }
  } catch (err) {
    logger.error('Knowledge decay failed', { error: err.message });
  }
}

module.exports = { startAll };
