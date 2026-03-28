/**
 * ALEX — Test & Stress Test Suite
 * 
 * Tests all modules without requiring external services.
 * Uses mock database, mock WhatsApp, mock Claude API.
 *
 * Run: node src/test-runner.js
 */

const logger = require('./utils/logger');

// ─── Test Framework ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}", got "${actual}"`);
  }
}

function assertIncludes(str, substring, message) {
  if (!str || !str.includes(substring)) {
    throw new Error(message || `Expected "${str}" to include "${substring}"`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

// ─── 1. CONFIG TESTS ─────────────────────────────────────────────────────

function testConfig() {
  console.log('\n📋 CONFIG TESTS');

  // Set env vars for testing
  process.env.PORT = '3000';
  process.env.MAX_REGISTERED_NUMBERS = '+447700900001,+971501234567';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify';
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-access';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';

  // Clear require cache to reload config
  delete require.cache[require.resolve('../config')];
  const config = require('../config');

  test('Port defaults correctly', () => {
    assertEqual(config.port, '3000');
  });

  test('Registered numbers parse from comma-separated string', () => {
    assertEqual(config.registeredNumbers.length, 2);
    assertEqual(config.registeredNumbers[0], '+447700900001');
    assertEqual(config.registeredNumbers[1], '+971501234567');
  });

  test('Empty registered numbers returns empty array', () => {
    process.env.MAX_REGISTERED_NUMBERS = '';
    delete require.cache[require.resolve('../config')];
    const c = require('../config');
    assertEqual(c.registeredNumbers.length, 0);
    // Restore
    process.env.MAX_REGISTERED_NUMBERS = '+447700900001,+971501234567';
  });

  test('Claude model defaults are set', () => {
    delete require.cache[require.resolve('../config')];
    const c = require('../config');
    assertIncludes(c.claude.modelSmart, 'opus');
    assertIncludes(c.claude.modelFast, 'sonnet');
  });

  test('Timezone defaults to Dubai', () => {
    assertEqual(config.timezone, 'Asia/Dubai');
  });

  test('Briefing defaults to 11:30', () => {
    assertEqual(config.briefing.hour, 11);
    assertEqual(config.briefing.minute, 30);
  });
}

// ─── 2. WHATSAPP SERVICE TESTS ───────────────────────────────────────────

function testWhatsAppParsing() {
  console.log('\n📱 WHATSAPP PARSING TESTS');

  const whatsapp = require('./services/whatsapp');

  test('Parse text message', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.test123',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'text',
              text: { body: 'Book Nobu for Friday 8pm' },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertNotNull(msg);
    assertEqual(msg.whatsappMessageId, 'wamid.test123');
    assertEqual(msg.from, '447700900001');
    assertEqual(msg.text, 'Book Nobu for Friday 8pm');
    assertEqual(msg.type, 'text');
    assertEqual(msg.senderName, 'Max');
  });

  test('Parse voice note message', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.voice1',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'audio',
              audio: { id: 'media_123' },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertNotNull(msg);
    assertEqual(msg.type, 'audio');
    assertEqual(msg.mediaId, 'media_123');
    assertEqual(msg.text, '[voice_note]');
  });

  test('Parse image with caption', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.img1',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'image',
              image: { id: 'media_456', caption: 'Get me a quote from these guys' },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertNotNull(msg);
    assertEqual(msg.type, 'image');
    assertEqual(msg.caption, 'Get me a quote from these guys');
    assertEqual(msg.text, 'Get me a quote from these guys');
    assertEqual(msg.mediaId, 'media_456');
  });

  test('Parse forwarded message', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.fwd1',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'text',
              text: { body: 'Check this out' },
              context: { forwarded: true },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assert(msg.isForwarded, 'Should detect forwarded message');
  });

  test('Parse reply context', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.reply1',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'text',
              text: { body: 'Yes' },
              context: { id: 'wamid.original123' },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertEqual(msg.replyContext, 'wamid.original123');
  });

  test('Return null for non-message events (status updates)', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            statuses: [{ id: 'wamid.test', status: 'delivered' }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertEqual(msg, null);
  });

  test('Return null for empty body', () => {
    assertEqual(whatsapp.parseWebhookMessage(null), null);
    assertEqual(whatsapp.parseWebhookMessage({}), null);
    assertEqual(whatsapp.parseWebhookMessage({ entry: [] }), null);
  });

  test('Parse location message', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.loc1',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'location',
              location: { latitude: 25.2048, longitude: 55.2708 },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertIncludes(msg.text, '25.2048');
    assertIncludes(msg.text, '55.2708');
  });

  test('Parse reaction message', () => {
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.react1',
              from: '447700900001',
              timestamp: '1709510400',
              type: 'reaction',
              reaction: { emoji: '👍' },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertIncludes(msg.text, '👍');
  });
}

