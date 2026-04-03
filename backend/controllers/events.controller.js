const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');
const { buildScopeFilter } = require('../middleware/tenant');

// Get events (tenant-scoped)
const getEvents = async (req, res) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT e.*, c.name as constituency_name, w.name as ward_name,
             creator.name as created_by_name,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) as participant_count,
             (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id AND ep.attended = true) as attended_count
      FROM events e
      LEFT JOIN constituencies c ON e.constituency_id = c.id
      LEFT JOIN wards w ON e.ward_id = w.id
      LEFT JOIN users creator ON e.created_by = creator.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    const { clause, params: scopeParams, count } = buildScopeFilter(req, 'e', paramCount);
    query += clause; params = [...params, ...scopeParams]; paramCount = count;

    if (status) { paramCount++; query += ` AND e.status = $${paramCount}`; params.push(status); }
    if (type) { paramCount++; query += ` AND e.type = $${paramCount}`; params.push(type); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY e.event_date DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);

    res.json(formatResponse(true, 'Events fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Create event
const createEvent = async (req, res) => {
  try {
    const { title, type, description, event_date, location, constituency_id, ward_id, expected_attendance } = req.body;
    if (!title || !type || !event_date) return res.status(400).json(formatResponse(false, 'Title, type, and date are required.'));

    const result = await pool.query(
      `INSERT INTO events (title, type, description, event_date, location, constituency_id, ward_id, expected_attendance, created_by, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [title, type, description, event_date, location, constituency_id || null, ward_id || null, expected_attendance || 0, req.user.id, req.tenant]
    );

    await logActivity(req.user.id, 'EVENT_CREATED', 'events', { title, type }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'Event created.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const { title, type, description, event_date, location, constituency_id, ward_id, expected_attendance, actual_attendance, status } = req.body;

    const result = await pool.query(
      `UPDATE events SET title = COALESCE($1, title), type = COALESCE($2, type),
       description = COALESCE($3, description), event_date = COALESCE($4, event_date),
       location = COALESCE($5, location), constituency_id = $6, ward_id = $7,
       expected_attendance = COALESCE($8, expected_attendance),
       actual_attendance = COALESCE($9, actual_attendance),
       status = COALESCE($10, status), updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND organization_id = $12 RETURNING *`,
      [title, type, description, event_date, location, constituency_id || null, ward_id || null, expected_attendance, actual_attendance, status, req.params.id, req.tenant]
    );

    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Event not found.'));
    res.json(formatResponse(true, 'Event updated.', result.rows[0]));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Delete event
const deleteEvent = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM events WHERE id = $1 AND organization_id = $2 RETURNING id', [req.params.id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Event not found.'));
    await logActivity(req.user.id, 'EVENT_DELETED', 'events', { id: req.params.id }, req.ip, req.tenant);
    res.json(formatResponse(true, 'Event deleted.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Add participants
const addParticipants = async (req, res) => {
  try {
    const { participants } = req.body;
    const eventId = req.params.id;
    for (const p of participants) {
      await pool.query(
        `INSERT INTO event_participants (event_id, user_id, role_in_event) VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id) DO UPDATE SET role_in_event = $3`,
        [eventId, p.user_id, p.role_in_event || 'volunteer']
      );
    }
    res.json(formatResponse(true, 'Participants added.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Get participants
const getParticipants = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ep.*, u.name, u.phone, u.email, r.display_name as role_name
       FROM event_participants ep
       JOIN users u ON ep.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE ep.event_id = $1 ORDER BY ep.created_at`, [req.params.id]
    );
    res.json(formatResponse(true, 'Participants fetched.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Mark attendance
const markAttendance = async (req, res) => {
  try {
    const { user_id, attended } = req.body;
    await pool.query('UPDATE event_participants SET attended = $1 WHERE event_id = $2 AND user_id = $3', [attended, req.params.id, user_id]);
    res.json(formatResponse(true, 'Attendance marked.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = { getEvents, createEvent, updateEvent, deleteEvent, addParticipants, getParticipants, markAttendance };
