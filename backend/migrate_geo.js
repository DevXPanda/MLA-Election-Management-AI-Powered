const pool = require('./config/db');

async function migrate() {
  console.log('🔄 Starting Safe Full Geographical & Tenant Scope Migration...');
  
  // 1. Get a valid organization ID to use as default if needed
  let validOrgId = 1;
  try {
    const orgRes = await pool.query('SELECT id FROM organizations LIMIT 1');
    if (orgRes.rows.length > 0) {
      validOrgId = orgRes.rows[0].id;
    } else {
      // Create a default organization if none exists
      const createOrgRes = await pool.query("INSERT INTO organizations (name, slug) VALUES ('Default', 'default') RETURNING id");
      validOrgId = createOrgRes.rows[0].id;
    }
  } catch (err) {
    console.log('Using default org ID 1');
  }

  const queries = [
    // 1. Add organization_id and area_id as nullable first
    `ALTER TABLE booths ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)`,
    `ALTER TABLE wards ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)`,
    `ALTER TABLE areas ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id)`,
    
    // 2. Add area_id to all hierarchical tables
    `ALTER TABLE wards ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE booths ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES areas(id)`,

    // 3. Set default values for existing rows
    `UPDATE booths SET organization_id = ${validOrgId} WHERE organization_id IS NULL`,
    `UPDATE wards SET organization_id = ${validOrgId} WHERE organization_id IS NULL`,
    
    // 4. Denormalize hierarchy
    `ALTER TABLE booths ADD COLUMN IF NOT EXISTS constituency_id INTEGER REFERENCES constituencies(id)`,
    `ALTER TABLE surveys ADD COLUMN IF NOT EXISTS constituency_id INTEGER REFERENCES constituencies(id)`,
    
    // 5. Activity Logs & Hierarchy denormalization
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS constituency_id INTEGER REFERENCES constituencies(id)`,
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS ward_id INTEGER REFERENCES wards(id)`,
    `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS booth_id INTEGER REFERENCES booths(id)`,
    
    // 6. Targeted Messaging & Media
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS constituency_id INTEGER REFERENCES constituencies(id)`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS ward_id INTEGER REFERENCES wards(id)`,
    `ALTER TABLE messages ADD COLUMN IF NOT EXISTS booth_id INTEGER REFERENCES booths(id)`,
    
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS constituency_id INTEGER REFERENCES constituencies(id)`,
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS ward_id INTEGER REFERENCES wards(id)`,
    `ALTER TABLE media ADD COLUMN IF NOT EXISTS booth_id INTEGER REFERENCES booths(id)`,

    // 7. Backfill missing hierarchy ids
    `UPDATE booths b SET constituency_id = w.constituency_id 
     FROM wards w 
     WHERE b.ward_id = w.id AND b.constituency_id IS NULL`,
    
    `UPDATE surveys s SET constituency_id = b.constituency_id 
     FROM booths b 
     WHERE s.booth_id = b.id AND s.constituency_id IS NULL`,

    // 8. Performance Indexes
    `CREATE INDEX IF NOT EXISTS idx_voters_hierarchy ON voters(organization_id, constituency_id, area_id, ward_id, booth_id)`,
    `CREATE INDEX IF NOT EXISTS idx_surveys_hierarchy ON surveys(organization_id, constituency_id, area_id, ward_id, booth_id)`,
    `CREATE INDEX IF NOT EXISTS idx_booths_hierarchy ON booths(organization_id, constituency_id, area_id, ward_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_hierarchy ON tasks(organization_id, constituency_id, area_id, ward_id, booth_id)`
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
      console.log(`✅ Success: ${q.substring(0, 50)}...`);
    } catch (err) {
      if (err.code === '42701') {
        console.log(`ℹ️ Column already exists, skipping...`);
      } else {
        console.error(`❌ Error in query: ${q}`);
        console.error(err.message);
      }
    }
  }

  console.log('🚀 Database is now fully synchronized with role-based scopes!');
  process.exit(0);
}

migrate();