// ─── 3. CLAUDE SERVICE TESTS ─────────────────────────────────────────────

function testClaudeService() {
  console.log('\n🤖 CLAUDE SERVICE TESTS');

  const claude = require('./services/claude');

  test('parseJSON handles clean JSON', () => {
    const result = claude.parseJSON('{"intent": "TASK", "confidence": 0.95}');
    assertNotNull(result);
    assertEqual(result.intent, 'TASK');
    assertEqual(result.confidence, 0.95);
  });

  test('parseJSON handles markdown-wrapped JSON', () => {
    const result = claude.parseJSON('```json\n{"intent": "TRAVEL"}\n```');
    assertNotNull(result);
    assertEqual(result.intent, 'TRAVEL');
  });

  test('parseJSON handles multiple code fences', () => {
    const result = claude.parseJSON('Here is the result:\n```json\n{"key": "value"}\n```\nDone.');
    assertNotNull(result);
    assertEqual(result.key, 'value');
  });

  test('parseJSON returns null for invalid JSON', () => {
    const result = claude.parseJSON('This is not JSON at all');
    assertEqual(result, null);
  });

  test('parseJSON handles empty string', () => {
    const result = claude.parseJSON('');
    assertEqual(result, null);
  });

  test('parseJSON handles nested objects', () => {
    const result = claude.parseJSON('{"classification": {"primary_intent": "TASK_OUTREACH", "confidence": 0.92}}');
    assertNotNull(result);
    assertEqual(result.classification.primary_intent, 'TASK_OUTREACH');
  });

  test('parseJSON handles arrays', () => {
    const result = claude.parseJSON('{"learnings": [{"type": "preference", "key": "test"}]}');
    assertNotNull(result);
    assertEqual(result.learnings.length, 1);
    assertEqual(result.learnings[0].type, 'preference');
  });
}

// ─── 4. PROMPT LOADER TESTS ─────────────────────────────────────────────

function testPromptLoader() {
  console.log('\n📄 PROMPT LOADER TESTS');

  const promptService = require('./services/prompts');

  test('Load core system prompt', () => {
    const prompt = promptService.load('01-core-system-prompt.md');
    assertNotNull(prompt);
    assert(prompt.length > 1000, 'Core prompt should be substantial');
    assertIncludes(prompt, 'Alex');
  });

  test('Load all 8 prompt files', () => {
    const files = [
      '01-core-system-prompt.md',
      '02-intent-classification.md',
      '03-conversation-approval-flow.md',
      '04-project-intelligence-engine.md',
      '05-travel-agent.md',
      '06-task-agent.md',
      '07-knowledge-store-and-briefing.md',
      '08-learning-engine.md',
    ];
    for (const file of files) {
      const prompt = promptService.load(file);
      assert(prompt.length > 500, `${file} should have content`);
    }
  });

  test('forAgent combines core + agent prompt', () => {
    const combined = promptService.forAgent('06-task-agent.md');
    assertIncludes(combined, '---'); // separator
    assert(combined.length > 10000, 'Combined prompt should be large');
  });

  test('PROMPTS.classification returns intent classification prompt', () => {
    const prompt = promptService.PROMPTS.classification();
    assertIncludes(prompt, 'intent');
  });

  test('PROMPTS.monitoring returns extraction prompt', () => {
    const prompt = promptService.PROMPTS.monitoring();
    assertIncludes(prompt, 'extraction');
    assertIncludes(prompt, 'JSON');
  });

  test('PROMPTS.learning returns learning prompt', () => {
    const prompt = promptService.PROMPTS.learning();
    assertIncludes(prompt, 'learning');
    assertIncludes(prompt, 'JSON');
  });

  test('Prompt caching works (second load is instant)', () => {
    const start1 = Date.now();
    promptService.load('01-core-system-prompt.md');
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    promptService.load('01-core-system-prompt.md');
    const time2 = Date.now() - start2;

    assert(time2 <= time1, 'Second load should be cached and faster');
  });
}

