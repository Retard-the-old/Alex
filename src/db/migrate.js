const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const sqlPath = path.join(__dirname, '..', '..', 'migrations', 'Alex_Database_Migration.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration file not found: ${sqlPath}`);
    console.error('Place Alex_Database_Migration.sql in the migrations/ directory');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Running migration...');
  try {
    await pool.query(sql);
    console.log('Migration complete — 18 tables created, seed data loaded.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
