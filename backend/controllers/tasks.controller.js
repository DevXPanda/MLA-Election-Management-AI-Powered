const pool = require('../config/db');
const { logActivity, formatResponse, sendNotification } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

const MANAGER_ROLES = ['super_admin', 'mla', 'campaign_manager', 'ward_head'];

const appendTaskLog = async (client, taskId, userId, action, details = {}) => {
  const q = `INSERT INTO task_activity_log (task_id, user_id, action, details) VALUES ($1, $2, $3, $4)`;
  const params = [taskId, userId, action, JSON.stringify(details)];
  if (client && client.query) {
    await client.query(q, params);
  } else {
    await pool.query(q, params);
  }
};

const isLateForDueDate = (dueDateVal, completedAt = new Date()) => {
  if (!dueDateVal) return false;
  const d = typeof dueDateVal === 'string' ? dueDateVal.split('T')[0] : dueDateVal;
  const endOfDue = new Date(`${d}T23:59:59`);
  return completedAt > endOfDue;
};

// ── Get all tasks (tenant + scope filtered) ──────────────────────────
const getTasks = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, assigned_to, priority } = req.query;

    let query = `
      SELECT t.*, 
             assignee.name as assigned_to_name,
             assigner.name as assigned_by_name,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', u.id, 'name', u.name, 'phone', u.phone,
                 'role_name', r.name, 'role_display_name', r.display_name
               ))
                FROM task_assignees ta2
                JOIN users u ON ta2.user_id = u.id
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE ta2.task_id = t.id),
               CASE WHEN t.assigned_to IS NOT NULL THEN
                 (SELECT json_agg(json_build_object(
                   'id', u.id, 'name', u.name, 'phone', u.phone,
                   'role_name', r.name, 'role_display_name', r.display_name
                 ))
                  FROM users u
                  LEFT JOIN roles r ON u.role_id = r.id
                  WHERE u.id = t.assigned_to)
               END
             ) as assignees
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

    const { clause, params: scopeParams, count } = buildScopeFilter(req, 't', paramCount);
    query += clause;
    params = [...params, ...scopeParams];
    paramCount = count;

    if (req.userRole === 'booth_worker') {
      paramCount++;
      query += ` AND (
        t.assigned_to = $${paramCount}
        OR EXISTS (SELECT 1 FROM task_assignees ta0 WHERE ta0.task_id = t.id AND ta0.user_id = $${paramCount})
      )`;
      params.push(req.user.id);
    }

    if (status) { paramCount++; query += ` AND t.status = $${paramCount}`; params.push(status); }
    if (type) { paramCount++; query += ` AND t.type = $${paramCount}`; params.push(type); }
    if (assigned_to && req.userRole !== 'booth_worker') {
      paramCount++;
      query += ` AND (
        t.assigned_to = $${paramCount}
        OR EXISTS (SELECT 1 FROM task_assignees ta1 WHERE ta1.task_id = t.id AND ta1.user_id = $${paramCount})
      )`;
      params.push(assigned_to);
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

const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    let q = `
      SELECT t.*, 
             assignee.name as assigned_to_name,
             assigner.name as assigned_by_name,
             completer.name as completed_by_name,
             c.name as constituency_name, w.name as ward_name, b.name as booth_name,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', u.id, 'name', u.name, 'phone', u.phone,
                 'role_name', r.name, 'role_display_name', r.display_name
               ))
                FROM task_assignees ta2
                JOIN users u ON ta2.user_id = u.id
                LEFT JOIN roles r ON u.role_id = r.id
                WHERE ta2.task_id = t.id),
               CASE WHEN t.assigned_to IS NOT NULL THEN
                 (SELECT json_agg(json_build_object(
                   'id', u.id, 'name', u.name, 'phone', u.phone,
                   'role_name', r.name, 'role_display_name', r.display_name
                 ))
                  FROM users u
                  LEFT JOIN roles r ON u.role_id = r.id
                  WHERE u.id = t.assigned_to)
               END
             ) as assignees
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users assigner ON t.assigned_by = assigner.id
      LEFT JOIN users completer ON t.completed_by = completer.id
      LEFT JOIN constituencies c ON t.constituency_id = c.id
      LEFT JOIN wards w ON t.ward_id = w.id
      LEFT JOIN booths b ON t.booth_id = b.id
      WHERE t.id = $1
    `;
    const params = [id];
    const { clause, params: scopeParams } = buildScopeFilter(req, 't', 1);
    q += clause;
    params.push(...scopeParams);

    const row = await pool.query(q, params);
    if (!row.rows.length) return res.status(404).json(formatResponse(false, 'Task not found.'));

    const log = await pool.query(
      `SELECT l.*, u.name as user_name FROM task_activity_log l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.task_id = $1 ORDER BY l.created_at ASC`,
      [id]
    );

    res.json(formatResponse(true, 'Task detail.', { ...row.rows[0], activity: log.rows }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

const resolveAssigneeIds = async (client, { assigned_to, assigned_user_ids, expand_team_leader_id, tenant }) => {
  const ids = new Set();
  if (Array.isArray(assigned_user_ids)) {
    assigned_user_ids.forEach((uid) => { if (uid != null) ids.add(parseInt(uid, 10)); });
  }
  if (assigned_to) ids.add(parseInt(assigned_to, 10));
  if (expand_team_leader_id) {
    const r = await client.query(
      `SELECT user_id FROM team_members WHERE team_leader_id = $1 AND organization_id = $2 AND status = 'active'`,
      [expand_team_leader_id, tenant]
    );
    r.rows.forEach((x) => ids.add(x.user_id));
  }
  return [...ids].filter((n) => !Number.isNaN(n));
};

// ── Create task ─────────────────────────────────────────────────────
const createTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      title, description, type, assigned_to, assigned_user_ids, expand_team_leader_id,
      booth_id, ward_id, constituency_id, priority, due_date, assigner_remarks
    } = req.body;

    if (!title || !type) {
      return res.status(400).json(formatResponse(false, 'Title and type are required.'));
    }

    await client.query('BEGIN');

    const assigneeIds = await resolveAssigneeIds(client, {
      assigned_to, assigned_user_ids, expand_team_leader_id, tenant: req.tenant
    });
    const primaryAssignee = assigneeIds.length ? assigneeIds[0] : (assigned_to || null);

    const result = await client.query(
      `INSERT INTO tasks (
        title, description, type, assigned_to, assigned_by, booth_id, ward_id, constituency_id,
        priority, due_date, assigner_remarks, organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        title, description, type, primaryAssignee, req.user.id,
        booth_id || null, ward_id || null, constituency_id || null,
        priority || 'medium', due_date || null, assigner_remarks || null, req.tenant
      ]
    );

    const task = result.rows[0];

    for (const uid of assigneeIds) {
      await client.query(
        `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT (task_id, user_id) DO NOTHING`,
        [task.id, uid]
      );
    }

    await appendTaskLog(client, task.id, req.user.id, 'created', {
      title, assignee_ids: assigneeIds, assigner_remarks: assigner_remarks || null
    });

    await client.query('COMMIT');

    await logActivity(req.user.id, 'TASK_CREATED', 'tasks', { title, task_id: task.id, assignees: assigneeIds }, req.ip, req.tenant);

    if (req.io) {
      req.io.to(`org_${req.tenant}`).emit('task:created', task);
    }

    for (const uid of assigneeIds) {
      await sendNotification(
        req,
        uid,
        'New task assigned',
        `You have been assigned: ${title}`,
        'task',
        '/dashboard/tasks'
      );
    }

    res.status(201).json(formatResponse(true, 'Task created.', task));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  } finally {
    client.release();
  }
};