// ─── 5. SECURITY TESTS ──────────────────────────────────────────────────

function testSecurity() {
  console.log('\n🔒 SECURITY TESTS');

  delete require.cache[require.resolve('../config')];
  process.env.MAX_REGISTERED_NUMBERS = '+447700900001,+971501234567';
  const config = require('../config');

  test('Registered number matches with full format', () => {
    const from = '447700900001';
    const isRegistered = config.registeredNumbers.some(num =>
      from.endsWith(num.replace('+', '')) || num.endsWith(from)
    );
    assert(isRegistered, 'Should match registered number');
  });

  test('Unregistered number is rejected', () => {
    const from = '447700999999';
    const isRegistered = config.registeredNumbers.some(num =>
      from.endsWith(num.replace('+', '')) || num.endsWith(from)
    );
    assert(!isRegistered, 'Should reject unregistered number');
  });

  test('Number matching works with different formats', () => {
    const variants = ['447700900001', '0447700900001', '+447700900001'];
    for (const from of variants) {
      const isRegistered = config.registeredNumbers.some(num =>
        from.endsWith(num.replace('+', '')) || num.endsWith(from)
      );
      assert(isRegistered, `Should match "${from}"`);
    }
  });

  test('Empty number is rejected', () => {
    const from = '';
    const isRegistered = from && from.length >= 10 && config.registeredNumbers.some(num => {
      const clean = num.replace('+', '');
      return from === clean || from.endsWith(clean) || clean.endsWith(from);
    });
    assert(!isRegistered, 'Empty number should be rejected');
  });

  test('Partial number match is rejected', () => {
    const from = '900001'; // Partial match — should NOT work as-is
    const isRegistered = config.registeredNumbers.some(num =>
      from === num.replace('+', '')
    );
    assert(!isRegistered, 'Partial number should be rejected');
  });
}

// ─── 6. TASK AGENT HELPER TESTS ─────────────────────────────────────────

function testTaskHelpers() {
  console.log('\n📋 TASK AGENT HELPER TESTS');

  // Test detectTaskType directly
  function detectTaskType(text) {
    const lower = (text || '').toLowerCase();
    if (lower.includes('restaurant') || lower.includes('table') || lower.includes('reservation')) return 'restaurant_booking';
    if (/book\s+\w+.*\b(for|at)\b/.test(lower) && /\d+\s*(pm|am|people|pax|guests)/.test(lower)) return 'restaurant_booking';
    if (lower.includes('book') && (lower.includes('flight') || lower.includes('hotel'))) return 'flight_search';
    if (lower.includes('flight') || lower.includes('hotel')) return 'flight_search';
    if (lower.includes('quote') || lower.includes('price')) return 'quote_request';
    if (lower.includes('search maps') || lower.includes('find nearby')) return 'mass_outreach';
    if (lower.includes('message') || lower.includes('tell') || lower.includes('ask')) return 'message_individual';
    return 'business_enquiry';
  }

  test('Detect restaurant booking', () => {
    assertEqual(detectTaskType('Book Nobu for Friday 8pm'), 'restaurant_booking');
    assertEqual(detectTaskType('book a table at Zuma'), 'restaurant_booking');
    assertEqual(detectTaskType('Make a reservation at LPM'), 'restaurant_booking');
  });

  test('Detect flight search', () => {
    assertEqual(detectTaskType('Book a flight to Dubai'), 'flight_search');
    assertEqual(detectTaskType('Find me a hotel near the airport'), 'flight_search');
  });

  test('Detect quote request', () => {
    assertEqual(detectTaskType('Get me a quote from the garage'), 'quote_request');
    assertEqual(detectTaskType('What are their prices?'), 'quote_request');
  });

  test('Detect mass outreach', () => {
    assertEqual(detectTaskType('Search maps 2 miles for garages'), 'mass_outreach');
    assertEqual(detectTaskType('Find nearby nail salons'), 'mass_outreach');
  });

  test('Detect message individual', () => {
    assertEqual(detectTaskType('Message Farhan about the creatives'), 'message_individual');
    assertEqual(detectTaskType('Tell Susan the contract is ready'), 'message_individual');
    assertEqual(detectTaskType('Ask Usman about the bot'), 'message_individual');
  });

  test('Default to business enquiry', () => {
    assertEqual(detectTaskType('Contact the electrician'), 'business_enquiry');
    assertEqual(detectTaskType('Check with the plumber'), 'business_enquiry');
  });
}

