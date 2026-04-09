const pool = require('./config/db');
const bcrypt = require('bcryptjs');
const { createTables } = require('./models');

const seedDatabase = async () => {
  console.log('🌱 Starting database seeding (v2.0 - Multi-Tenant)...\n');

  try {
    // Step 1: Create tables
    await createTables();
    console.log('✅ Tables ready\n');

    // Step 2: Seed default organization
    const orgResult = await pool.query(
      `INSERT INTO organizations (name, slug, state, district, contact_email)
       VALUES ('Mission FTC - Default', 'mission-ftc-default', 'Uttar Pradesh', 'Lucknow', 'admin@missionftc.com')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`
    );
    const orgId = orgResult.rows[0].id;
    console.log(`✅ Organization seeded (ID: ${orgId})`);

    // Step 3: Insert roles
    const roles = [
      { name: 'super_admin', display_name: 'Super Admin', description: 'Full system access across all organizations' },
      { name: 'mla', display_name: 'MLA / Candidate', description: 'Constituency leader — tied to one organization' },
      { name: 'campaign_manager', display_name: 'Campaign Manager', description: 'Campaign oversight — constituency-level access' },
      { name: 'ward_head', display_name: 'Ward Head', description: 'Ward-level operations' },
      { name: 'booth_worker', display_name: 'Booth Worker', description: 'Field-level worker — booth-level access only' },
    ];

    for (const role of roles) {
      await pool.query(
        `INSERT INTO roles (name, display_name, description) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET display_name = $2, description = $3`,
        [role.name, role.display_name, role.description]
      );
    }
    console.log('✅ Roles seeded');

    // Step 4: Get role IDs
    const rolesResult = await pool.query('SELECT id, name FROM roles');
    const roleMap = {};
    rolesResult.rows.forEach(r => roleMap[r.name] = r.id);

    // Step 5: Geographical hierarchy
    const stateResult = await pool.query(
      `INSERT INTO states (name, code) VALUES ('Uttar Pradesh', 'UP')
       ON CONFLICT (code) DO UPDATE SET name = 'Uttar Pradesh' RETURNING id`
    );
    const stateId = stateResult.rows[0].id;

    const districtResult = await pool.query(
      `INSERT INTO districts (name, state_id) VALUES ('Lucknow', $1) 
       ON CONFLICT (name, state_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [stateId]
    );
    const districtId = districtResult.rows[0].id;

    const constituencyResult = await pool.query(
      `INSERT INTO constituencies (name, number, district_id, mla_name) 
       VALUES ('Lucknow Central', '401', $1, 'Rajesh Kumar') 
       ON CONFLICT (name, number, district_id) DO UPDATE SET mla_name = EXCLUDED.mla_name RETURNING id`, [districtId]
    );
    const constituencyId = constituencyResult.rows[0].id;

    // Step 5.1: Seed Areas
    const areas = ['Urban Center', 'Industrial Hub', 'Residential Colony', 'Rural Belt'];
    const areaIds = [];
    for (let i = 0; i < areas.length; i++) {
        const aRes = await pool.query(
            `INSERT INTO areas (name, constituency_id) VALUES ($1, $2)
             ON CONFLICT (name, constituency_id) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
            [areas[i], constituencyId]
        );
        areaIds.push(aRes.rows[0].id);
    }
    console.log('✅ Areas seeded');

    const wards = ['Ward 1 - Aminabad', 'Ward 2 - Chowk', 'Ward 3 - Hazratganj', 'Ward 4 - Alambagh'];
    const wardIds = [];
    for (let i = 0; i < wards.length; i++) {
      const wRes = await pool.query(
        `INSERT INTO wards (name, number, constituency_id, area_id) VALUES ($1, $2, $3, $4) 
         ON CONFLICT (name, number, constituency_id) DO UPDATE SET area_id = EXCLUDED.area_id RETURNING id`,
        [wards[i], String(i + 1), constituencyId, areaIds[i % areaIds.length]]
      );
      wardIds.push(wRes.rows[0].id);
    }

    const boothIds = [];
    for (let w = 0; w < wardIds.length; w++) {
      for (let b = 1; b <= 3; b++) {
        const bRes = await pool.query(
          `INSERT INTO booths (name, number, ward_id, address) VALUES ($1, $2, $3, $4) 
           ON CONFLICT (name, number, ward_id) DO UPDATE SET address = EXCLUDED.address RETURNING id`,
          [`Booth ${w * 3 + b}`, String(w * 3 + b), wardIds[w], `Near ${wards[w]} Market`]
        );
        boothIds.push(bRes.rows[0].id);
      }
    }
    console.log('✅ Geography seeded (1 State, 1 District, 1 Constituency, 4 Areas, 4 Wards, 12 Booths)');

    // Step 6: Insert users (with organization_id)
    const passwordHash = await bcrypt.hash('admin123', 10);

    const users = [
      { name: 'Admin User', email: 'admin@missionftc.com', phone: '9876543210', role: 'super_admin', area_idx: null, ward_idx: null, booth_idx: null },
      { name: 'Rajesh Kumar', email: 'mla@missionftc.com', phone: '9876543211', role: 'mla', area_idx: null, ward_idx: null, booth_idx: null },
      { name: 'Amit Sharma', email: 'manager@missionftc.com', phone: '9876543212', role: 'campaign_manager', area_idx: 0, ward_idx: null, booth_idx: null },
      { name: 'Priya Singh', email: 'ward1@missionftc.com', phone: '9876543213', role: 'ward_head', area_idx: 0, ward_idx: 0, booth_idx: null },
      { name: 'Rahul Verma', email: 'ward2@missionftc.com', phone: '9876543214', role: 'ward_head', area_idx: 1, ward_idx: 1, booth_idx: null },
      { name: 'Suresh Yadav', email: 'worker1@missionftc.com', phone: '9876543215', role: 'booth_worker', area_idx: 0, ward_idx: 0, booth_idx: 0 },
      { name: 'Neha Gupta', email: 'worker2@missionftc.com', phone: '9876543216', role: 'booth_worker', area_idx: 1, ward_idx: 1, booth_idx: 3 },
      { name: 'Vikram Tiwari', email: 'worker3@missionftc.com', phone: '9876543217', role: 'booth_worker', area_idx: 2, ward_idx: 2, booth_idx: 6 },
    ];

    const userIds = [];
    for (const u of users) {
      const res = await pool.query(
        `INSERT INTO users (name, email, phone, password_hash, role_id, constituency_id, area_id, ward_id, booth_id, organization_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
         ON CONFLICT (email) DO UPDATE SET 
          name = EXCLUDED.name, 
          phone = EXCLUDED.phone,
          role_id = EXCLUDED.role_id,
          constituency_id = EXCLUDED.constituency_id,
          area_id = EXCLUDED.area_id,
          ward_id = EXCLUDED.ward_id,
          booth_id = EXCLUDED.booth_id,
          organization_id = EXCLUDED.organization_id
         RETURNING id`,
        [u.name, u.email, u.phone, passwordHash, roleMap[u.role], constituencyId,
         u.area_idx !== null ? areaIds[u.area_idx] : null,
         u.ward_idx !== null ? wardIds[u.ward_idx] : null,
         u.booth_idx !== null ? boothIds[u.booth_idx] : null,
         orgId]
      );
      userIds.push(res.rows[0].id);
    }
    console.log('✅ Users seeded (8 users with ward/booth assignments, password: admin123)');

    // Step 7: Survey Issues
    const issues = [
      { name: 'Water Supply', category: 'Infrastructure' },
      { name: 'Road Condition', category: 'Infrastructure' },
      { name: 'Electricity', category: 'Utilities' },
      { name: 'Drainage', category: 'Infrastructure' },
      { name: 'Healthcare', category: 'Public Services' },
      { name: 'Education', category: 'Public Services' },
      { name: 'Employment', category: 'Economy' },
      { name: 'Security', category: 'Law & Order' },
      { name: 'Sanitation', category: 'Infrastructure' },
      { name: 'Public Transport', category: 'Infrastructure' },
    ];

    const issueIds = [];
    for (const issue of issues) {
      const res = await pool.query(
        `INSERT INTO survey_issues (name, category) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET category = $2 RETURNING id`,
        [issue.name, issue.category]
      );
      issueIds.push(res.rows[0].id);
    }
    console.log('✅ Survey issues seeded (10 issues)');

    // Step 8: Voters (with organization_id)
    const voterNames = ['Arun Kumar', 'Geeta Devi', 'Mohan Lal', 'Sita Ram', 'Kamla Devi',
      'Ram Prasad', 'Sunita Kumari', 'Vinod Kumar', 'Meena Devi', 'Harish Chandra',
      'Lakshmi Devi', 'Sunil Kumar', 'Asha Devi', 'Rajendra Prasad', 'Savita Kumari'];
    const genders = ['male', 'female', 'male', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female', 'male', 'female'];
    const castes = ['General', 'OBC', 'SC', 'ST', 'General'];
    const statuses = ['supporter', 'neutral', 'opponent', 'unknown', 'supporter', 'supporter'];

    const voterIds = [];
    for (let i = 0; i < voterNames.length; i++) {
      const res = await pool.query(
        `INSERT INTO voters (name, phone, age, gender, booth_id, ward_id, area_id, constituency_id, caste, support_status, scheme_beneficiary, created_by, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [voterNames[i], `98765${String(43220 + i)}`, 25 + (i * 3) % 40, genders[i],
         boothIds[i % boothIds.length], wardIds[i % wardIds.length], areaIds[i % areaIds.length], constituencyId,
         castes[i % castes.length], statuses[i % statuses.length], i % 3 === 0, userIds[0], orgId]
      );
      voterIds.push(res.rows[0].id);
    }
    console.log('✅ Voters seeded (15 voters)');

    // Step 9: Surveys (with organization_id)
    for (let i = 0; i < 10; i++) {
      const surveyRes = await pool.query(
        `INSERT INTO surveys (voter_id, booth_id, ward_id, area_id, surveyor_id, support_status, satisfaction_level, remarks, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [voterIds[i], boothIds[i % boothIds.length], wardIds[i % wardIds.length], areaIds[i % areaIds.length],
         userIds[5 + (i % 3)], statuses[i % statuses.length], (i % 5) + 1,
         'Sample survey remarks for voter ' + voterNames[i], orgId]
      );
      const numIssues = 2 + (i % 2);
      for (let j = 0; j < numIssues; j++) {
        await pool.query(
          'INSERT INTO survey_responses (survey_id, issue_id, severity) VALUES ($1, $2, $3)',
          [surveyRes.rows[0].id, issueIds[(i + j) % issueIds.length], (j % 5) + 1]
        );
      }
    }
    console.log('✅ Surveys seeded (10 surveys with responses)');

    // Step 10: Tasks (with organization_id)
    const taskTypes = ['door_to_door', 'survey_collection', 'event_participation', 'voter_outreach', 'report_submission'];
    const taskStatuses = ['pending', 'in_progress', 'completed', 'pending', 'completed', 'in_progress'];
    const priorities = ['high', 'medium', 'low'];

    for (let i = 0; i < 12; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (i * 2) - 5);
      await pool.query(
        `INSERT INTO tasks (title, description, type, assigned_to, assigned_by, booth_id, ward_id, area_id, constituency_id, priority, status, due_date, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [`Task ${i + 1}: ${taskTypes[i % taskTypes.length].replace(/_/g, ' ')}`,
         `Complete ${taskTypes[i % taskTypes.length].replace(/_/g, ' ')} for assigned area`,
         taskTypes[i % taskTypes.length], userIds[4 + (i % 4)], userIds[2],
         boothIds[i % boothIds.length], wardIds[i % wardIds.length], areaIds[i % areaIds.length], constituencyId,
         priorities[i % priorities.length], taskStatuses[i % taskStatuses.length], dueDate, orgId]
      );
    }
    console.log('✅ Tasks seeded (12 tasks)');

    // Step 11: Events (with organization_id)
    const eventTypes = ['rally', 'nukkad_sabha', 'door_to_door', 'public_meeting'];
    for (let i = 0; i < 5; i++) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + (i * 5) - 2);
      const eventRes = await pool.query(
        `INSERT INTO events (title, type, description, event_date, location, constituency_id, area_id, expected_attendance, status, created_by, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
        [`Campaign Event ${i + 1}`, eventTypes[i % eventTypes.length],
         `Campaign ${eventTypes[i % eventTypes.length].replace(/_/g, ' ')} event in ${wards[i % wards.length]}`,
         eventDate, `${wards[i % wards.length]} Ground`, constituencyId, areaIds[i % areaIds.length],
         50 + (i * 30), i >= 3 ? 'upcoming' : i === 0 ? 'completed' : 'upcoming', userIds[1], orgId]
      );
      for (let p = 4; p < 8; p++) {
        await pool.query(
          `INSERT INTO event_participants (event_id, user_id, role_in_event, attended)
           VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
          [eventRes.rows[0].id, userIds[p], p < 6 ? 'coordinator' : 'volunteer', i === 0]
        );
      }
    }
    console.log('✅ Events seeded (5 events with participants)');

    // Step 12: Team members (with organization_id)
    for (let i = 4; i < 8; i++) {
      await pool.query(
        `INSERT INTO team_members (user_id, team_leader_id, constituency_id, area_id, ward_id, booth_id, designation, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userIds[i], userIds[2], constituencyId, areaIds[(i - 4) % areaIds.length], wardIds[(i - 4) % wardIds.length],
         boothIds[(i - 4) * 2 % boothIds.length],
         i < 6 ? 'Ward Coordinator' : 'Booth Level Agent', orgId]
      );
    }
    console.log('✅ Team members seeded');

    // Step 13: Activity logs (with organization_id)
    const actions = ['USER_LOGIN', 'SURVEY_SUBMITTED', 'TASK_CREATED', 'VOTER_ADDED', 'EVENT_CREATED'];
    for (let i = 0; i < 15; i++) {
      await pool.query(
        `INSERT INTO activity_logs (user_id, action, module, details, organization_id, area_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userIds[i % userIds.length], actions[i % actions.length],
         ['auth', 'surveys', 'tasks', 'voters', 'events'][i % 5],
         JSON.stringify({ note: `Sample activity ${i + 1}` }), orgId, areaIds[i % areaIds.length]]
      );
    }
    console.log('✅ Activity logs seeded');

    // Step 14: Messages (with organization_id)
    await pool.query(
      `INSERT INTO messages (title, content, sent_by, target_type, channel, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['Welcome to Mission FTC v2.0', 'All team members please complete your profile and start surveys. Multi-tenant is live!', userIds[0], 'all', 'push', orgId]
    );
    console.log('✅ Sample message seeded');

    console.log('\n🎉 Database seeding completed successfully! (v2.0 Multi-Tenant)');
    console.log('\n📋 Login Credentials:');
    console.log('   Admin:    admin@missionftc.com / admin123');
    console.log('   MLA:      mla@missionftc.com / admin123');
    console.log('   Manager:  manager@missionftc.com / admin123');
    console.log('   Workers:  worker1@missionftc.com / admin123');
    console.log('\n🏢 Organization:  Mission FTC - Default (ID: ' + orgId + ')');

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
    process.exit();
  }
};

seedDatabase();
