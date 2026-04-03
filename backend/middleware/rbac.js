/**
 * ENHANCED RBAC MIDDLEWARE v2
 * ─────────────────────────────────────────────────────────────────────
 * Supports:
 *  - requireRole(...)       → exact role whitelist
 *  - requireMinRole(...)    → hierarchical minimum level
 *  - requireOrgAccess()     → blocks access if user targets wrong org
 *  - ROLE_HIERARCHY         → numeric priority map for comparisons
 */

const ROLE_HIERARCHY = {
  'super_admin': 5,
  'mla': 4,
  'campaign_manager': 3,
  'ward_head': 2,
  'booth_worker': 1,
};

// ── Exact role whitelist check ───────────────────────────────────────
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userRole = req.user.role_name;
    if (!allowedRoles.includes(userRole) && userRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}.`
      });
    }

    next();
  };
};

// ── Minimum hierarchy level check ───────────────────────────────────
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role_name] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Minimum role required: ${minRole}.`
      });
    }

    next();
  };
};

// ── Cross-org access guard ───────────────────────────────────────────
// Prevents a non-super_admin from accessing a different org's data.
const requireOrgAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const requestedOrg = parseInt(req.query.org_id || req.body?.organization_id || req.params?.org_id);
  const userOrg = req.user.organization_id;
  const isSuperAdmin = req.user.role_name === 'super_admin';

  if (requestedOrg && requestedOrg !== userOrg && !isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You cannot access data from another organization.'
    });
  }

  next();
};

module.exports = { requireRole, requireMinRole, requireOrgAccess, ROLE_HIERARCHY };
