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
    const { voter_id_number, name, phone, address, age, gender, booth_id, ward_id, constituency_id, caste, scheme_beneficiary, scheme_details, support_status, remarks } = req.body;

    if (!name) return res.status(400).json(formatResponse(false, 'Voter name is required.'));

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
    const { voter_id_number, name, phone, address, age, gender, booth_id, ward_id, constituency_id, caste, scheme_beneficiary, scheme_details, support_status, remarks } = req.body;

    const result = await pool.query(
      `UPDATE voters SET voter_id_number = COALESCE($1, voter_id_number), name = COALESCE($2, name),
       phone = COALESCE($3, phone), address = COALESCE($4, address), age = COALESCE($5, age),
       gender = COALESCE($6, gender), booth_id = $7, ward_id = $8, constituency_id = $9,
       caste = COALESCE($10, caste), scheme_beneficiary = COALESCE($11, scheme_beneficiary),
       scheme_details = COALESCE($12, scheme_details), support_status = COALESCE($13, support_status),
       remarks = COALESCE($14, remarks), updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 AND organization_id = $16 RETURNING *`,
      [voter_id_number, name, phone, address, age, gender, booth_id || null, ward_id || null, constituency_id || null, caste, scheme_beneficiary, scheme_details, support_status, remarks, req.params.id, req.tenant]
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
    const result = await pool.query('DELETE FROM voters WHERE id = $1 AND organization_id = $2 RETURNING id', [req.params.id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Voter not found.'));

    await logActivity(req.user.id, 'VOTER_DELETED', 'voters', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Voter deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Voter stats (org-scoped)
const getVoterStats = async (req, res) => {
  try {
    const orgFilter = req.scope?.unrestricted ? '' : ` WHERE organization_id = ${req.tenant}`;
    const orgAnd = req.scope?.unrestricted ? '' : ` AND v.organization_id = ${req.tenant}`;

    const total = await pool.query(`SELECT COUNT(*) FROM voters${orgFilter}`);
    const supportBreakdown = await pool.query(`
      SELECT support_status, COUNT(*) as count,
             ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM voters${orgFilter}), 0) * 100, 1) as percentage
      FROM voters${orgFilter} GROUP BY support_status ORDER BY count DESC
    `);
    const byWard = await pool.query(`
      SELECT w.name as ward_name, COUNT(v.id) as count
      FROM voters v JOIN wards w ON v.ward_id = w.id WHERE 1=1${orgAnd}
      GROUP BY w.name ORDER BY count DESC
    `);
    const genderBreakdown = await pool.query(`SELECT gender, COUNT(*) as count FROM voters${orgFilter.replace('WHERE', 'WHERE gender IS NOT NULL AND')} GROUP BY gender`);
    const casteBreakdown = await pool.query(`SELECT caste, COUNT(*) as count FROM voters${orgFilter.replace('WHERE', 'WHERE caste IS NOT NULL AND')} GROUP BY caste ORDER BY count DESC`);
    const beneficiaries = await pool.query(`SELECT COUNT(*) FROM voters WHERE scheme_beneficiary = true${req.scope?.unrestricted ? '' : ' AND organization_id = ' + req.tenant}`);

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
