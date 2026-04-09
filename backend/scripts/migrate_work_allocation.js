const pool = require('../config/db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('--- Starting Migration: Work Allocation Execution Tracking ---');
    
    await client.query(`
      ALTER TABLE work_allocations 
      ADD COLUMN IF NOT EXISTS not_completed_reason TEXT,
      ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS before_image_url TEXT,
      ADD COLUMN IF NOT EXISTS after_image_url TEXT,
      ADD COLUMN IF NOT EXISTS geo_location_before JSONB,
      ADD COLUMN IF NOT EXISTS geo_location_after JSONB
    `);
    
    console.log('✅ Columns added successfully to work_allocations');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    process.exit();
  }
}

migrate();
