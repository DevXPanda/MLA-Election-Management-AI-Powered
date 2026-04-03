const pool = require('./config/db');

async function debug() {
  const tables = ['surveys', 'booths', 'events', 'activity_logs', 'voters', 'tasks', 'team_members', 'users'];
  
  for (const table of tables) {
    console.log(`\n--- TABLE: ${table} ---`);
    try {
      const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY column_name
      `, [table]);
      
      const columns = res.rows.map(r => r.column_name);
      console.log('Columns:', columns.join(', '));
      
      const missing = [];
      if (!columns.includes('organization_id')) missing.push('organization_id');
      if (!columns.includes('constituency_id')) missing.push('constituency_id');
      if (!columns.includes('ward_id')) missing.push('ward_id');
      if (!columns.includes('booth_id')) missing.push('booth_id');
      
      if (missing.length) {
        console.warn(`⚠️ MISSING: ${missing.join(', ')}`);
      } else {
        console.log('✅ All scope columns present.');
      }
    } catch (err) {
      console.error(`❌ Error checking ${table}:`, err.message);
    }
  }
  process.exit(0);
}

debug();
