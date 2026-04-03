const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

// Get all users (tenant-scoped)
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, status, search } = req.query;

    let query = `
      SELECT u.id, u.name, u.email, u.phone, u.status, u.last_login, u.created_at,
             u.organization_id,
             r.name as role_name, r.display_name as role_display_name,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN constituencies c ON u.constituency_id = c.id
      LEFT JOIN wards w ON u.ward_id = w.id
      LEFT JOIN booths b ON u.booth_id = b.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // Tenant filter (super_admin sees all, others see their org)
    if (!req.scope?.unrestricted) {
      paramCount++; query += ` AND u.organization_id = $${paramCount}`; params.push(req.tenant);
    }

    if (role) { paramCount++; query += ` AND r.name = $${paramCount}`; params.push(role); }
    if (status) { paramCount++; query += ` AND u.status = $${paramCount}`; params.push(status); }
    if (search) {
      paramCount++;
      query += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.phone ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as count_query`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY u.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Users fetched successfully.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Get single user
const getUser = async (req, res) => {
  try {
    const orgClause = req.scope?.unrestricted ? '' : ` AND u.organization_id = ${req.tenant}`;
    const result = await pool.query(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name,
              c.name as constituency_name, w.name as ward_name, b.name as booth_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN constituencies c ON u.constituency_id = c.id
       LEFT JOIN wards w ON u.ward_id = w.id
       LEFT JOIN booths b ON u.booth_id = b.id
       WHERE u.id = $1${orgClause}`, [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'User not found.'));
    const user = result.rows[0];
    delete user.password_hash;
    res.json(formatResponse(true, 'User fetched.', user));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Create user (auto-assign to caller's org)
const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role_id, constituency_id, ward_id, booth_id } = req.body;
    if (!name || !email || !password || !role_id) return res.status(400).json(formatResponse(false, 'Name, email, password, and role are required.'));

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json(formatResponse(false, 'Email already registered.'));

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role_id, constituency_id, ward_id, booth_id, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, email, phone, role_id, status, created_at`,
      [name, email, phone, hash, role_id, constituency_id || null, ward_id || null, booth_id || null, req.tenant]
    );

    await logActivity(req.user.id, 'USER_CREATED', 'users', { created_user_id: result.rows[0].id, name, email }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'User created successfully.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { name, email, phone, role_id, constituency_id, ward_id, booth_id, status } = req.body;

    const result = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone),
       role_id = COALESCE($4, role_id), constituency_id = $5, ward_id = $6, booth_id = $7,
       status = COALESCE($8, status), updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND organization_id = $10 RETURNING id, name, email, phone, role_id, status`,
      [name, email, phone, role_id, constituency_id || null, ward_id || null, booth_id || null, status, req.params.id, req.tenant]
    );

    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'User not found.'));
    await logActivity(req.user.id, 'USER_UPDATED', 'users', { updated_user_id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'User updated successfully.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND organization_id = $2 RETURNING id, name', [req.params.id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'User not found.'));
    await logActivity(req.user.id, 'USER_DELETED', 'users', { deleted_user: result.rows[0] }, req.ip, req.tenant);
    res.json(formatResponse(true, 'User deleted successfully.'));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Get all roles
const getRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id');
    res.json(formatResponse(true, 'Roles fetched.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser, getRoles };
