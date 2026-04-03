const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');

// Get team members (tenant-scoped)
const getTeamMembers = async (req, res) => {
  try {
    const { constituency_id, ward_id, booth_id, status } = req.query;

    let query = `
      SELECT tm.*, u.name, u.email, u.phone, u.status as user_status,
             r.display_name as role_name,
             leader.name as leader_name,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN users leader ON tm.team_leader_id = leader.id
      LEFT JOIN constituencies c ON tm.constituency_id = c.id
      LEFT JOIN wards w ON tm.ward_id = w.id
      LEFT JOIN booths b ON tm.booth_id = b.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (!req.scope?.unrestricted) {
      paramCount++; query += ` AND tm.organization_id = $${paramCount}`; params.push(req.tenant);
    }

    if (constituency_id) { paramCount++; query += ` AND tm.constituency_id = $${paramCount}`; params.push(constituency_id); }
    if (ward_id) { paramCount++; query += ` AND tm.ward_id = $${paramCount}`; params.push(ward_id); }
    if (booth_id) { paramCount++; query += ` AND tm.booth_id = $${paramCount}`; params.push(booth_id); }
    if (status) { paramCount++; query += ` AND tm.status = $${paramCount}`; params.push(status); }

    query += ' ORDER BY tm.joined_at DESC';
    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Team members fetched.', result.rows));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const addTeamMember = async (req, res) => {
  try {
    const { user_id, team_leader_id, constituency_id, ward_id, booth_id, designation } = req.body;
    if (!user_id) return res.status(400).json(formatResponse(false, 'User ID is required.'));

    const existing = await pool.query('SELECT id FROM team_members WHERE user_id = $1', [user_id]);
    if (existing.rows.length) return res.status(400).json(formatResponse(false, 'User is already a team member.'));

    const result = await pool.query(
      `INSERT INTO team_members (user_id, team_leader_id, constituency_id, ward_id, booth_id, designation, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [user_id, team_leader_id || null, constituency_id || null, ward_id || null, booth_id || null, designation || null, req.tenant]
    );

    await logActivity(req.user.id, 'TEAM_MEMBER_ADDED', 'teams', { user_id, designation }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'Team member added.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const updateTeamMember = async (req, res) => {
  try {
    const { team_leader_id, constituency_id, ward_id, booth_id, designation, status } = req.body;
    const result = await pool.query(
      `UPDATE team_members SET team_leader_id = COALESCE($1, team_leader_id),
       constituency_id = $2, ward_id = $3, booth_id = $4,
       designation = COALESCE($5, designation), status = COALESCE($6, status)
       WHERE id = $7 AND organization_id = $8 RETURNING *`,
      [team_leader_id, constituency_id || null, ward_id || null, booth_id || null, designation, status, req.params.id, req.tenant]
    );
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Team member updated.', result.rows[0]));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const removeTeamMember = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM team_members WHERE id = $1 AND organization_id = $2 RETURNING id', [req.params.id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    await logActivity(req.user.id, 'TEAM_MEMBER_REMOVED', 'teams', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Team member removed.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const getTeamStats = async (req, res) => {
  try {
    const orgClause = req.scope?.unrestricted ? '' : ` AND tm.organization_id = ${req.tenant}`;
    const totalMembers = await pool.query(`SELECT COUNT(*) FROM team_members tm WHERE status = 'active'${orgClause}`);
    const byConstituency = await pool.query(`
      SELECT c.name, COUNT(tm.id) as count FROM team_members tm
      JOIN constituencies c ON tm.constituency_id = c.id
      WHERE tm.status = 'active'${orgClause} GROUP BY c.name ORDER BY count DESC
    `);
    const byDesignation = await pool.query(`
      SELECT designation, COUNT(*) as count FROM team_members tm
      WHERE status = 'active' AND designation IS NOT NULL${orgClause} GROUP BY designation ORDER BY count DESC
    `);
    res.json(formatResponse(true, 'Team stats fetched.', {
      total_active: parseInt(totalMembers.rows[0].count),
      by_constituency: byConstituency.rows,
      by_designation: byDesignation.rows
    }));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = { getTeamMembers, addTeamMember, updateTeamMember, removeTeamMember, getTeamStats };
