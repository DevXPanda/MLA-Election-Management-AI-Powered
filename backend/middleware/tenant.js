const pool = require('../config/db');

/**
 * TENANT ISOLATION MIDDLEWARE v2.1
 * ─────────────────────────────────────────────────────────────────────
 * Injects `req.tenant` and `req.scope` into every authenticated request.
 * ─────────────────────────────────────────────────────────────────────
 */
const injectTenantScope = async (req, res, next) => {
  if (!req.user) return next();

  try {
    const userResult = await pool.query(
      `SELECT u.organization_id, u.booth_id, u.ward_id, u.constituency_id, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (!userResult.rows.length) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    const dbUser = userResult.rows[0];
    req.tenant = dbUser.organization_id;

    const role = dbUser.role_name;
    const scope = {};

    switch (role) {
      case 'super_admin':
        scope.unrestricted = true;
        break;
      case 'mla':
        scope.constituency_id = dbUser.constituency_id;
        break;
      case 'campaign_manager':
        // Campaign Managers overseer multiple wards? No, user says filter by ward_id
        scope.ward_id = dbUser.ward_id;
        scope.constituency_id = dbUser.constituency_id;
        break;
      case 'ward_head':
        scope.ward_id = dbUser.ward_id;
        scope.constituency_id = dbUser.constituency_id;
        break;
      case 'booth_worker':
        scope.booth_id = dbUser.booth_id;
        scope.ward_id = dbUser.ward_id;
        scope.constituency_id = dbUser.constituency_id;
        scope.user_id = req.user.id; // 🔒 MANDATORY SELF-FILTER
        break;
    }

    req.scope = scope;
    req.userRole = role;

    next();
  } catch (err) {
    console.error('[Tenant Middleware Error]', err.message);
    return res.status(500).json({ success: false, message: 'Scope resolution failed.' });
  }
};

/**
 * buildScopeFilter — utility used inside controllers to generate
 * the SQL WHERE clauses and params array for tenant+scope filtering.
 */
const buildScopeFilter = (req, alias = '', startCount = 0) => {
  const prefix = alias ? `${alias}.` : '';
  const params = [];
  const clauses = [];
  let count = startCount;

  const targetOrg = req.tenant;

  if (!req.scope?.unrestricted) {
    // 1. Organization Isolation
    count++;
    clauses.push(`${prefix}organization_id = $${count}`);
    params.push(targetOrg);

    // 2. Hierarchical Geo Scope
    if (req.scope?.constituency_id) {
      count++;
      clauses.push(`${prefix}constituency_id = $${count}`);
      params.push(req.scope.constituency_id);
    }
    if (req.scope?.ward_id) {
      count++;
      clauses.push(`${prefix}ward_id = $${count}`);
      params.push(req.scope.ward_id);
    }
    if (req.scope?.booth_id) {
      count++;
      clauses.push(`${prefix}booth_id = $${count}`);
      params.push(req.scope.booth_id);
    }

    // 3. Optional User-Level Privacy (for Workers)
    // Note: The controller must choose which tables to apply this to (e.g. tasks)
  }

  return {
    clause: clauses.length ? ` AND ${clauses.join(' AND ')}` : '',
    params,
    count,
  };
};

module.exports = { injectTenantScope, buildScopeFilter };
