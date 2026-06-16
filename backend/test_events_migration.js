require('dotenv').config();
const pool = require('./config/db');

async function checkMigration() {
  try {
    console.log('Checking events table schema...');
    
    // Attempt manual migration if not run yet
    await pool.query(`
      ALTER TABLE events ADD COLUMN IF NOT EXISTS feedback JSONB;
    `);
    
    const colsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'events' AND column_name = 'feedback'
    `);
    
    if (colsRes.rows.length > 0) {
      console.log('✅ Column feedback exists on events table:');
      console.log(colsRes.rows[0]);
    } else {
      console.error('❌ Column feedback is missing from events table');
    }
  } catch (err) {
    console.error('Error during migration check:', err);
  } finally {
    await pool.end();
  }
}

checkMigration();
