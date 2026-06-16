require('dotenv').config();
const pool = require('./config/db');

async function runMigration() {
  try {
    console.log('Running manual migration to add help_preference...');
    await pool.query(`
      ALTER TABLE party_members ADD COLUMN IF NOT EXISTS help_preference TEXT;
    `);
    console.log('✅ Alter table statement executed.');

    // Check again
    const colsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'party_members' AND column_name = 'help_preference'
    `);
    
    if (colsRes.rows.length > 0) {
      console.log('✅ Column help_preference exists now:');
      console.log(colsRes.rows[0]);
    } else {
      console.error('❌ Column help_preference is still missing');
    }
  } catch (err) {
    console.error('❌ Error during manual migration:', err);
  } finally {
    await pool.end();
  }
}

runMigration();
