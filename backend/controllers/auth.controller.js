const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateToken } = require('../middleware/auth');
const { logActivity, formatResponse } = require('../utils/helpers');

// Login — now returns org_id in token and response
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(formatResponse(false, 'Email and password are required.'));
    }

    const result = await pool.query(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name, r.permissions,
              o.name as organization_name, o.slug as organization_slug
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json(formatResponse(false, 'Invalid email or password.'));
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json(formatResponse(false, 'Account is deactivated. Contact admin.'));
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json(formatResponse(false, 'Invalid email or password.'));
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    const token = generateToken(user);

    await logActivity(user.id, 'LOGIN', 'auth', { email }, req.ip, user.organization_id);

    res.json(formatResponse(true, 'Login successful.', {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role_id: user.role_id,
        role_name: user.role_name,
        role_display_name: user.role_display_name,
        permissions: user.permissions,
        constituency_id: user.constituency_id,
        ward_id: user.ward_id,
        booth_id: user.booth_id,
        avatar_url: user.avatar_url,
        organization_id: user.organization_id,
        organization_name: user.organization_name,
      }
    }));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.status, u.last_login, u.created_at,
              u.organization_id,
              r.name as role_name, r.display_name as role_display_name, r.permissions,
              c.name as constituency_name, w.name as ward_name, b.name as booth_name,
              o.name as organization_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN constituencies c ON u.constituency_id = c.id
       LEFT JOIN wards w ON u.ward_id = w.id
       LEFT JOIN booths b ON u.booth_id = b.id
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(formatResponse(false, 'User not found.'));
    }

    res.json(formatResponse(true, 'Profile fetched.', result.rows[0]));
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json(formatResponse(false, 'Current password is incorrect.'));
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, req.user.id]);

    await logActivity(req.user.id, 'PASSWORD_CHANGED', 'auth', {}, req.ip, req.tenant);

    res.json(formatResponse(true, 'Password changed successfully.'));
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = { login, getProfile, changePassword };
