require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  },

  // Max's registered numbers — only these can interact with Alex
  registeredNumbers: (process.env.MAX_REGISTERED_NUMBERS || '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean),

  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    modelSmart: process.env.CLAUDE_MODEL_SMART || 'claude-opus-4-5-20250514',
    modelFast: process.env.CLAUDE_MODEL_FAST || 'claude-sonnet-4-5-20250514',
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
  },

  duffel: {
    token: process.env.DUFFEL_API_TOKEN,
  },

  serp: {
    apiKey: process.env.SERP_API_KEY,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  timezone: process.env.TIMEZONE || 'Asia/Dubai',

  briefing: {
    hour: parseInt(process.env.BRIEFING_HOUR || '11'),
    minute: parseInt(process.env.BRIEFING_MINUTE || '30'),
  },

  // External chat API — used by developer integrations (e.g. WhatsApp backend)
  chatApiKey: process.env.CHAT_API_KEY,
};