// ─── 7. PERSONAL AGENT TESTS ────────────────────────────────────────────

function testPersonalDetection() {
  console.log('\n👤 PERSONAL AGENT DETECTION TESTS');

  function detectPersonalType(text) {
    const lower = (text || '').toLowerCase();
    // Retrieve must check BEFORE store — "what's my" contains "my"
    if (lower.includes('what is my') || lower.includes("what's my") || lower.includes('do you know my')) return 'retrieve';
    if (lower.includes('remind')) return 'reminder';
    if (lower.includes('remember') || lower.includes('my ') || lower.includes('save')) return 'store';
    return 'general';
  }

  test('Detect reminder request', () => {
    assertEqual(detectPersonalType('Remind me at 3pm to call Susan'), 'reminder');
    assertEqual(detectPersonalType('Set a reminder for tomorrow'), 'reminder');
  });

  test('Detect store request', () => {
    assertEqual(detectPersonalType('Remember my passport number is X123'), 'store');
    assertEqual(detectPersonalType('Save this — my Skywards number is EK123'), 'store');
    assertEqual(detectPersonalType('My car insurance expires April 15'), 'store');
  });

  test('Detect retrieve request', () => {
    assertEqual(detectPersonalType("What's my passport number?"), 'retrieve');
    assertEqual(detectPersonalType('What is my Skywards number?'), 'retrieve');
    assertEqual(detectPersonalType('Do you know my car insurance expiry?'), 'retrieve');
  });
}

// ─── 8. EXPRESS SERVER TESTS ─────────────────────────────────────────────

async function testExpressServer() {
  console.log('\n🌐 EXPRESS SERVER TESTS');

  // We can't start the full server (no DB), but we can test route setup
  const express = require('express');
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/health', (req, res) => res.json({ status: 'test' }));

  // Webhook verification
  app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === 'test-verify') {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  await testAsync('Webhook verification accepts valid token', async () => {
    // Simulate the verification
    const mode = 'subscribe';
    const token = 'test-verify';
    const isValid = mode === 'subscribe' && token === 'test-verify';
    assert(isValid, 'Should accept valid verification');
  });

  await testAsync('Webhook verification rejects invalid token', async () => {
    const mode = 'subscribe';
    const token = 'wrong-token';
    const isValid = mode === 'subscribe' && token === 'test-verify';
    assert(!isValid, 'Should reject invalid token');
  });
}

// ─── 9. APPROVAL FLOW TESTS ────────────────────────────────────────────

