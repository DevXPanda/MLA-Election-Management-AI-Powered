const pool = require('../config/db');
const { logActivity, formatResponse, sendNotification } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

// ── Get all tasks (tenant + scope filtered) ──────────────────────────
const getTasks = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, assigned_to, priority } = req.query;

    let query = `
      SELECT t.*, 
             assignee.name as assigned_to_name,
             assigner.name as assigned_by_name,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
      LEFT JOIN constituencies c ON t.constituency_id = c.id
      LEFT JOIN wards w ON t.ward_id = w.id
      LEFT JOIN booths b ON t.booth_id = b.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    // ── Apply tenant + hierarchical scope ────────────────────────────
    const { clause, params: scopeParams, count } = buildScopeFilter(req, 't', paramCount);
    query += clause;
    params = [...params, ...scopeParams];
    paramCount = count;

    // Booth workers only see their own assigned tasks
    if (req.userRole === 'booth_worker') {
      paramCount++;
      query += ` AND t.assigned_to = $${paramCount}`;
      params.push(req.user.id);
    }

    // Additional manual filters
    if (status) { paramCount++; query += ` AND t.status = $${paramCount}`; params.push(status); }
    if (type) { paramCount++; query += ` AND t.type = $${paramCount}`; params.push(type); }
    if (assigned_to && req.userRole !== 'booth_worker') {
      paramCount++; query += ` AND t.assigned_to = $${paramCount}`; params.push(assigned_to);
    }
    if (priority) { paramCount++; query += ` AND t.priority = $${paramCount}`; params.push(priority); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY t.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Tasks fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── Create task (auto-sets org_id) ──────────────────────────────────
const createTask = async (req, res) => {
  try {
    const { title, description, type, assigned_to, booth_id, ward_id, constituency_id, priority, due_date } = req.body;

    if (!title || !type) {
      return res.status(400).json(formatResponse(false, 'Title and type are required.'));
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description, type, assigned_to, assigned_by, booth_id, ward_id, constituency_id, priority, due_date, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, description, type, assigned_to || null, req.user.id,
       booth_id || null, ward_id || null, constituency_id || null,
       priority || 'medium', due_date || null, req.tenant]
    );

    const task = result.rows[0];
    await logActivity(req.user.id, 'TASK_CREATED', 'tasks', { title, assigned_to }, req.ip, req.tenant);

    // Emit real-time event
    if (req.io) {
      req.io.to(`org_${req.tenant}`).emit('task:created', task);
    }

    // Send tactical notification to assignee
    if (assigned_to) {
      await sendNotification(
        req, 
        assigned_to, 
        'New Mission Assigned', 
        `You have been assigned a new task: ${title}`, 
        'task', 
        '/dashboard/tasks'
      );
    }

    res.status(201).json(formatResponse(true, 'Task created.', task));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── Update task ─────────────────────────────────────────────────────
const updateTask = async (req, res) => {
  try {
    const { title, description, type, assigned_to, booth_id, ward_id, constituency_id, priority, status, due_date, remarks } = req.body;

    let completedAt = null;
    if (status === 'completed') completedAt = new Date();

    // Scope: only update task within same org
    const exists = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.tenant]
    );
    if (!exists.rows.length) return res.status(404).json(formatResponse(false, 'Task not found.'));

    const result = await pool.query(
      `UPDATE tasks SET
         title = COALESCE($1, title), description = COALESCE($2, description),
         type = COALESCE($3, type), assigned_to = COALESCE($4, assigned_to),
         booth_id = $5, ward_id = $6, constituency_id = $7,
         priority = COALESCE($8, priority), status = COALESCE($9, status),
         due_date = COALESCE($10, due_date), completed_at = COALESCE($11, completed_at),
         remarks = COALESCE($12, remarks), updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 AND organization_id = $14 RETURNING *`,
      [title, description, type, assigned_to, booth_id || null, ward_id || null,
       constituency_id || null, priority, status, due_date, completedAt, remarks, req.params.id, req.tenant]
    );

    const task = result.rows[0];
    await logActivity(req.user.id, 'TASK_UPDATED', 'tasks', { id: req.params.id, status }, req.ip, req.tenant);

    // Emit real-time event
    if (req.io) {
      req.io.to(`org_${req.tenant}`).emit('task:updated', task);
    }

    // Notify assignee of status change
    if (task.assigned_to) {
      await sendNotification(
        req, 
        task.assigned_to, 
        'Task Update', 
        `Your task "${task.title}" status changed to ${status}`, 
        'info', 
        '/dashboard/tasks'
      );
    }

    res.json(formatResponse(true, 'Task updated.', task));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── Delete task ─────────────────────────────────────────────────────
const deleteTask = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND organization_id = $2 RETURNING id',
      [req.params.id, req.tenant]
    );
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Task not found.'));

    await logActivity(req.user.id, 'TASK_DELETED', 'tasks', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Task deleted.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// ── Task stats (scoped) ─────────────────────────────────────────────
const getTaskStats = async (req, res) => {
  try {
    const { clause, params } = buildScopeFilter(req);

    const [byStatus, byPriority, byType, overdue, todayTasks] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) as count FROM tasks WHERE 1=1 ${clause} GROUP BY status`, params),
      pool.query(`SELECT priority, COUNT(*) as count FROM tasks WHERE 1=1 ${clause} GROUP BY priority`, params),
      pool.query(`SELECT type, COUNT(*) as count FROM tasks WHERE 1=1 ${clause} GROUP BY type`, params),
      pool.query(`SELECT COUNT(*) FROM tasks WHERE due_date < CURRENT_DATE AND status != 'completed' ${clause}`, params),
      pool.query(`SELECT COUNT(*) FROM tasks WHERE DATE(created_at) = CURRENT_DATE ${clause}`, params),
    ]);

    res.json(formatResponse(true, 'Task stats fetched.', {
      by_status: byStatus.rows,
      by_priority: byPriority.rows,
      by_type: byType.rows,
      overdue: parseInt(overdue.rows[0].count),
      today: parseInt(todayTasks.rows[0].count)
    }));
  } catch (error) {
    console.error('Task Stats error:', error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = { getTasks, createTask, updateTask, deleteTask, getTaskStats };
