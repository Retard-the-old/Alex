const { Pool } = require('pg');
const config = require('../../config');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: config.database.url,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

/**
 * Run a parameterised query
 * @param {string} text - SQL query with $1, $2, etc.
 * @param {Array} params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query', { text: text.substring(0, 100), duration });
    }
    return result;
  } catch (err) {
    logger.error('Query error', { text: text.substring(0, 100), error: err.message });
    throw err;
  }
}

/**
 * Run a single-row query, return the row or null
 */
async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

/**
 * Run a query, return all rows
 */
async function queryAll(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

/**
 * Get a client for transactions
 */
async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, queryOne, queryAll, getClient };
