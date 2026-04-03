const { Pool } = require('pg');
const dns = require('dns');
require('dotenv').config();

// Force IPv4 — Render/Railway free tiers cannot reach IPv6 hosts
dns.setDefaultResultOrder('ipv4first');

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'mla_election_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error (Handled):', err);
  // Remove process.exit to prevent server crash on minor DB drops
});

module.exports = pool;
