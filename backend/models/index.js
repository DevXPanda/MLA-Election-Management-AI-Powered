const pool = require('../config/db');

const createTables = async () => {
  const queries = `
    -- Organizations table (Multi-Tenant)
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      logo_url TEXT,
      state VARCHAR(100),
      district VARCHAR(100),
      contact_email VARCHAR(150),
      contact_phone VARCHAR(15),
      plan VARCHAR(20) DEFAULT 'basic',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Roles table
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) UNIQUE NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      permissions JSONB DEFAULT '{}',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- States table
    CREATE TABLE IF NOT EXISTS states (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(10) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Districts table
    CREATE TABLE IF NOT EXISTS districts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      state_id INTEGER REFERENCES states(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, state_id)
    );

    -- Constituencies table
    CREATE TABLE IF NOT EXISTS constituencies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      number VARCHAR(20),
      district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
      mla_name VARCHAR(150),
      total_voters INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, number, district_id)
    );

    -- Areas table
    CREATE TABLE IF NOT EXISTS areas (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      constituency_id INTEGER REFERENCES constituencies(id) ON DELETE CASCADE,
      manager_id INTEGER REFERENCES users(id),
      total_voters INTEGER DEFAULT 0,
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, constituency_id)
    );

    -- Wards table
    CREATE TABLE IF NOT EXISTS wards (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      number VARCHAR(20),
      constituency_id INTEGER REFERENCES constituencies(id) ON DELETE CASCADE,
      area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
      ward_head_id INTEGER REFERENCES users(id),
      total_voters INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, number, constituency_id)
    );

    -- Booths table
    CREATE TABLE IF NOT EXISTS booths (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      number VARCHAR(20),
      ward_id INTEGER REFERENCES wards(id) ON DELETE CASCADE,
      address TEXT,
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      total_voters INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, number, ward_id)
    );

    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE,
      phone VARCHAR(15),
      password_hash VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      role_id INTEGER REFERENCES roles(id),
      constituency_id INTEGER REFERENCES constituencies(id),
      area_id INTEGER REFERENCES areas(id),
      ward_id INTEGER REFERENCES wards(id),
      booth_id INTEGER REFERENCES booths(id),
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      status VARCHAR(20) DEFAULT 'active',
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Voters table
    CREATE TABLE IF NOT EXISTS voters (
      id SERIAL PRIMARY KEY,
      voter_id_number VARCHAR(50),
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(15),
      address TEXT,
      age INTEGER,
      gender VARCHAR(10),
      booth_id INTEGER REFERENCES booths(id),
      ward_id INTEGER REFERENCES wards(id),
      area_id INTEGER REFERENCES areas(id),
      constituency_id INTEGER REFERENCES constituencies(id),
      caste VARCHAR(100),
      scheme_beneficiary BOOLEAN DEFAULT false,
      scheme_details TEXT,
      support_status VARCHAR(20) DEFAULT 'unknown',
      remarks TEXT,
      created_by INTEGER REFERENCES users(id),
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Survey Issues
    CREATE TABLE IF NOT EXISTS survey_issues (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      category VARCHAR(50),
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Surveys table
    CREATE TABLE IF NOT EXISTS surveys (
      id SERIAL PRIMARY KEY,
      voter_id INTEGER REFERENCES voters(id),
      booth_id INTEGER REFERENCES booths(id),
      ward_id INTEGER REFERENCES wards(id),
      area_id INTEGER REFERENCES areas(id),
      constituency_id INTEGER REFERENCES constituencies(id),
      surveyor_id INTEGER REFERENCES users(id),
      support_status VARCHAR(20) NOT NULL,
      satisfaction_level INTEGER CHECK (satisfaction_level BETWEEN 1 AND 5),
      remarks TEXT,
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Survey Responses
    CREATE TABLE IF NOT EXISTS survey_responses (
      id SERIAL PRIMARY KEY,
      survey_id INTEGER REFERENCES surveys(id) ON DELETE CASCADE,
      issue_id INTEGER REFERENCES survey_issues(id) ON DELETE CASCADE,
      severity INTEGER CHECK (severity BETWEEN 1 AND 5),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Events table
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT,
      event_date TIMESTAMP NOT NULL,
      location TEXT,
      constituency_id INTEGER REFERENCES constituencies(id),
      area_id INTEGER REFERENCES areas(id),
      ward_id INTEGER REFERENCES wards(id),
      booth_id INTEGER REFERENCES booths(id),
      expected_attendance INTEGER DEFAULT 0,
      actual_attendance INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'upcoming',
      media_urls JSONB DEFAULT '[]',
      created_by INTEGER REFERENCES users(id),
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      assigned_to INTEGER REFERENCES users(id),
      assigned_by INTEGER REFERENCES users(id),
      booth_id INTEGER REFERENCES booths(id),
      ward_id INTEGER REFERENCES wards(id),
      area_id INTEGER REFERENCES areas(id),
      constituency_id INTEGER REFERENCES constituencies(id),
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(20) DEFAULT 'pending',
      due_date DATE,
      completed_at TIMESTAMP,
      remarks TEXT,
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Work Allocations table (Event-specific tasks)
    CREATE TABLE IF NOT EXISTS work_allocations (
      id SERIAL PRIMARY KEY,
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      work_type VARCHAR(100) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      not_completed_reason TEXT,
      due_date TIMESTAMP,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      before_image_url TEXT,
      after_image_url TEXT,
      geo_location_before JSONB,
      geo_location_after JSONB,
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Work Allocation Users (Multiple users per work)
    CREATE TABLE IF NOT EXISTS work_allocation_users (
      work_allocation_id INTEGER REFERENCES work_allocations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (work_allocation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS task_activity_log (
      id SERIAL PRIMARY KEY,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      action VARCHAR(80) NOT NULL,
      details JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS work_allocation_proofs (
      id SERIAL PRIMARY KEY,
      work_allocation_id INTEGER REFERENCES work_allocations(id) ON DELETE CASCADE,
      category VARCHAR(20) NOT NULL,
      image_url TEXT NOT NULL,
      geo_location JSONB,
      uploaded_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_participants (
      event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_in_event VARCHAR(80),
      attended BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (event_id, user_id)
    );

    -- Activity Logs
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      task_id INTEGER REFERENCES tasks(id),
      action VARCHAR(100) NOT NULL,
      module VARCHAR(50),
      activity_type VARCHAR(50),
      geo_location TEXT,
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(45),
      constituency_id INTEGER REFERENCES constituencies(id),
      area_id INTEGER REFERENCES areas(id),
      ward_id INTEGER REFERENCES wards(id),
      booth_id INTEGER REFERENCES booths(id),
      organization_id INTEGER REFERENCES organizations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Team Members
    CREATE TABLE IF NOT EXISTS team_members (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      team_leader_id INTEGER REFERENCES users(id),
      constituency_id INTEGER REFERENCES constituencies(id),
      area_id INTEGER REFERENCES areas(id),
      ward_id INTEGER REFERENCES wards(id),
      booth_id INTEGER REFERENCES booths(id),
      designation VARCHAR(100),
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) DEFAULT 'active',
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      sent_by INTEGER REFERENCES users(id),
      target_type VARCHAR(20) NOT NULL DEFAULT 'custom',
      target_id INTEGER,
      constituency_id INTEGER REFERENCES constituencies(id),
      area_id INTEGER REFERENCES areas(id),
      ward_id INTEGER REFERENCES wards(id),
      booth_id INTEGER REFERENCES booths(id),
      channel VARCHAR(20) DEFAULT 'push',
      status VARCHAR(20) DEFAULT 'sent',
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Media Library
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200),
      file_url TEXT NOT NULL,
      file_type VARCHAR(20) NOT NULL,
      file_size INTEGER,
      category VARCHAR(50),
      uploaded_by INTEGER REFERENCES users(id),
      constituency_id INTEGER REFERENCES constituencies(id),
      area_id INTEGER REFERENCES areas(id),
      ward_id INTEGER REFERENCES wards(id),
      booth_id INTEGER REFERENCES booths(id),
      download_count INTEGER DEFAULT 0,
      organization_id INTEGER REFERENCES organizations(id) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'info',
      link TEXT,
      is_read BOOLEAN DEFAULT false,
      organization_id INTEGER REFERENCES organizations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Migration: Add missing columns to existing tables
    DO $$ 
    BEGIN 
        -- Areas column to Wards
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wards' AND column_name='area_id') THEN
            ALTER TABLE wards ADD COLUMN area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL;
        END IF;
        
        -- Ward Head to Wards
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wards' AND column_name='ward_head_id') THEN
            ALTER TABLE wards ADD COLUMN ward_head_id INTEGER REFERENCES users(id);
        END IF;

        -- Area ID to Users
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='area_id') THEN
            ALTER TABLE users ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Voters
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='voters' AND column_name='area_id') THEN
            ALTER TABLE voters ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Surveys
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='surveys' AND column_name='area_id') THEN
            ALTER TABLE surveys ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Events
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='events' AND column_name='area_id') THEN
            ALTER TABLE events ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Tasks
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='area_id') THEN
            ALTER TABLE tasks ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Activity Logs
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='area_id') THEN
            ALTER TABLE activity_logs ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Team Members
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='team_members' AND column_name='area_id') THEN
            ALTER TABLE team_members ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Messages
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='area_id') THEN
            ALTER TABLE messages ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Area ID to Media
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='media' AND column_name='area_id') THEN
            ALTER TABLE media ADD COLUMN area_id INTEGER REFERENCES areas(id);
        END IF;

        -- Work Allocation Execution Tracking Fields
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_allocations' AND column_name='before_image_url') THEN
            ALTER TABLE work_allocations 
            ADD COLUMN not_completed_reason TEXT,
            ADD COLUMN started_at TIMESTAMP,
            ADD COLUMN completed_at TIMESTAMP,
            ADD COLUMN before_image_url TEXT,
            ADD COLUMN after_image_url TEXT,
            ADD COLUMN geo_location_before JSONB,
            ADD COLUMN geo_location_after JSONB;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='assigner_remarks') THEN
            ALTER TABLE tasks ADD COLUMN assigner_remarks TEXT;
            ALTER TABLE tasks ADD COLUMN assignee_remarks TEXT;
            ALTER TABLE tasks ADD COLUMN completed_by INTEGER REFERENCES users(id);
            ALTER TABLE tasks ADD COLUMN is_late_completion BOOLEAN DEFAULT false;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='work_allocations' AND column_name='is_late_completion') THEN
            ALTER TABLE work_allocations ADD COLUMN is_late_completion BOOLEAN DEFAULT false;
            ALTER TABLE work_allocations ADD COLUMN execution_notes TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='event_id') THEN
            ALTER TABLE activity_logs ADD COLUMN event_id INTEGER REFERENCES events(id);
        END IF;
    END $$;

    -- AI Chat Sessions
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) DEFAULT 'New Chat',
      organization_id INTEGER REFERENCES organizations(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Chat Messages
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
    CREATE INDEX IF NOT EXISTS idx_voters_org ON voters(organization_id);
    CREATE INDEX IF NOT EXISTS idx_voters_geo ON voters(constituency_id, area_id, ward_id, booth_id);
    CREATE INDEX IF NOT EXISTS idx_surveys_org ON surveys(organization_id);
    CREATE INDEX IF NOT EXISTS idx_surveys_geo ON surveys(constituency_id, area_id, ward_id, booth_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_geo ON tasks(constituency_id, area_id, ward_id, booth_id);
    CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
    CREATE INDEX IF NOT EXISTS idx_work_alloc_event ON work_allocations(event_id);
    CREATE INDEX IF NOT EXISTS idx_work_alloc_org ON work_allocations(organization_id);
    CREATE INDEX IF NOT EXISTS idx_work_alloc_status ON work_allocations(status);
    CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_activity_event ON activity_logs(event_id);
    CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_activity_task ON task_activity_log(task_id);
    CREATE INDEX IF NOT EXISTS idx_work_alloc_proofs_wa ON work_allocation_proofs(work_allocation_id);
    CREATE INDEX IF NOT EXISTS idx_media_org ON media(organization_id);

    -- AI User Long-term Memory
    CREATE TABLE IF NOT EXISTS user_memories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      memory_key VARCHAR(100) NOT NULL,
      memory_value TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, memory_key)
    );

    CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
  `;

  try {
    await pool.query(queries);
    console.log('✅ All tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error.message);
    throw error;
  }
};

module.exports = { createTables };
