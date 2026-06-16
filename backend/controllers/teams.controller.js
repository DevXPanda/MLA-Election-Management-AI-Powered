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
    // MLA: restrict to their constituency
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      paramCount++; query += ` AND tm.constituency_id = $${paramCount}`; params.push(req.scope.constituency_id);
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
    let { user_id, team_leader_id, constituency_id, ward_id, booth_id, designation } = req.body;
    if (!user_id) return res.status(400).json(formatResponse(false, 'User ID is required.'));

    // Verify user belongs to same org
    const userCheck = await pool.query('SELECT constituency_id, organization_id FROM users WHERE id = $1', [user_id]);
    if (!userCheck.rows.length || userCheck.rows[0].organization_id !== req.tenant) {
      return res.status(400).json(formatResponse(false, 'User not found or belongs to a different organization.'));
    }

    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      constituency_id = req.scope.constituency_id;
      if (userCheck.rows[0].constituency_id !== req.scope.constituency_id) {
        return res.status(403).json(formatResponse(false, 'Cannot add a user from outside your constituency.'));
      }
      if (ward_id) {
        const wardCheck = await pool.query('SELECT constituency_id FROM wards WHERE id = $1', [ward_id]);
        if (!wardCheck.rows.length || wardCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          return res.status(400).json(formatResponse(false, 'Ward does not belong to your constituency.'));
        }
      }
      if (booth_id) {
        const boothCheck = await pool.query('SELECT w.constituency_id FROM booths b JOIN wards w ON b.ward_id = w.id WHERE b.id = $1', [booth_id]);
        if (!boothCheck.rows.length || boothCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          return res.status(400).json(formatResponse(false, 'Booth does not belong to your constituency.'));
        }
      }
      if (team_leader_id) {
        const leaderCheck = await pool.query('SELECT constituency_id FROM users WHERE id = $1', [team_leader_id]);
        if (!leaderCheck.rows.length || leaderCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          return res.status(400).json(formatResponse(false, 'Team leader must belong to your constituency.'));
        }
      }
    }

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
    let { team_leader_id, constituency_id, ward_id, booth_id, designation, status } = req.body;

    const existing = await pool.query('SELECT constituency_id FROM team_members WHERE id = $1 AND organization_id = $2', [req.params.id, req.tenant]);
    if (!existing.rows.length) return res.status(404).json(formatResponse(false, 'Team member not found.'));

    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      if (existing.rows[0].constituency_id !== req.scope.constituency_id) {
        return res.status(403).json(formatResponse(false, 'Access denied. Team member outside constituency.'));
      }
      constituency_id = req.scope.constituency_id;
      if (ward_id) {
        const wardCheck = await pool.query('SELECT constituency_id FROM wards WHERE id = $1', [ward_id]);
        if (!wardCheck.rows.length || wardCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          return res.status(400).json(formatResponse(false, 'Ward does not belong to your constituency.'));
        }
      }
      if (booth_id) {
        const boothCheck = await pool.query('SELECT w.constituency_id FROM booths b JOIN wards w ON b.ward_id = w.id WHERE b.id = $1', [booth_id]);
        if (!boothCheck.rows.length || boothCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          return res.status(400).json(formatResponse(false, 'Booth does not belong to your constituency.'));
        }
      }
      if (team_leader_id) {
        const leaderCheck = await pool.query('SELECT constituency_id FROM users WHERE id = $1', [team_leader_id]);
        if (!leaderCheck.rows.length || leaderCheck.rows[0].constituency_id !== req.scope.constituency_id) {
          return res.status(400).json(formatResponse(false, 'Team leader must belong to your constituency.'));
        }
      }
    }

    const result = await pool.query(
      `UPDATE team_members SET team_leader_id = COALESCE($1, team_leader_id),
       constituency_id = $2, ward_id = $3, booth_id = $4,
       designation = COALESCE($5, designation), status = COALESCE($6, status)
       WHERE id = $7 AND organization_id = $8 RETURNING *`,
      [team_leader_id, constituency_id || null, ward_id || null, booth_id || null, designation, status, req.params.id, req.tenant]
    );
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Team member updated.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const removeTeamMember = async (req, res) => {
  try {
    let scopeClause = '';
    const scopeParams = [req.params.id, req.tenant];
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      scopeClause = ' AND constituency_id = $3';
      scopeParams.push(req.scope.constituency_id);
    }
    const result = await pool.query(`DELETE FROM team_members WHERE id = $1 AND organization_id = $2${scopeClause} RETURNING id`, scopeParams);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    await logActivity(req.user.id, 'TEAM_MEMBER_REMOVED', 'teams', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Team member removed.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const getTeamStats = async (req, res) => {
  try {
    const orgClause = req.scope?.unrestricted ? '' : ` AND tm.organization_id = ${parseInt(req.tenant)}`;
    // MLA: restrict stats to their constituency
    const constClause = (req.userRole === 'mla' && req.scope?.constituency_id)
      ? ` AND tm.constituency_id = ${parseInt(req.scope.constituency_id)}`
      : '';
    const scopeClause = orgClause + constClause;

    const totalMembers = await pool.query(`SELECT COUNT(*) FROM team_members tm WHERE status = 'active'${scopeClause}`);
    const byConstituency = await pool.query(`
      SELECT c.name, COUNT(tm.id) as count FROM team_members tm
      JOIN constituencies c ON tm.constituency_id = c.id
      WHERE tm.status = 'active'${scopeClause} GROUP BY c.name ORDER BY count DESC
    `);
    const byDesignation = await pool.query(`
      SELECT designation, COUNT(*) as count FROM team_members tm
      WHERE status = 'active' AND designation IS NOT NULL${scopeClause} GROUP BY designation ORDER BY count DESC
    `);
    res.json(formatResponse(true, 'Team stats fetched.', {
      total_active: parseInt(totalMembers.rows[0].count),
      by_constituency: byConstituency.rows,
      by_designation: byDesignation.rows
    }));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = { getTeamMembers, addTeamMember, updateTeamMember, removeTeamMember, getTeamStats };
