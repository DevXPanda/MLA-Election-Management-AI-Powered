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

    -- Wards table
    CREATE TABLE IF NOT EXISTS wards (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      number VARCHAR(20),
      constituency_id INTEGER REFERENCES constituencies(id) ON DELETE CASCADE,
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

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
    CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
    CREATE INDEX IF NOT EXISTS idx_voters_org ON voters(organization_id);
    CREATE INDEX IF NOT EXISTS idx_voters_geo ON voters(constituency_id, ward_id, booth_id);
    CREATE INDEX IF NOT EXISTS idx_surveys_org ON surveys(organization_id);
    CREATE INDEX IF NOT EXISTS idx_surveys_geo ON surveys(constituency_id, ward_id, booth_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_geo ON tasks(constituency_id, ward_id, booth_id);
    CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);
    CREATE INDEX IF NOT EXISTS idx_activity_org ON activity_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_media_org ON media(organization_id);
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
