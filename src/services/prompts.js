const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const PROMPTS_DIR = path.join(__dirname, '..', 'prompts');

// Cache loaded prompts in memory
const cache = {};

/**
 * Load a system prompt file
 * @param {string} filename - e.g. '01-core-system-prompt.md'
 * @returns {string} Prompt text
 */
function load(filename) {
  if (cache[filename]) return cache[filename];

  const filepath = path.join(PROMPTS_DIR, filename);
  try {
    const text = fs.readFileSync(filepath, 'utf-8');
    cache[filename] = text;
    logger.info('Loaded prompt', { filename, length: text.length });
    return text;
  } catch (err) {
    logger.error('Failed to load prompt', { filename, error: err.message });
    throw new Error(`Prompt file not found: ${filename}`);
  }
}

/**
 * Get combined system prompt for a given agent
 * Always includes 01-core + agent-specific prompt
 */
function forAgent(agentPromptFile) {
  const core = load('01-core-system-prompt.md');
  const agent = load(agentPromptFile);
  return `${core}\n\n---\n\n${agent}`;
}

// Pre-defined prompt combinations
const PROMPTS = {
  classification: () => load('02-intent-classification.md'),
  task: () => forAgent('06-task-agent.md'),
  travel: () => forAgent('05-travel-agent.md'),
  project: () => forAgent('04-project-intelligence-engine.md'),
  approval: () => forAgent('03-conversation-approval-flow.md'),
  briefing: () => forAgent('07-knowledge-store-and-briefing.md'),
  conversational: () => load('01-core-system-prompt.md'),

  // Extraction prompts (simpler, no core needed)
  monitoring: () => `You are a context extraction engine. You receive WhatsApp messages from Max's team members and extract project-relevant information. You do NOT generate responses — you only extract structured data.

If the message is not project-relevant (personal chat, social, unrelated logistics), return: {"relevant": false}

If relevant, return JSON only:
{
  "relevant": true,
  "sender": "string",
  "project": "string",
  "node_path": "string",
  "update_type": "progress|blocker|deliverable|deadline|decision|note",
  "summary": "string",
  "dates_mentioned": [],
  "action_for_max": "Review needed|None|Decision needed|FYI only",
  "urgency": "normal|high|critical",
  "confidence": "high|medium|low",
  "promise_made": null,
  "promise_deadline": null,
  "dependency_signal": null
}`,

  learning: () => `You are a learning extraction engine. You observe interactions between Max and Alex and extract learnings to store. Return JSON only.

{
  "learnings": [
    {
      "type": "preference|fact|person|business|style|decision|correction|project",
      "category": "travel|communication|scheduling|people|third_party|project|personal",
      "key": "descriptive key",
      "value": "what was learned",
      "confidence": "confirmed|high|medium|low",
      "store_action": "store_now|confirm_first|note_only|update_existing"
    }
  ]
}

If nothing learned, return {"learnings": []}`,
};

module.exports = { load, forAgent, PROMPTS };
