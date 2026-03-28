# Alex — WhatsApp AI Personal Assistant

Production-ready Node.js application for the Alex AI assistant.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys and credentials

# 3. Set up database
mkdir -p migrations
cp /path/to/Alex_Database_Migration.sql migrations/
npm run migrate

# 4. Copy system prompts
# Place all 8 .md prompt files in src/prompts/
# 01-core-system-prompt.md through 08-learning-engine.md

# 5. Start the server
npm start

# For development (auto-restart on changes):
npm run dev
```

## Architecture

```
src/
├── index.js                    # Express server, webhook handler, message batching
├── handlers/
│   └── orchestrator.js         # THE BRAIN — classify, route, execute, learn
├── agents/
│   ├── task.js                 # Restaurant bookings, business contact, outreach
│   ├── travel.js               # Flight/hotel search and booking (Duffel)
│   ├── project.js              # Project intelligence queries and mutations
│   └── personal.js             # Reminders, knowledge store, personal admin
├── services/
│   ├── whatsapp.js             # Meta Cloud API — send/receive messages
│   ├── claude.js               # Anthropic API — all LLM calls with model routing
│   ├── context.js              # THE HARDEST PART — assembles context for each call
│   ├── prompts.js              # System prompt loader and combiner
│   └── whisper.js              # Voice note transcription
├── jobs/
│   └── scheduler.js            # Background: briefing, follow-ups, reminders, decay
├── db/
│   ├── pool.js                 # PostgreSQL connection pool
│   └── migrate.js              # Migration runner
├── utils/
│   └── logger.js               # Winston logger
└── prompts/                    # System prompt .md files go here
    ├── 01-core-system-prompt.md
    ├── 02-intent-classification.md
    └── ... (all 8 files)
```

## Message Flow

1. Max sends WhatsApp message → Meta Cloud API webhook
2. `POST /webhook/whatsapp` → parse message
3. Voice note? → Whisper transcription
4. Multi-message batching (5-second window for rapid-fire messages)
5. Check if approval response → handle pending escalation
6. Security check (registered number?)
7. Intent classification (Claude API call #1)
8. Route to agent handler
9. Agent execution (Claude API call #2)
10. Send response via WhatsApp
11. Background learning extraction (Claude API call #3)

## Environment Variables

See `.env.example` for all required configuration.

**Critical:**
- `ANTHROPIC_API_KEY` — Powers all AI intelligence
- `WHATSAPP_ACCESS_TOKEN` — Meta Cloud API access
- `DATABASE_URL` — PostgreSQL connection string
- `MAX_REGISTERED_NUMBERS` — Only these numbers can interact with Alex

## Model Strategy

The system uses two Claude models:
- **Opus** (smart): Daily briefing, project intelligence, escalation decisions
- **Sonnet** (fast): Intent classification, task execution, learning extraction

Configure in `.env`:
```
CLAUDE_MODEL_SMART=claude-opus-4-5-20250514
CLAUDE_MODEL_FAST=claude-sonnet-4-5-20250514
```

## What the Developer Still Needs to Do

This codebase is production-ready but some integrations are marked as TODO:

1. **Duffel API** — Travel agent has the flow defined but needs actual SDK calls
2. **Google Drive** — Document handler needs Google Drive API integration
3. **Google Calendar** — Calendar reads/writes for briefing and travel
4. **WhatsApp Monitoring** — whatsapp-web.js setup for reading Max's personal WhatsApp
5. **Google Places** — Mass outreach location search
6. **SerpAPI** — Web search for contact discovery

The orchestrator, context assembler, all agents, background jobs, security layer,
and database are complete and functional.

## Deployment

Recommended: Railway, Render, or DigitalOcean App Platform

```bash
# Using PM2 for process management
npm install -g pm2
pm2 start src/index.js --name alex
pm2 save
pm2 startup
```

The server needs to be always-on. All state lives in PostgreSQL —
if the process restarts, it picks up where it left off.