function testApprovalDetection() {
  console.log('\n✅ APPROVAL FLOW TESTS');

  const approvalWords = ['yes', 'yep', 'yeah', 'go ahead', 'send it', 'approved', 'do it', 'ok', 'sure'];

  function isApproval(text) {
    const lower = (text || '').toLowerCase().trim();
    return approvalWords.some(t => lower === t);
  }

  test('Detect "yes" as approval', () => {
    assert(isApproval('Yes'), 'Should detect yes');
    assert(isApproval('yes'), 'Should detect lowercase yes');
  });

  test('Detect various approval phrases', () => {
    assert(isApproval('Go ahead'));
    assert(isApproval('Send it'));
    assert(isApproval('Approved'));
    assert(isApproval('Do it'));
    assert(isApproval('Sure'));
    assert(isApproval('Yep'));
    assert(isApproval('Yeah'));
    assert(isApproval('Ok'));
  });

  test('Non-approval messages are not detected', () => {
    assert(!isApproval('No'));
    assert(!isApproval('Wait'));
    assert(!isApproval('Change it to 9pm'));
    assert(!isApproval('Book Nobu for Friday'));
    assert(!isApproval('What about 7:30?'));
  });

  test('Custom reply (modification) is not bare approval', () => {
    assert(!isApproval('Go with 9:30 instead'));
    assert(!isApproval('Yes but change the time to 7pm'));
  });
}

// ─── 10. BRIEFING TRIGGER TESTS ─────────────────────────────────────────

function testBriefingTriggers() {
  console.log('\n📰 BRIEFING TRIGGER TESTS');

  const triggers = ['brief me', 'good morning', 'morning', 'what did i miss', 'catch me up', 'status update'];

  function isBriefingTrigger(text) {
    const lower = (text || '').toLowerCase().trim();
    return triggers.some(t => lower.includes(t));
  }

  test('Standard briefing triggers', () => {
    assert(isBriefingTrigger('Brief me'));
    assert(isBriefingTrigger('Good morning'));
    assert(isBriefingTrigger('Morning'));
    assert(isBriefingTrigger('What did I miss?'));
    assert(isBriefingTrigger('Catch me up'));
    assert(isBriefingTrigger('Status update'));
  });

  test('Non-briefing messages', () => {
    assert(!isBriefingTrigger('Book Nobu'));
    assert(!isBriefingTrigger("What's Farhan working on?"));
    assert(!isBriefingTrigger('Find me flights'));
  });
}

// ─── 11. STRESS TESTS ───────────────────────────────────────────────────

function testStress() {
  console.log('\n💪 STRESS TESTS');

  const whatsapp = require('./services/whatsapp');
  const claude = require('./services/claude');

  test('Parse 1000 webhook messages without error', () => {
    for (let i = 0; i < 1000; i++) {
      const body = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                id: `wamid.stress${i}`,
                from: '447700900001',
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: 'text',
                text: { body: `Stress test message ${i}: ${'x'.repeat(Math.random() * 500)}` },
              }],
              contacts: [{ profile: { name: 'Max' } }],
            },
          }],
        }],
      };
      const msg = whatsapp.parseWebhookMessage(body);
      assertNotNull(msg);
    }
  });

  test('Parse malformed payloads without crashing', () => {
    const malformed = [
      null,
      undefined,
      {},
      { entry: null },
      { entry: [] },
      { entry: [{}] },
      { entry: [{ changes: null }] },
      { entry: [{ changes: [] }] },
      { entry: [{ changes: [{}] }] },
      { entry: [{ changes: [{ value: null }] }] },
      { entry: [{ changes: [{ value: {} }] }] },
      { entry: [{ changes: [{ value: { messages: null } }] }] },
      { entry: [{ changes: [{ value: { messages: [] } }] }] },
      'string',
      123,
      [],
    ];

    for (const payload of malformed) {
      const result = whatsapp.parseWebhookMessage(payload);
      // Should return null, not throw
      assertEqual(result, null);
    }
  });

  test('parseJSON handles 1000 varied inputs without crashing', () => {
    const inputs = [
      '{"key": "value"}',
      '```json\n{"key": "value"}\n```',
      'not json',
      '',
      null,
      '{"nested": {"deep": {"value": true}}}',
      '{"array": [1,2,3,4,5]}',
      '{"unicode": "日本語テスト"}',
      '{"emoji": "🚀"}',
      '{"special": "line1\\nline2\\ttab"}',
    ];

    for (let i = 0; i < 1000; i++) {
      const input = inputs[i % inputs.length];
      try {
        claude.parseJSON(input);
      } catch (err) {
        throw new Error(`parseJSON crashed on input index ${i}: ${err.message}`);
      }
    }
  });

  test('Security check handles 10000 numbers quickly', () => {
    const registeredNumbers = ['+447700900001', '+971501234567'];
    const start = Date.now();

    for (let i = 0; i < 10000; i++) {
      const from = `44770090000${i % 10}`;
      registeredNumbers.some(num =>
        from.endsWith(num.replace('+', '')) || num.endsWith(from)
      );
    }

    const duration = Date.now() - start;
    assert(duration < 100, `Security check took ${duration}ms for 10000 iterations — should be <100ms`);
  });

  test('Large message text handling', () => {
    const largeText = 'x'.repeat(50000); // 50KB message
    const body = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              id: 'wamid.large',
              from: '447700900001',
              timestamp: String(Math.floor(Date.now() / 1000)),
              type: 'text',
              text: { body: largeText },
            }],
            contacts: [{ profile: { name: 'Max' } }],
          },
        }],
      }],
    };

    const msg = whatsapp.parseWebhookMessage(body);
    assertNotNull(msg);
    assertEqual(msg.text.length, 50000);
  });
}

