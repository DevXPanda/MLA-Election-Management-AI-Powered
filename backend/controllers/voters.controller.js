const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

// Get voters (tenant + scope filtered)
const getVoters = async (req, res) => {
  try {
    const { page = 1, limit = 20, support_status, search } = req.query;

    let query = `
      SELECT v.*, b.name as booth_name, w.name as ward_name, c.name as constituency_name,
             creator.name as created_by_name
      FROM voters v
      LEFT JOIN booths b ON v.booth_id = b.id
      LEFT JOIN wards w ON v.ward_id = w.id
      LEFT JOIN constituencies c ON v.constituency_id = c.id
      LEFT JOIN users creator ON v.created_by = creator.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // Tenant + hierarchical scope
    const { clause, params: scopeParams, count } = buildScopeFilter(req, 'v', paramCount);
    query += clause;
    params = [...params, ...scopeParams];
    paramCount = count;

    if (support_status) { paramCount++; query += ` AND v.support_status = $${paramCount}`; params.push(support_status); }
    if (search) {
      paramCount++;
      query += ` AND (v.name ILIKE $${paramCount} OR v.phone ILIKE $${paramCount} OR v.voter_id_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY v.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Voters fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Create voter
const createVoter = async (req, res) => {
  try {
    let { voter_id_number, name, phone, address, age, gender, booth_id, ward_id, constituency_id, caste, scheme_beneficiary, scheme_details, support_status, remarks } = req.body;

    if (!name) return res.status(400).json(formatResponse(false, 'Voter name is required.'));
    if (!ward_id || !booth_id) {
      return res.status(400).json(formatResponse(false, 'Ward and Booth assignments are mandatory.'));
    }

    if (!req.scope?.unrestricted && req.scope?.constituency_id) {
      constituency_id = req.scope.constituency_id;
    }

    if (!constituency_id) {
      return res.status(400).json(formatResponse(false, 'Constituency assignment is mandatory.'));
    }

    // Verify relations: Ward belongs to Constituency
    const wardCheck = await pool.query('SELECT constituency_id FROM wards WHERE id = $1', [ward_id]);
    if (!wardCheck.rows.length || wardCheck.rows[0].constituency_id !== parseInt(constituency_id)) {
      return res.status(400).json(formatResponse(false, 'Selected Ward does not belong to the selected Constituency.'));
    }

    // Verify relations: Booth belongs to Ward
    const boothCheck = await pool.query('SELECT ward_id FROM booths WHERE id = $1', [booth_id]);
    if (!boothCheck.rows.length || boothCheck.rows[0].ward_id !== parseInt(ward_id)) {
      return res.status(400).json(formatResponse(false, 'Selected Booth does not belong to the selected Ward.'));
    }

    const result = await pool.query(
      `INSERT INTO voters (voter_id_number, name, phone, address, age, gender, booth_id, ward_id, constituency_id, caste, scheme_beneficiary, scheme_details, support_status, remarks, created_by, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [voter_id_number, name, phone, address, age, gender, booth_id || null, ward_id || null, constituency_id || null, caste, scheme_beneficiary || false, scheme_details, support_status || 'unknown', remarks, req.user.id, req.tenant]
    );

    await logActivity(req.user.id, 'VOTER_ADDED', 'voters', { name }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'Voter added.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Update voter
const updateVoter = async (req, res) => {
  try {
    let { voter_id_number, name, phone, address, age, gender, booth_id, ward_id, constituency_id, caste, scheme_beneficiary, scheme_details, support_status, remarks } = req.body;

    if (!ward_id || !booth_id) {
      return res.status(400).json(formatResponse(false, 'Ward and Booth assignments are mandatory.'));
    }

    if (!req.scope?.unrestricted && req.scope?.constituency_id) {
      constituency_id = req.scope.constituency_id;
    }

    if (!constituency_id) {
      return res.status(400).json(formatResponse(false, 'Constituency assignment is mandatory.'));
    }

    // Verify relations: Ward belongs to Constituency
    const wardCheck = await pool.query('SELECT constituency_id FROM wards WHERE id = $1', [ward_id]);
    if (!wardCheck.rows.length || wardCheck.rows[0].constituency_id !== parseInt(constituency_id)) {
      return res.status(400).json(formatResponse(false, 'Selected Ward does not belong to the selected Constituency.'));
    }

    // Verify relations: Booth belongs to Ward
    const boothCheck = await pool.query('SELECT ward_id FROM booths WHERE id = $1', [booth_id]);
    if (!boothCheck.rows.length || boothCheck.rows[0].ward_id !== parseInt(ward_id)) {
      return res.status(400).json(formatResponse(false, 'Selected Booth does not belong to the selected Ward.'));
    }

    // MLA: verify the voter belongs to their constituency before update
    let scopeClause = '';
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      scopeClause = ' AND constituency_id = $17';
    }

    const scopeParams = [voter_id_number, name, phone, address, age, gender, booth_id || null, ward_id || null, constituency_id || null, caste, scheme_beneficiary, scheme_details, support_status, remarks, req.params.id, req.tenant];
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      scopeParams.push(req.scope.constituency_id);
    }

    const result = await pool.query(
      `UPDATE voters SET voter_id_number = COALESCE($1, voter_id_number), name = COALESCE($2, name),
       phone = COALESCE($3, phone), address = COALESCE($4, address), age = COALESCE($5, age),
       gender = COALESCE($6, gender), booth_id = $7, ward_id = $8, constituency_id = $9,
       caste = COALESCE($10, caste), scheme_beneficiary = COALESCE($11, scheme_beneficiary),
       scheme_details = COALESCE($12, scheme_details), support_status = COALESCE($13, support_status),
       remarks = COALESCE($14, remarks), updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 AND organization_id = $16${scopeClause} RETURNING *`,
      scopeParams
    );

    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Voter not found.'));
    res.json(formatResponse(true, 'Voter updated.', result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Delete voter
const deleteVoter = async (req, res) => {
  try {
    // MLA: verify the voter belongs to their constituency before delete
    let scopeClause = '';
    const scopeParams = [req.params.id, req.tenant];
    if (req.userRole === 'mla' && req.scope?.constituency_id) {
      scopeClause = ' AND constituency_id = $3';
      scopeParams.push(req.scope.constituency_id);
    }
    const result = await pool.query(`DELETE FROM voters WHERE id = $1 AND organization_id = $2${scopeClause} RETURNING id`, scopeParams);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Voter not found.'));

    await logActivity(req.user.id, 'VOTER_DELETED', 'voters', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Voter deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Voter stats (scope-filtered)
const getVoterStats = async (req, res) => {
  try {
    const { clause, params } = buildScopeFilter(req, 'v');
    const { clause: baseClause, params: baseParams } = buildScopeFilter(req);

    const total = await pool.query(`SELECT COUNT(*) FROM voters WHERE 1=1 ${baseClause}`, baseParams);
    const supportBreakdown = await pool.query(`
      SELECT support_status, COUNT(*) as count,
             ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM voters WHERE 1=1 ${baseClause}), 0) * 100, 1) as percentage
      FROM voters
      WHERE 1=1 ${baseClause} GROUP BY support_status ORDER BY count DESC
    `, baseParams);
    const byWard = await pool.query(`
      SELECT w.name as ward_name, COUNT(v.id) as count
      FROM voters v JOIN wards w ON v.ward_id = w.id WHERE 1=1${clause}
      GROUP BY w.name ORDER BY count DESC
    `, params);
    const genderBreakdown = await pool.query(`
      SELECT gender, COUNT(*) as count FROM voters
      WHERE gender IS NOT NULL ${baseClause} GROUP BY gender
    `, baseParams);
    const casteBreakdown = await pool.query(`
      SELECT caste, COUNT(*) as count FROM voters
      WHERE caste IS NOT NULL ${baseClause} GROUP BY caste ORDER BY count DESC
    `, baseParams);
    const beneficiaries = await pool.query(`
      SELECT COUNT(*) FROM voters WHERE scheme_beneficiary = true ${baseClause}
    `, baseParams);

    res.json(formatResponse(true, 'Voter stats fetched.', {
      total: parseInt(total.rows[0].count),
      support_breakdown: supportBreakdown.rows,
      by_ward: byWard.rows,
      gender_breakdown: genderBreakdown.rows,
      caste_breakdown: casteBreakdown.rows,
      scheme_beneficiaries: parseInt(beneficiaries.rows[0].count)
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = { getVoters, createVoter, updateVoter, deleteVoter, getVoterStats };
