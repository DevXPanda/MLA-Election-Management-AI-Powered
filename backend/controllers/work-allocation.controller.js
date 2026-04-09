const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

const WORK_TYPES = [
  'Crowd Management',
  'Tent & Stage',
  'Food Arrangement',
  'Poster & Banner',
  'Holding Boards',
  'Print & Design',
  'Invitations',
  'Government Approval',
  'Security Management',
  'Transport & Logistics',
  'Media Coverage',
  'Volunteer Coordination'
];

// Get all work allocations
const getAllocations = async (req, res) => {
  try {
    const { event_id, status, work_type, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT wa.*, e.title as event_title, e.event_date, e.location as event_location,
             creator.name as created_by_name,
             (SELECT json_agg(json_build_object('id', u.id, 'name', u.name))
              FROM work_allocation_users wau
              JOIN users u ON wau.user_id = u.id
              WHERE wau.work_allocation_id = wa.id) as assigned_users
      FROM work_allocations wa
      JOIN events e ON wa.event_id = e.id
      LEFT JOIN users creator ON wa.created_by = creator.id
      WHERE wa.organization_id = $1
    `;
    let params = [req.tenant];
    let paramCount = 1;

    if (event_id) {
      paramCount++;
      query += ` AND wa.event_id = $${paramCount}`;
      params.push(event_id);
    }
    if (status) {
      paramCount++;
      query += ` AND wa.status = $${paramCount}`;
      params.push(status);
    }
    if (work_type) {
      paramCount++;
      query += ` AND wa.work_type = $${paramCount}`;
      params.push(work_type);
    }

    // Role-based scoping
    // Role-based filtering logic: Only Admins see everything. Others see assigned/created work.
    if (req.userRole !== 'super_admin' && req.userRole !== 'mla') {
      paramCount++;
      query += ` AND (
        wa.id IN (SELECT work_allocation_id FROM work_allocation_users WHERE user_id = $${paramCount})
        OR wa.created_by = $${paramCount}
      )`;
      params.push(req.user.id);
    }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY wa.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Work allocations fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Get tasks assigned to self
const getMyTasks = async (req, res) => {
  try {
    const query = `
      SELECT wa.*, e.title as event_title, e.event_date, e.location as event_location,
             creator.name as assigned_by_name
      FROM work_allocations wa
      JOIN events e ON wa.event_id = e.id
      JOIN work_allocation_users wau ON wa.id = wau.work_allocation_id
      LEFT JOIN users creator ON wa.created_by = creator.id
      WHERE wau.user_id = $1 AND wa.organization_id = $2
      ORDER BY wa.due_date ASC
    `;
    const result = await pool.query(query, [req.user.id, req.tenant]);
    res.json(formatResponse(true, 'Your assigned tasks.', result.rows));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Update task status and meta
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, not_completed_reason } = req.body;

  try {
    // Check if user is assigned to this task (unless admin)
    if (req.userRole !== 'super_admin' && req.userRole !== 'mla') {
      const assignmentCheck = await pool.query(
        'SELECT 1 FROM work_allocation_users WHERE work_allocation_id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      if (!assignmentCheck.rows.length) return res.status(403).json(formatResponse(false, 'Not assigned to this task.'));
    }

    let updates = 'status = $1, updated_at = CURRENT_TIMESTAMP';
    let params = [status, id, req.tenant];

    if (status === 'processing') {
      updates += ', started_at = CURRENT_TIMESTAMP';
    } else if (status === 'completed') {
      // Logic: Ensure after_image exists? Usually handled in upload-proof but can check here
      const checkProof = await pool.query('SELECT after_image_url FROM work_allocations WHERE id = $1', [id]);
      if (!checkProof.rows[0].after_image_url) {
        return res.status(400).json(formatResponse(false, 'Proof of completion (After Photo) is required.'));
      }
      updates += ', completed_at = CURRENT_TIMESTAMP';
    } else if (status === 'not_completed') {
      if (!not_completed_reason) return res.status(400).json(formatResponse(false, 'Reason is required for non-completion.'));
      updates += ', not_completed_reason = $4';
      params.push(not_completed_reason);
    }

    const query = `UPDATE work_allocations SET ${updates} WHERE id = $2 AND organization_id = $3 RETURNING *`;
    const result = await pool.query(query, params);

    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Task not found.'));

    await logActivity(req.user.id, 'WORK_STATUS_UPDATED', 'work_allocations', { id, status }, req.ip, req.tenant);
    res.json(formatResponse(true, `Task status marked as ${status}.`, result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Upload proof with geo-tagging
const uploadProof = async (req, res) => {
  const { id } = req.params;
  const { type, image_url, geo_location } = req.body; // type: 'before' or 'after'

  if (!['before', 'after'].includes(type)) return res.status(400).json(formatResponse(false, 'Invalid proof type.'));
  if (!image_url) return res.status(400).json(formatResponse(false, 'Image URL is required.'));

  try {
    const colImage = type === 'before' ? 'before_image_url' : 'after_image_url';
    const colGeo = type === 'before' ? 'geo_location_before' : 'geo_location_after';

    const query = `
      UPDATE work_allocations 
      SET ${colImage} = $1, ${colGeo} = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3 AND organization_id = $4 RETURNING *
    `;
    const result = await pool.query(query, [image_url, JSON.stringify(geo_location), id, req.tenant]);

    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Task not found.'));

    await logActivity(req.user.id, 'WORK_PROOF_UPLOADED', 'work_allocations', { id, type, geo_location }, req.ip, req.tenant);
    res.json(formatResponse(true, `Proof (${type}) uploaded successfully.`, result.rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Get stats for dashboard
const getWorkStats = async (req, res) => {
  try {
    const totalQuery = 'SELECT COUNT(*) FROM work_allocations WHERE organization_id = $1';
    const statusQuery = `
      SELECT status, COUNT(*) 
      FROM work_allocations 
      WHERE organization_id = $1 
      GROUP BY status
    `;
    const eventProgressQuery = `
      SELECT e.title, 
             COUNT(*) as total_tasks,
             COUNT(*) FILTER (WHERE wa.status = 'completed') as completed_tasks
      FROM work_allocations wa
      JOIN events e ON wa.event_id = e.id
      WHERE wa.organization_id = $1
      GROUP BY e.id, e.title
    `;
    const userPerformanceQuery = `
      SELECT u.name, 
             COUNT(wau.work_allocation_id) as total_assigned,
             COUNT(wa.id) FILTER (WHERE wa.status = 'completed') as completed
      FROM users u
      JOIN work_allocation_users wau ON u.id = wau.user_id
      JOIN work_allocations wa ON wau.work_allocation_id = wa.id
      WHERE u.organization_id = $1
      GROUP BY u.id, u.name
      ORDER BY completed DESC
      LIMIT 10
    `;

    const [total, statuses, events, users] = await Promise.all([
      pool.query(totalQuery, [req.tenant]),
      pool.query(statusQuery, [req.tenant]),
      pool.query(eventProgressQuery, [req.tenant]),
      pool.query(userPerformanceQuery, [req.tenant])
    ]);

    res.json(formatResponse(true, 'Work execution stats fetched.', {
      total: parseInt(total.rows[0].count),
      by_status: statuses.rows,
      by_event: events.rows,
      by_user: users.rows
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Original CRUD
const createAllocation = async (req, res) => {
  const client = await pool.connect();
  try {
    const { event_id, work_type, description, due_date, assigned_user_ids } = req.body;
    if (!event_id || !work_type) return res.status(400).json(formatResponse(false, 'Event ID and Work Type are required.'));

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO work_allocations (event_id, work_type, description, due_date, organization_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [event_id, work_type, description, due_date || null, req.tenant, req.user.id]
    );

    const allocationId = result.rows[0].id;
    if (assigned_user_ids && Array.isArray(assigned_user_ids)) {
      for (const userId of assigned_user_ids) {
        await client.query(`INSERT INTO work_allocation_users (work_allocation_id, user_id) VALUES ($1, $2)`, [allocationId, userId]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(formatResponse(true, 'Work allocation created.', result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  } finally {
    client.release();
  }
};

const updateAllocation = async (req, res) => {
  const client = await pool.connect();
  try {
    const { status, description, due_date, assigned_user_ids } = req.body;
    const { id } = req.params;
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE work_allocations SET status = COALESCE($1, status), description = COALESCE($2, description), due_date = COALESCE($3, due_date), updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND organization_id = $5 RETURNING *`,
      [status, description, due_date, id, req.tenant]
    );
    if (assigned_user_ids && Array.isArray(assigned_user_ids)) {
      await client.query('DELETE FROM work_allocation_users WHERE work_allocation_id = $1', [id]);
      for (const userId of assigned_user_ids) {
        await client.query(`INSERT INTO work_allocation_users (work_allocation_id, user_id) VALUES ($1, $2)`, [id, userId]);
      }
    }
    await client.query('COMMIT');
    res.json(formatResponse(true, 'Work allocation updated.', result.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  } finally {
    client.release();
  }
};

const deleteAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM work_allocations WHERE id = $1 AND organization_id = $2 RETURNING id', [id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Work allocation not found.'));
    res.json(formatResponse(true, 'Work allocation deleted.'));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const getWorkTypes = (req, res) => {
  res.json(formatResponse(true, 'Work types fetched.', WORK_TYPES));
};

module.exports = { 
  getAllocations, 
  getMyTasks,
  updateStatus,
  uploadProof,
  getWorkStats,
  createAllocation, 
  updateAllocation, 
  deleteAllocation,
  getWorkTypes
};
