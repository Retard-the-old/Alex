const claude = require('../services/claude');
const context = require('../services/context');
const prompts = require('../services/prompts');
const whatsapp = require('../services/whatsapp');
const db = require('../db/pool');
const logger = require('../utils/logger');

/**
 * TRAVEL AGENT
 * Handles: flight search, hotel search, booking, amendments, cancellations
 *
 * NOTE: Duffel API integration is a placeholder — the developer needs to
 * implement the actual Duffel SDK calls for search, offers, and orders.
 */
async function handle(from, text, message) {
  const travelContext = await context.forTravelSearch();

  const response = await claude.call({
    callType: 'travel_search',
    systemPrompt: prompts.PROMPTS.travel(),
    userMessage: `MAX'S INSTRUCTION: "${text}"\n\n${travelContext}\n\nNote: Search Duffel for matching flights/hotels. Present top 3-5 options ranked per the Travel Agent ranking criteria. If you don't have live search results, present what Max should expect and ask to confirm search parameters.`,
    maxTokens: 3000,
  });

  // Create task
  const taskType = text.toLowerCase().includes('hotel') ? 'hotel_search' : 'flight_search';
  await db.query(`
    INSERT INTO tasks (type, description, status, channel)
    VALUES ($1, $2, 'in_progress', 'whatsapp')
  `, [taskType, text]);

  await whatsapp.sendMessage(from, response);

  // TODO: Implement actual Duffel API integration
  // The flow is:
  // 1. Parse Claude's response for search parameters
  // 2. Call Duffel offer_requests.create() with parameters
  // 3. Get offers back
  // 4. Format and present to Max via Claude
  // 5. On Max's selection: Duffel orders.create()
  // 6. Handle payment via Duffel Payment Intents
  // 7. Create Google Calendar events
  // 8. Store in travel_bookings table
}

module.exports = { handle };
