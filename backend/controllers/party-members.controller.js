const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');

// Helper to validate Base64 image
const validatePhoto = (photoUrl) => {
  if (!photoUrl) return true; // Optional field
  
  // Format check
  if (!photoUrl.startsWith('data:image/')) {
    throw new Error('Invalid file format. Only images are allowed.');
  }

  // Size check: ~0.75 * base64 length = actual bytes. Limit is 5MB (5,242,880 bytes).
  const approximateSize = photoUrl.length * 0.75;
  if (approximateSize > 5242880) {
    throw new Error('Image size exceeds 5MB limit.');
  }

  return true;
};

// Create a new Party Member
const createMember = async (req, res) => {
  try {
    const {
      full_name, phone, email, address, ward_id, booth_id,
      qualification, profession, age, gender, support_preference, photo_url,
      help_preference
    } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json(formatResponse(false, 'Full Name and Phone Number are required.'));
    }

    // Role validation
    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied. You do not have permission to create party members.'));
    }

    // Validate photo upload
    try {
      validatePhoto(photo_url);
    } catch (err) {
      return res.status(400).json(formatResponse(false, err.message));
    }

    // Fetch creator details
    const creatorRes = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const created_by_name = creatorRes.rows[0]?.name || 'Unknown';
    const created_by_role = req.userRole;

    // Resolve geographic fields
    let ward_number = null;
    let constituency_id = null;
    if (ward_id) {
      const wardRes = await pool.query('SELECT number, constituency_id FROM wards WHERE id = $1', [ward_id]);
      if (wardRes.rows.length) {
        ward_number = wardRes.rows[0].number;
        constituency_id = wardRes.rows[0].constituency_id;
      }
    }

    let booth_number = null;
    if (booth_id) {
      const boothRes = await pool.query('SELECT number FROM booths WHERE id = $1', [booth_id]);
      if (boothRes.rows.length) {
        booth_number = boothRes.rows[0].number;
      }
    }

    // Insert into DB
    const result = await pool.query(
      `INSERT INTO party_members (
        full_name, phone, email, address, ward_number, booth_number,
        qualification, profession, age, gender, support_preference, photo_url,
        created_by_user_id, created_by_role, created_by_name, ward_id, booth_id, constituency_id, organization_id,
        help_preference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        full_name, phone, email || null, address || null, ward_number, booth_number,
        qualification || null, profession || null, age ? parseInt(age) : null, gender || null,
        support_preference || 'Neutral', photo_url || null,
        req.user.id, created_by_role, created_by_name,
        ward_id || null, booth_id || null, constituency_id || null, req.tenant || 1,
        help_preference || null
      ]
    );

    await logActivity(req.user.id, 'PARTY_MEMBER_CREATED', 'party_members', { member_id: result.rows[0].id, name: full_name }, req.ip, req.tenant);

    clearAnalyticsCache();
    res.status(201).json(formatResponse(true, 'Party Member created successfully.', result.rows[0]));
  } catch (error) {
    console.error('Error creating party member:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Get list of Party Members with filters & visibility rules
const getMembers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, ward_id, support_preference, creator_role, help_preference } = req.query;

    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    let query = `
      SELECT pm.*, w.name as ward_name, b.name as booth_name
      FROM party_members pm
      LEFT JOIN wards w ON pm.ward_id = w.id
      LEFT JOIN booths b ON pm.booth_id = b.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // Apply visibility rules
    if (req.userRole === 'super_admin') {
      // Sees all (no filters)
    } else if (req.userRole === 'mla') {
      // Sees under their constituency
      paramCount++;
      query += ` AND pm.organization_id = $${paramCount}`;
      params.push(req.tenant);

      paramCount++;
      query += ` AND pm.constituency_id = $${paramCount}`;
      params.push(req.user.constituency_id);
    } else if (req.userRole === 'campaign_manager') {
      // Sees created under their hierarchy
      paramCount++;
      query += ` AND pm.organization_id = $${paramCount}`;
      params.push(req.tenant);

      paramCount++;
      query += ` AND (
        pm.created_by_user_id = $${paramCount}
        OR pm.created_by_user_id IN (
          WITH RECURSIVE subordinates AS (
            SELECT user_id FROM team_members WHERE team_leader_id = $${paramCount}
            UNION
            SELECT tm.user_id FROM team_members tm
            INNER JOIN subordinates s ON tm.team_leader_id = s.user_id
          )
          SELECT user_id FROM subordinates
        )
      )`;
      params.push(req.user.id);
    } else if (req.userRole === 'ward_head') {
      // Sees under assigned ward
      paramCount++;
      query += ` AND pm.organization_id = $${paramCount}`;
      params.push(req.tenant);

      paramCount++;
      query += ` AND pm.ward_id = $${paramCount}`;
      params.push(req.user.ward_id);
    }

    // Apply listing search & filters
    if (search) {
      paramCount++;
      query += ` AND (pm.full_name ILIKE $${paramCount} OR pm.phone ILIKE $${paramCount} OR pm.help_preference ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (ward_id) {
      paramCount++;
      query += ` AND pm.ward_id = $${paramCount}`;
      params.push(parseInt(ward_id));
    }

    if (support_preference) {
      paramCount++;
      query += ` AND pm.support_preference = $${paramCount}`;
      params.push(support_preference);
    }

    if (creator_role) {
      paramCount++;
      query += ` AND pm.created_by_role = $${paramCount}`;
      params.push(creator_role);
    }

    if (help_preference) {
      paramCount++;
      query += ` AND pm.help_preference ILIKE $${paramCount}`;
      params.push(`%${help_preference}%`);
    }

    // Pagination
    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY pm.created_at DESC';
    const offset = (page - 1) * limit;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Party Members fetched successfully.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) {
    console.error('Error fetching party members:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Get a single Party Member's profile
const getMember = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    let query = `
      SELECT pm.*, w.name as ward_name, b.name as booth_name, c.name as constituency_name
      FROM party_members pm
      LEFT JOIN wards w ON pm.ward_id = w.id
      LEFT JOIN booths b ON pm.booth_id = b.id
      LEFT JOIN constituencies c ON pm.constituency_id = c.id
      WHERE pm.id = $1
    `;
    let params = [id];

    // Enforce scoping
    if (req.userRole === 'super_admin') {
      // No extra checks
    } else {
      query += ' AND pm.organization_id = $2';
      params.push(req.tenant);

      if (req.userRole === 'mla') {
        query += ' AND pm.constituency_id = $3';
        params.push(req.user.constituency_id);
      } else if (req.userRole === 'campaign_manager') {
        query += ` AND (
          pm.created_by_user_id = $3
          OR pm.created_by_user_id IN (
            WITH RECURSIVE subordinates AS (
              SELECT user_id FROM team_members WHERE team_leader_id = $3
              UNION
              SELECT tm.user_id FROM team_members tm
              INNER JOIN subordinates s ON tm.team_leader_id = s.user_id
            )
            SELECT user_id FROM subordinates
          )
        )`;
        params.push(req.user.id);
      } else if (req.userRole === 'ward_head') {
        query += ' AND pm.ward_id = $3';
        params.push(req.user.ward_id);
      }
    }

    const result = await pool.query(query, params);
    if (!result.rows.length) {
      return res.status(404).json(formatResponse(false, 'Party Member not found or access denied.'));
    }

    res.json(formatResponse(true, 'Party Member fetched.', result.rows[0]));
  } catch (error) {
    console.error('Error fetching party member:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Update a Party Member
const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      full_name, phone, email, address, ward_id, booth_id,
      qualification, profession, age, gender, support_preference, photo_url,
      help_preference
    } = req.body;

    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    // Verify record exists and check access
    let accessQuery = 'SELECT id, created_by_user_id, constituency_id, ward_id FROM party_members WHERE id = $1';
    let accessParams = [id];
    if (req.userRole !== 'super_admin') {
      accessQuery += ' AND organization_id = $2';
      accessParams.push(req.tenant);
    }
    const checkRes = await pool.query(accessQuery, accessParams);
    if (!checkRes.rows.length) {
      return res.status(404).json(formatResponse(false, 'Party Member not found or access denied.'));
    }

    const member = checkRes.rows[0];

    // Enforce edit hierarchy permissions
    if (req.userRole === 'mla' && member.constituency_id !== req.user.constituency_id) {
      return res.status(403).json(formatResponse(false, 'Access denied. MLA can only edit within their constituency.'));
    } else if (req.userRole === 'campaign_manager') {
      const isOwner = member.created_by_user_id === req.user.id;
      if (!isOwner) {
        // Check if creator was subordinate
        const subordinateCheck = await pool.query(`
          WITH RECURSIVE subordinates AS (
            SELECT user_id FROM team_members WHERE team_leader_id = $1
            UNION
            SELECT tm.user_id FROM team_members tm
            INNER JOIN subordinates s ON tm.team_leader_id = s.user_id
          )
          SELECT 1 FROM subordinates WHERE user_id = $2
        `, [req.user.id, member.created_by_user_id]);
        if (!subordinateCheck.rows.length) {
          return res.status(403).json(formatResponse(false, 'Access denied. You can only edit members created within your hierarchy.'));
        }
      }
    } else if (req.userRole === 'ward_head' && member.ward_id !== req.user.ward_id) {
      return res.status(403).json(formatResponse(false, 'Access denied. Ward heads can only edit within their ward.'));
    }

    // Validate photo
    if (photo_url) {
      try {
        validatePhoto(photo_url);
      } catch (err) {
        return res.status(400).json(formatResponse(false, err.message));
      }
    }

    // Resolve geographic fields
    let ward_number = null;
    let constituency_id = null;
    if (ward_id) {
      const wardRes = await pool.query('SELECT number, constituency_id FROM wards WHERE id = $1', [ward_id]);
      if (wardRes.rows.length) {
        ward_number = wardRes.rows[0].number;
        constituency_id = wardRes.rows[0].constituency_id;
      }
    }

    let booth_number = null;
    if (booth_id) {
      const boothRes = await pool.query('SELECT number FROM booths WHERE id = $1', [booth_id]);
      if (boothRes.rows.length) {
        booth_number = boothRes.rows[0].number;
      }
    }

    // Update
    const result = await pool.query(
      `UPDATE party_members
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           address = COALESCE($4, address),
           ward_number = COALESCE($5, ward_number),
           booth_number = COALESCE($6, booth_number),
           qualification = COALESCE($7, qualification),
           profession = COALESCE($8, profession),
           age = COALESCE($9, age),
           gender = COALESCE($10, gender),
           support_preference = COALESCE($11, support_preference),
           photo_url = COALESCE($12, photo_url),
           ward_id = COALESCE($13, ward_id),
           booth_id = COALESCE($14, booth_id),
           constituency_id = COALESCE($15, constituency_id),
           help_preference = COALESCE($16, help_preference),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $17
       RETURNING *`,
      [
        full_name, phone, email, address, ward_number, booth_number,
        qualification, profession, age ? parseInt(age) : null, gender, support_preference, photo_url,
        ward_id || null, booth_id || null, constituency_id || null, help_preference, id
      ]
    );

    await logActivity(req.user.id, 'PARTY_MEMBER_UPDATED', 'party_members', { member_id: id }, req.ip, req.tenant);

    clearAnalyticsCache();
    res.json(formatResponse(true, 'Party Member updated successfully.', result.rows[0]));
  } catch (error) {
    console.error('Error updating party member:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Delete a Party Member
const deleteMember = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    // Check if record exists
    let checkQuery = 'SELECT id, created_by_user_id, constituency_id, ward_id FROM party_members WHERE id = $1';
    let checkParams = [id];
    if (req.userRole !== 'super_admin') {
      checkQuery += ' AND organization_id = $2';
      checkParams.push(req.tenant);
    }
    const checkRes = await pool.query(checkQuery, checkParams);
    if (!checkRes.rows.length) {
      return res.status(404).json(formatResponse(false, 'Party Member not found.'));
    }

    const member = checkRes.rows[0];

    // Check delete permissions
    if (req.userRole === 'mla' && member.constituency_id !== req.user.constituency_id) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    } else if (req.userRole === 'campaign_manager') {
      const isOwner = member.created_by_user_id === req.user.id;
      if (!isOwner) {
        const subordinateCheck = await pool.query(`
          WITH RECURSIVE subordinates AS (
            SELECT user_id FROM team_members WHERE team_leader_id = $1
            UNION
            SELECT tm.user_id FROM team_members tm
            INNER JOIN subordinates s ON tm.team_leader_id = s.user_id
          )
          SELECT 1 FROM subordinates WHERE user_id = $2
        `, [req.user.id, member.created_by_user_id]);
        if (!subordinateCheck.rows.length) {
          return res.status(403).json(formatResponse(false, 'Access denied.'));
        }
      }
    } else if (req.userRole === 'ward_head' && member.ward_id !== req.user.ward_id) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    // Perform Delete
    await pool.query('DELETE FROM party_members WHERE id = $1', [id]);
    await logActivity(req.user.id, 'PARTY_MEMBER_DELETED', 'party_members', { id }, req.ip, req.tenant);

    clearAnalyticsCache();
    res.json(formatResponse(true, 'Party Member deleted successfully.'));
  } catch (error) {
    console.error('Error deleting party member:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = {
  createMember,
  getMembers,
  getMember,
  updateMember,
  deleteMember
};

// ── ANALYTICS CACHING AND SCOPING HELPERS ──────────────────────────────

const analyticsCache = new Map();

const getCachedData = (key, ttlMs = 15000) => {
  const cached = analyticsCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  analyticsCache.set(key, {
    data,
    timestamp: Date.now()
  });
};

const clearAnalyticsCache = () => {
  analyticsCache.clear();
};

const buildMemberScopeFilter = (req, alias = 'pm', startCount = 0) => {
  const prefix = alias ? `${alias}.` : '';
  const params = [];
  const clauses = [];
  let count = startCount;

  if (req.userRole === 'super_admin') {
    // Sees all (no filters)
  } else if (req.userRole === 'mla') {
    count++;
    clauses.push(`${prefix}organization_id = $${count}`);
    params.push(req.tenant);

    count++;
    clauses.push(`${prefix}constituency_id = $${count}`);
    params.push(req.scope.constituency_id);
  } else if (req.userRole === 'campaign_manager') {
    count++;
    clauses.push(`${prefix}organization_id = $${count}`);
    params.push(req.tenant);

    count++;
    clauses.push(`(${prefix}created_by_user_id = $${count} OR ${prefix}created_by_user_id IN (
      WITH RECURSIVE subordinates AS (
        SELECT user_id FROM team_members WHERE team_leader_id = $${count}
        UNION
        SELECT tm.user_id FROM team_members tm
        INNER JOIN subordinates s ON tm.team_leader_id = s.user_id
      )
      SELECT user_id FROM subordinates
    ))`);
    params.push(req.user.id);
  } else if (req.userRole === 'ward_head') {
    count++;
    clauses.push(`${prefix}organization_id = $${count}`);
    params.push(req.tenant);

    count++;
    clauses.push(`${prefix}ward_id = $${count}`);
    params.push(req.scope.ward_id);
  }

  return {
    clause: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    params,
    count
  };
};

// ── PARTY MEMBERS ANALYTICS CONTROLLER ACTIONS ────────────────────────

// 1. GET /api/party-members/analytics/summary
const getSummary = async (req, res) => {
  try {
    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    const cacheKey = `summary:${req.user.id}:${req.userRole}:${req.tenant}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(formatResponse(true, 'Party member summary statistics (cached).', cached));
    }

    const { clause, params } = buildMemberScopeFilter(req, 'pm');

    // Run optimized SQL aggregations
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_members,
        COUNT(CASE WHEN LOWER(support_preference) = 'bjp' THEN 1 END) as bjp_supporters,
        COUNT(CASE WHEN LOWER(support_preference) NOT IN ('bjp', 'neutral', 'undecided') THEN 1 END) as opposition_supporters,
        COUNT(CASE WHEN LOWER(support_preference) IN ('neutral', 'undecided') OR support_preference IS NULL THEN 1 END) as neutral_undecided,
        COUNT(DISTINCT ward_id) as active_wards
      FROM party_members pm
      WHERE 1=1 ${clause}
    `;
    const summaryResult = await pool.query(summaryQuery, params);

    // Top Performer (highest additions count)
    const topPerformerQuery = `
      SELECT 
        created_by_name as name, 
        created_by_user_id as id, 
        COUNT(*) as count
      FROM party_members pm
      WHERE 1=1 ${clause} AND created_by_user_id IS NOT NULL
      GROUP BY created_by_name, created_by_user_id
      ORDER BY count DESC
      LIMIT 1
    `;
    const topPerformerResult = await pool.query(topPerformerQuery, params);
    const top_performer = topPerformerResult.rows[0] || { name: 'None', id: null, count: 0 };

    // Support preference breakdown for Pie Chart
    const supportBreakdownQuery = `
      SELECT support_preference, COUNT(*) as count
      FROM party_members pm
      WHERE 1=1 ${clause}
      GROUP BY support_preference
    `;
    const supportBreakdownResult = await pool.query(supportBreakdownQuery, params);

    // Monthly registrations growth trend for Line Chart
    const monthlyGrowthQuery = `
      SELECT DATE_TRUNC('month', pm.created_at) as month, COUNT(*) as count
      FROM party_members pm
      WHERE 1=1 ${clause}
      GROUP BY DATE_TRUNC('month', pm.created_at)
      ORDER BY month ASC
    `;
    const monthlyGrowthResult = await pool.query(monthlyGrowthQuery, params);

    // Help capability preferences breakdown for Analytics
    const helpPrefsResult = await pool.query(
      `SELECT help_preference FROM party_members pm WHERE 1=1 ${clause} AND help_preference IS NOT NULL`,
      params
    );
    const helpPreferencesBreakdown = {};
    helpPrefsResult.rows.forEach(r => {
      const parts = r.help_preference.split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(part => {
        helpPreferencesBreakdown[part] = (helpPreferencesBreakdown[part] || 0) + 1;
      });
    });
    const help_breakdown = Object.entries(helpPreferencesBreakdown).map(([area, count]) => ({
      area,
      count
    })).sort((a, b) => b.count - a.count);

    const data = {
      total_members: parseInt(summaryResult.rows[0].total_members || 0),
      bjp_supporters: parseInt(summaryResult.rows[0].bjp_supporters || 0),
      opposition_supporters: parseInt(summaryResult.rows[0].opposition_supporters || 0),
      neutral_undecided: parseInt(summaryResult.rows[0].neutral_undecided || 0),
      active_wards: parseInt(summaryResult.rows[0].active_wards || 0),
      top_performer,
      charts: {
        support_distribution: supportBreakdownResult.rows.map(r => ({
          support_preference: r.support_preference,
          count: parseInt(r.count)
        })),
        monthly_growth: monthlyGrowthResult.rows.map(r => ({
          month: r.month,
          count: parseInt(r.count)
        })),
        help_distribution: help_breakdown
      }
    };

    setCachedData(cacheKey, data);
    res.json(formatResponse(true, 'Party member summary statistics.', data));
  } catch (error) {
    console.error('Error fetching summary analytics:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// 2. GET /api/party-members/analytics/top-performers
const getTopPerformers = async (req, res) => {
  try {
    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const cacheKey = `top-performers:${req.user.id}:${req.userRole}:${req.tenant}:${page}:${limit}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(formatResponse(true, 'Top performers list (cached).', cached.performers, cached.meta));
    }

    const { clause, params } = buildMemberScopeFilter(req, 'pm');

    // Count distinct performers
    const countQuery = `
      SELECT COUNT(DISTINCT pm.created_by_user_id) as count
      FROM party_members pm
      WHERE 1=1 ${clause} AND pm.created_by_user_id IS NOT NULL
    `;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0]?.count || 0);

    const queryParams = [...params];
    const performerQuery = `
      SELECT 
        u.id as user_id,
        u.name as user_name,
        COALESCE(r.display_name, pm.created_by_role) as role,
        w.name as ward,
        COUNT(pm.id) as total_members_added,
        COUNT(CASE WHEN LOWER(pm.support_preference) = 'bjp' THEN 1 END) as bjp_supporters_added,
        COUNT(DISTINCT pm.ward_id) as ward_activity,
        CASE 
          WHEN COUNT(pm.id) = 0 THEN 0
          ELSE ROUND((COUNT(CASE WHEN LOWER(pm.support_preference) = 'bjp' THEN 1 END)::numeric / COUNT(pm.id)) * 100, 1)
        END as join_rate
      FROM party_members pm
      JOIN users u ON pm.created_by_user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN wards w ON u.ward_id = w.id
      WHERE 1=1 ${clause}
      GROUP BY u.id, u.name, r.display_name, pm.created_by_role, w.name
      ORDER BY total_members_added DESC, join_rate DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(parseInt(limit));
    queryParams.push(offset);

    const result = await pool.query(performerQuery, queryParams);

    const performers = result.rows.map((row, idx) => ({
      rank: offset + idx + 1,
      ...row,
      total_members_added: parseInt(row.total_members_added),
      bjp_supporters_added: parseInt(row.bjp_supporters_added),
      ward_activity: parseInt(row.ward_activity),
      join_rate: parseFloat(row.join_rate)
    }));

    const meta = {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    };

    setCachedData(cacheKey, { performers, meta });
    res.json(formatResponse(true, 'Top performers list.', performers, meta));
  } catch (error) {
    console.error('Error fetching top performers:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// 3. GET /api/party-members/analytics/wards
const getWards = async (req, res) => {
  try {
    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    const cacheKey = `wards:${req.user.id}:${req.userRole}:${req.tenant}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(formatResponse(true, 'Ward-wise summary list (cached).', cached));
    }

    const { clause, params } = buildMemberScopeFilter(req, 'pm');

    const wardQuery = `
      WITH ward_stats AS (
        SELECT 
          w.id as ward_id,
          w.name as ward_name,
          COUNT(pm.id) as total_members,
          COUNT(CASE WHEN LOWER(pm.support_preference) = 'bjp' THEN 1 END) as bjp_supporters,
          COUNT(CASE WHEN LOWER(pm.support_preference) NOT IN ('bjp', 'neutral', 'undecided') THEN 1 END) as opposition_supporters,
          COUNT(CASE WHEN LOWER(pm.support_preference) IN ('neutral', 'undecided') OR pm.support_preference IS NULL THEN 1 END) as neutral,
          COUNT(CASE WHEN pm.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_members,
          COUNT(CASE WHEN pm.created_at < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as old_members
        FROM party_members pm
        JOIN wards w ON pm.ward_id = w.id
        WHERE 1=1 ${clause}
        GROUP BY w.id, w.name
      ),
      creator_ranks AS (
        SELECT 
          pm.ward_id,
          pm.created_by_name as top_creator_name,
          COUNT(*) as creator_count,
          ROW_NUMBER() OVER (PARTITION BY pm.ward_id ORDER BY COUNT(*) DESC) as rn
        FROM party_members pm
        WHERE pm.ward_id IS NOT NULL ${clause}
        GROUP BY pm.ward_id, pm.created_by_name
      )
      SELECT 
        ws.ward_id,
        ws.ward_name,
        ws.total_members,
        ws.bjp_supporters,
        ws.opposition_supporters,
        ws.neutral,
        CASE 
          WHEN ws.old_members = 0 AND ws.new_members > 0 THEN 100.0
          WHEN ws.old_members = 0 AND ws.new_members = 0 THEN 0.0
          ELSE ROUND((ws.new_members::numeric / ws.old_members) * 100, 1)
        END as growth_rate,
        COALESCE(cr.top_creator_name, 'None') as top_creator
      FROM ward_stats ws
      LEFT JOIN creator_ranks cr ON ws.ward_id = cr.ward_id AND cr.rn = 1
      ORDER BY ws.total_members DESC, ws.ward_name ASC
    `;

    const result = await pool.query(wardQuery, params);

    const wards = result.rows.map(r => ({
      ...r,
      total_members: parseInt(r.total_members),
      bjp_supporters: parseInt(r.bjp_supporters),
      opposition_supporters: parseInt(r.opposition_supporters),
      neutral: parseInt(r.neutral),
      growth_rate: parseFloat(r.growth_rate)
    }));

    setCachedData(cacheKey, wards);
    res.json(formatResponse(true, 'Ward-wise summary list.', wards));
  } catch (error) {
    console.error('Error fetching ward-wise analytics:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// 4. GET /api/party-members/analytics/creator/:id
const getCreatorDetails = async (req, res) => {
  try {
    const allowedRoles = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json(formatResponse(false, 'Access denied.'));
    }

    const creatorId = parseInt(req.params.id);

    const cacheKey = `creator:${req.user.id}:${req.userRole}:${req.tenant}:${creatorId}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(formatResponse(true, 'Creator detailed analytics (cached).', cached));
    }

    // Enforce role-scoped access to this creator's profile
    if (req.userRole === 'super_admin') {
      // Access allowed
    } else if (req.userRole === 'mla') {
      const creatorCheck = await pool.query(
        'SELECT constituency_id FROM users WHERE id = $1 AND organization_id = $2', 
        [creatorId, req.tenant]
      );
      if (!creatorCheck.rows.length || creatorCheck.rows[0].constituency_id !== req.scope.constituency_id) {
        return res.status(403).json(formatResponse(false, 'Access denied.'));
      }
    } else if (req.userRole === 'campaign_manager') {
      if (creatorId !== req.user.id) {
        const hierarchyCheck = await pool.query(`
          WITH RECURSIVE subordinates AS (
            SELECT user_id FROM team_members WHERE team_leader_id = $1
            UNION
            SELECT tm.user_id FROM team_members tm
            INNER JOIN subordinates s ON tm.team_leader_id = s.user_id
          )
          SELECT 1 FROM subordinates WHERE user_id = $2
        `, [req.user.id, creatorId]);
        if (!hierarchyCheck.rows.length) {
          return res.status(403).json(formatResponse(false, 'Access denied.'));
        }
      }
    } else if (req.userRole === 'ward_head') {
      const creatorCheck = await pool.query(
        'SELECT ward_id FROM users WHERE id = $1 AND organization_id = $2', 
        [creatorId, req.tenant]
      );
      if (!creatorCheck.rows.length || creatorCheck.rows[0].ward_id !== req.scope.ward_id) {
        return res.status(403).json(formatResponse(false, 'Access denied.'));
      }
    }

    // Fetch creator profile details
    const profileRes = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, r.display_name as role_name, w.name as ward_name, b.name as booth_name, u.created_at, u.status, u.avatar_url
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN wards w ON u.ward_id = w.id
      LEFT JOIN booths b ON u.booth_id = b.id
      WHERE u.id = $1
    `, [creatorId]);

    if (!profileRes.rows.length) {
      return res.status(404).json(formatResponse(false, 'Creator user not found.'));
    }
    const profile = profileRes.rows[0];

    const { clause, params } = buildMemberScopeFilter(req, 'pm');
    const queryParams = [...params];
    queryParams.push(creatorId);
    const creatorParamIdx = queryParams.length;

    // Total registrations count
    const totalMembersRes = await pool.query(`
      SELECT COUNT(*) as count 
      FROM party_members pm 
      WHERE pm.created_by_user_id = $${creatorParamIdx} ${clause}
    `, queryParams);
    const total_members = parseInt(totalMembersRes.rows[0]?.count || 0);

    // Ward breakdown
    const wardBreakdownRes = await pool.query(`
      SELECT w.name as ward_name, COUNT(pm.id) as count
      FROM party_members pm
      JOIN wards w ON pm.ward_id = w.id
      WHERE pm.created_by_user_id = $${creatorParamIdx} ${clause}
      GROUP BY w.name
      ORDER BY count DESC
    `, queryParams);

    // Booth breakdown
    const boothBreakdownRes = await pool.query(`
      SELECT b.name as booth_name, b.number as booth_number, COUNT(pm.id) as count
      FROM party_members pm
      JOIN booths b ON pm.booth_id = b.id
      WHERE pm.created_by_user_id = $${creatorParamIdx} ${clause}
      GROUP BY b.name, b.number
      ORDER BY count DESC
      LIMIT 10
    `, queryParams);

    // Support preference breakdown
    const supportPreferenceRes = await pool.query(`
      SELECT pm.support_preference, COUNT(*) as count
      FROM party_members pm
      WHERE pm.created_by_user_id = $${creatorParamIdx} ${clause}
      GROUP BY pm.support_preference
    `, queryParams);

    // Recent 10 registrations
    const recentRegistrationsRes = await pool.query(`
      SELECT pm.id, pm.full_name, pm.phone, pm.support_preference, pm.created_at, w.name as ward_name, b.name as booth_name
      FROM party_members pm
      LEFT JOIN wards w ON pm.ward_id = w.id
      LEFT JOIN booths b ON pm.booth_id = b.id
      WHERE pm.created_by_user_id = $${creatorParamIdx} ${clause}
      ORDER BY pm.created_at DESC
      LIMIT 10
    `, queryParams);

    // Monthly registrations growth trend
    const timelineRes = await pool.query(`
      SELECT DATE_TRUNC('month', pm.created_at) as month, COUNT(*) as count
      FROM party_members pm
      WHERE pm.created_by_user_id = $${creatorParamIdx} ${clause}
      GROUP BY DATE_TRUNC('month', pm.created_at)
      ORDER BY month ASC
    `, queryParams);

    const data = {
      profile,
      stats: {
        total_members,
        ward_breakdown: wardBreakdownRes.rows.map(r => ({ ...r, count: parseInt(r.count) })),
        booth_breakdown: boothBreakdownRes.rows.map(r => ({ ...r, count: parseInt(r.count) })),
        support_distribution: supportPreferenceRes.rows.map(r => ({
          support_preference: r.support_preference,
          count: parseInt(r.count)
        })),
        recent_registrations: recentRegistrationsRes.rows,
        timeline: timelineRes.rows.map(r => ({
          month: r.month,
          count: parseInt(r.count)
        }))
      }
    };

    setCachedData(cacheKey, data);
    res.json(formatResponse(true, 'Creator analytics details.', data));
  } catch (error) {
    console.error('Error fetching creator detailed performance:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = {
  createMember,
  getMembers,
  getMember,
  updateMember,
  deleteMember,
  getSummary,
  getTopPerformers,
  getWards,
  getCreatorDetails
};
