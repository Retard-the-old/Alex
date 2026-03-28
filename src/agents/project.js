const claude = require('../services/claude');
const context = require('../services/context');
const prompts = require('../services/prompts');
const whatsapp = require('../services/whatsapp');
const db = require('../db/pool');
const logger = require('../utils/logger');

/**
 * PROJECT INTELLIGENCE AGENT
 * Handles: "What's Farhan working on?", "Who's been quiet?",
 * "Is anyone stuck?", "Add X workstream", "Mark Y as blocked"
 */
async function handle(from, text, message) {
  const projectContext = await context.forProjectQuery(text);

  const response = await claude.call({
    callType: 'project_intelligence',
    systemPrompt: prompts.PROMPTS.project(),
    userMessage: `MAX ASKS: "${text}"\n\n${projectContext}\n\nGenerate Alex's WhatsApp response. Keep it concise — 2-3 short paragraphs max. Flag anything overdue or concerning. Include dependency impacts if relevant.`,
    maxTokens: 2000,
  });

  // Check if this is a mutation (add/update/mark) vs a query
  const lowerText = (text || '').toLowerCase();
  const isMutation = /\b(add|create|mark|update|change|move|assign|remove|delete|pause|resume|block)\b/.test(lowerText);

  if (isMutation) {
    // Ask Claude to also output the database mutation
    const mutationResponse = await claude.call({
      callType: 'project_intelligence',
      systemPrompt: `You are a project graph mutation engine. Given a natural language command, output the SQL INSERT or UPDATE statement needed. Return JSON only:
{
  "action": "insert|update|delete",
  "table": "project_nodes|project_deliverables|project_dependencies",
  "data": {},
  "confirmation": "Human-readable confirmation message"
}`,
      userMessage: `COMMAND: "${text}"\n\nEXISTING GRAPH:\n${projectContext}`,
      maxTokens: 500,
    });

    const mutation = claude.parseJSON(mutationResponse);
    if (mutation && mutation.action) {
      try {
        await executeMutation(mutation);
        await whatsapp.sendMessage(from, mutation.confirmation || response);
        return;
      } catch (err) {
        logger.error('Mutation failed', { error: err.message, mutation });
        // Fall through to sending the regular response
      }
    }
  }

  await whatsapp.sendMessage(from, response);
}

/**
 * Execute a project graph mutation
 */
async function executeMutation(mutation) {
  switch (mutation.action) {
    case 'insert': {
      if (mutation.table === 'project_nodes') {
        const d = mutation.data;
        await db.query(`
          INSERT INTO project_nodes (parent_id, project, path, title, node_type, assigned_to, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [d.parent_id, d.project, d.path, d.title, d.node_type || 'workstream', d.assigned_to || null, d.status || 'active']);
      }
      break;
    }
    case 'update': {
      if (mutation.table === 'project_nodes') {
        const d = mutation.data;
        const sets = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(d)) {
          if (key === 'id') continue;
          sets.push(`${key} = $${idx}`);
          values.push(value);
          idx++;
        }

        if (sets.length > 0 && d.id) {
          sets.push(`updated_at = NOW()`);
          values.push(d.id);
          await db.query(
            `UPDATE project_nodes SET ${sets.join(', ')} WHERE id = $${idx}`,
            values
          );
        }
      }
      break;
    }
  }
}

module.exports = { handle };