// ── Update task ─────────────────────────────────────────────────────
const updateTask = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      title, description, type, assigned_to, assigned_user_ids, expand_team_leader_id,
      booth_id, ward_id, constituency_id, priority, status, due_date, remarks,
      assigner_remarks, assignee_remarks
    } = req.body;

    const exists = await client.query(
      'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
      [req.params.id, req.tenant]
    );
    if (!exists.rows.length) return res.status(404).json(formatResponse(false, 'Task not found.'));

    const task = exists.rows[0];
    const assigneeRows = await client.query(
      'SELECT user_id FROM task_assignees WHERE task_id = $1',
      [req.params.id]
    );
    const assigneeSet = new Set(assigneeRows.rows.map((r) => r.user_id));
    if (task.assigned_to) assigneeSet.add(task.assigned_to);

    const canManage = MANAGER_ROLES.includes(req.userRole);
    const isAssignee = assigneeSet.has(req.user.id);

    if (!canManage && !isAssignee) {
      return res.status(403).json(formatResponse(false, 'Not allowed to update this task.'));
    }

    if (!canManage && isAssignee) {
      if (status !== undefined && !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        return res.status(403).json(formatResponse(false, 'Invalid status for assignee.'));
      }
    }

    await client.query('BEGIN');

    if (!canManage && isAssignee) {
      let nextStatus = status !== undefined ? status : task.status;
      let completedAt = task.completed_at;
      let completedBy = task.completed_by;
      let isLate = task.is_late_completion;
      let nextAssigneeRemarks = task.assignee_remarks;

      if (assignee_remarks != null && String(assignee_remarks).trim()) {
        const add = String(assignee_remarks).trim();
        nextAssigneeRemarks = nextAssigneeRemarks ? `${nextAssigneeRemarks}\n${add}` : add;
      }
      if (nextStatus === 'completed' && task.status !== 'completed') {
        completedAt = new Date();
        completedBy = req.user.id;
        if (isLateForDueDate(task.due_date, completedAt)) {
          isLate = true;
          const auto = '[System] Late submission';
          nextAssigneeRemarks = nextAssigneeRemarks ? `${nextAssigneeRemarks}\n${auto}` : auto;
        }
        await appendTaskLog(client, task.id, req.user.id, 'status_changed', {
          status: 'completed', is_late_completion: isLate
        });
      } else if (status !== undefined) {
        await appendTaskLog(client, task.id, req.user.id, 'status_changed', { status: nextStatus });
      }
      if (assignee_remarks != null && String(assignee_remarks).trim()) {
        await appendTaskLog(client, task.id, req.user.id, 'remark_added', { text: String(assignee_remarks).trim() });
      }

      const result = await client.query(
        `UPDATE tasks SET
           status = $1,
           completed_at = CASE WHEN $1 = 'completed' THEN COALESCE($2, completed_at) ELSE completed_at END,
           completed_by = CASE WHEN $1 = 'completed' THEN COALESCE($3, completed_by) ELSE completed_by END,
           is_late_completion = $4,
           assignee_remarks = $5,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $6 AND organization_id = $7 RETURNING *`,
        [
          nextStatus,
          completedAt,
          completedBy,
          isLate,
          nextAssigneeRemarks,
          req.params.id,
          req.tenant
        ]
      );

      await client.query('COMMIT');
      const updated = result.rows[0];
      await logActivity(req.user.id, 'TASK_UPDATED', 'tasks', { id: req.params.id, status: nextStatus }, req.ip, req.tenant);
      if (req.io) req.io.to(`org_${req.tenant}`).emit('task:updated', updated);
      return res.json(formatResponse(true, 'Task updated.', updated));
    }

    // Managers: full update
    let completedAtUpdate = task.completed_at;
    let completedByUpdate = task.completed_by;
    let isLateUpdate = task.is_late_completion;
    let finalAssigneeRemarks = task.assignee_remarks;
    const nextStatus = status !== undefined ? status : task.status;

    if (status === 'completed' && task.status !== 'completed') {
      completedAtUpdate = new Date();
      completedByUpdate = req.user.id;
      const dueRef = due_date !== undefined ? due_date : task.due_date;
      if (isLateForDueDate(dueRef, completedAtUpdate)) {
        isLateUpdate = true;
        const auto = '[System] Late submission';
        finalAssigneeRemarks = [task.assignee_remarks, auto].filter(Boolean).join('\n');
      }
    }

    let nextAssignerRemarks = assigner_remarks !== undefined ? assigner_remarks : task.assigner_remarks;
    if (assignee_remarks != null && String(assignee_remarks).trim()) {
      const add = String(assignee_remarks).trim();
      finalAssigneeRemarks = finalAssigneeRemarks ? `${finalAssigneeRemarks}\n${add}` : add;
    }

    const mergedRemarks = remarks !== undefined ? remarks : task.remarks;

    const result = await client.query(
      `UPDATE tasks SET
         title = COALESCE($1, title), description = COALESCE($2, description),
         type = COALESCE($3, type), assigned_to = COALESCE($4, assigned_to),
         booth_id = $5, ward_id = $6, constituency_id = $7,
         priority = COALESCE($8, priority), status = COALESCE($9, status),
         due_date = COALESCE($10, due_date),
         completed_at = $11,
         completed_by = $12,
         is_late_completion = $13,
         remarks = COALESCE($14, remarks),
         assigner_remarks = COALESCE($15, assigner_remarks),
         assignee_remarks = COALESCE($16, assignee_remarks),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $17 AND organization_id = $18 RETURNING *`,
      [
        title, description, type, assigned_to, booth_id || null, ward_id || null,
        constituency_id || null, priority, status, due_date,
        completedAtUpdate,
        completedByUpdate,
        isLateUpdate,
        mergedRemarks,
        nextAssignerRemarks,
        finalAssigneeRemarks,
        req.params.id,
        req.tenant
      ]
    );

    let updatedTask = result.rows[0];

    if (assigned_user_ids !== undefined || expand_team_leader_id !== undefined) {
      const assigneeIds = await resolveAssigneeIds(client, {
        assigned_to: assigned_to !== undefined ? assigned_to : updatedTask.assigned_to,
        assigned_user_ids: assigned_user_ids !== undefined ? assigned_user_ids : [],
        expand_team_leader_id,
        tenant: req.tenant
      });
      await client.query('DELETE FROM task_assignees WHERE task_id = $1', [req.params.id]);
      for (const uid of assigneeIds) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT (task_id, user_id) DO NOTHING`,
          [req.params.id, uid]
        );
      }
      if (assigneeIds.length) {
        const r2 = await client.query(
          `UPDATE tasks SET assigned_to = $1 WHERE id = $2 AND organization_id = $3 RETURNING *`,
          [assigneeIds[0], req.params.id, req.tenant]
        );
        updatedTask = r2.rows[0];
      } else {
        const r2 = await client.query(
          `UPDATE tasks SET assigned_to = NULL WHERE id = $1 AND organization_id = $2 RETURNING *`,
          [req.params.id, req.tenant]
        );
        updatedTask = r2.rows[0];
      }
    } else if (assigned_to !== undefined && assigned_user_ids === undefined) {
      await client.query('DELETE FROM task_assignees WHERE task_id = $1', [req.params.id]);
      if (assigned_to) {
        await client.query(
          `INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT (task_id, user_id) DO NOTHING`,
          [req.params.id, assigned_to]
        );
      }
    }

    if (status !== undefined) {
      await appendTaskLog(client, task.id, req.user.id, 'status_changed', {
        status: nextStatus,
        is_late_completion: updatedTask.is_late_completion
      });
    }

    await client.query('COMMIT');

    await logActivity(req.user.id, 'TASK_UPDATED', 'tasks', { id: req.params.id, status }, req.ip, req.tenant);

    if (req.io) {
      req.io.to(`org_${req.tenant}`).emit('task:updated', updatedTask);
    }

    if (updatedTask.assigned_to) {
      await sendNotification(
        req,
        updatedTask.assigned_to,
        'Task Update',
        `Task "${updatedTask.title}" updated`,
        'info',
        '/dashboard/tasks'
      );
    }

    res.json(formatResponse(true, 'Task updated.', updatedTask));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  } finally {
    client.release();
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

module.exports = { getTasks, getTaskById, createTask, updateTask, deleteTask, getTaskStats };
