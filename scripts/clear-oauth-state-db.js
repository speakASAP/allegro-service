const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || process.env.DATABASE_URL?.match(/@([^:]+):/)?.[1],
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || process.env.DATABASE_URL?.match(/:\/\/([^:]+):/)?.[1],
  password: process.env.DB_PASSWORD || process.env.DATABASE_URL?.match(/:\/\/[^:]+:([^@]+)@/)?.[1],
  database: process.env.DB_NAME || process.env.DATABASE_URL?.match(/\/\/([^?]+)/)?.[1]?.split('/').pop(),
});

async function clearOAuthState() {
  try {
    await client.connect();
    const result = await client.query(
      'UPDATE user_settings SET allegro_oauth_state = NULL, allegro_oauth_code_verifier = NULL'
    );
    console.log(`Cleared OAuth state for ${result.rowCount} user(s)`);
  } catch (error) {
    console.error('Error clearing OAuth state:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

clearOAuthState();