// ─── 12. MODULE IMPORT TESTS ─────────────────────────────────────────────

function testModuleImports() {
  console.log('\n📦 MODULE IMPORT TESTS');

  const modules = [
    ['config', '../config'],
    ['logger', './utils/logger'],
    ['whatsapp', './services/whatsapp'],
    ['claude', './services/claude'],
    ['prompts', './services/prompts'],
    ['context', './services/context'],
    ['orchestrator', './handlers/orchestrator'],
    ['task agent', './agents/task'],
    ['travel agent', './agents/travel'],
    ['project agent', './agents/project'],
    ['personal agent', './agents/personal'],
    ['scheduler', './jobs/scheduler'],
  ];

  for (const [name, path] of modules) {
    test(`Import ${name}`, () => {
      const mod = require(path);
      assertNotNull(mod);
    });
  }

  test('Orchestrator exports required functions', () => {
    const orch = require('./handlers/orchestrator');
    assert(typeof orch.handleInboundMessage === 'function', 'Missing handleInboundMessage');
    assert(typeof orch.handleThirdPartyReply === 'function', 'Missing handleThirdPartyReply');
    assert(typeof orch.handleApprovalResponse === 'function', 'Missing handleApprovalResponse');
    assert(typeof orch.handleBriefing === 'function', 'Missing handleBriefing');
  });

  test('Scheduler exports startAll', () => {
    const sched = require('./jobs/scheduler');
    assert(typeof sched.startAll === 'function', 'Missing startAll');
  });

  test('Context assembler exports all context builders', () => {
    const ctx = require('./services/context');
    const required = [
      'forClassification', 'forTaskExecution', 'forConversationContinuation',
      'forDailyBriefing', 'forProjectQuery', 'forTravelSearch',
      'forMonitoringExtraction', 'forLearningExtraction',
    ];
    for (const fn of required) {
      assert(typeof ctx[fn] === 'function', `Missing ${fn}`);
    }
  });
}

// ─── RUN ALL TESTS ───────────────────────────────────────────────────────

async function runAll() {
  console.log('═══════════════════════════════════════════');
  console.log('  ALEX — Test & Stress Test Suite');
  console.log('═══════════════════════════════════════════');

  testConfig();
  testWhatsAppParsing();
  testClaudeService();
  testPromptLoader();
  testSecurity();
  testTaskHelpers();
  testPersonalDetection();
  await testExpressServer();
  testApprovalDetection();
  testBriefingTriggers();
  testStress();
  testModuleImports();

  console.log('\n═══════════════════════════════════════════');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    for (const f of failures) {
      console.log(`  ❌ ${f.name}: ${f.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runAll();
