/**
 * ENHANCED AUTH MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────────
 * Verifies JWT, enriches req.user with org/role data, 
 * then runs tenant scope injection.
 */
const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
      constituency_id: user.constituency_id,
      ward_id: user.ward_id,
      booth_id: user.booth_id,
      organization_id: user.organization_id,   // ← added for tenant binding
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { authenticateToken, generateToken };
