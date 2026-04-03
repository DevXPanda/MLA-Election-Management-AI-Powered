const pool = require('../config/db');
const { logActivity, formatResponse } = require('../utils/helpers');

// Get messages (tenant-scoped)
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 20, target_type, channel } = req.query;

    let query = `
      SELECT m.*, sender.name as sender_name,
             (SELECT COUNT(*) FROM message_recipients mr WHERE mr.message_id = m.id) as recipient_count,
             (SELECT COUNT(*) FROM message_recipients mr WHERE mr.message_id = m.id AND mr.read_at IS NOT NULL) as read_count
      FROM messages m
      LEFT JOIN users sender ON m.sent_by = sender.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (!req.scope?.unrestricted) {
      paramCount++; query += ` AND m.organization_id = $${paramCount}`; params.push(req.tenant);
    }
    if (target_type) { paramCount++; query += ` AND m.target_type = $${paramCount}`; params.push(target_type); }
    if (channel) { paramCount++; query += ` AND m.channel = $${paramCount}`; params.push(channel); }

    const countResult = await pool.query(`SELECT COUNT(*) FROM (${query}) as cq`, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY m.created_at DESC';
    const offset = (page - 1) * limit;
    paramCount++; query += ` LIMIT $${paramCount}`; params.push(parseInt(limit));
    paramCount++; query += ` OFFSET $${paramCount}`; params.push(offset);

    const result = await pool.query(query, params);
    res.json(formatResponse(true, 'Messages fetched.', result.rows, {
      total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit)
    }));
  } catch (error) { console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

// Send message (org-scoped recipients)
const sendMessage = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, content, target_type, target_id, channel, recipient_ids } = req.body;
    if (!title || !content) return res.status(400).json(formatResponse(false, 'Title and content are required.'));

    const msgResult = await client.query(
      `INSERT INTO messages (title, content, sent_by, target_type, target_id, channel, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, content, req.user.id, target_type || 'custom', target_id || null, channel || 'push', req.tenant]
    );

    const messageId = msgResult.rows[0].id;
    let userIds = [];
    const orgClause = ` AND organization_id = ${req.tenant}`;

    if (recipient_ids && recipient_ids.length > 0) {
      userIds = recipient_ids;
    } else if (target_type === 'booth' && target_id) {
      const users = await client.query(`SELECT id FROM users WHERE booth_id = $1 AND status = 'active'${orgClause}`, [target_id]);
      userIds = users.rows.map(u => u.id);
    } else if (target_type === 'ward' && target_id) {
      const users = await client.query(`SELECT id FROM users WHERE ward_id = $1 AND status = 'active'${orgClause}`, [target_id]);
      userIds = users.rows.map(u => u.id);
    } else if (target_type === 'constituency' && target_id) {
      const users = await client.query(`SELECT id FROM users WHERE constituency_id = $1 AND status = 'active'${orgClause}`, [target_id]);
      userIds = users.rows.map(u => u.id);
    } else if (target_type === 'all') {
      const users = await client.query(`SELECT id FROM users WHERE status = 'active'${orgClause}`);
      userIds = users.rows.map(u => u.id);
    }

    for (const userId of userIds) {
      await client.query('INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)', [messageId, userId]);
    }

    await client.query('COMMIT');
    await logActivity(req.user.id, 'MESSAGE_SENT', 'messages', { title, recipient_count: userIds.length }, req.ip, req.tenant);
    res.status(201).json(formatResponse(true, 'Message sent.', { ...msgResult.rows[0], recipient_count: userIds.length }));
  } catch (error) { await client.query('ROLLBACK'); console.error(error); res.status(500).json(formatResponse(false, 'Internal server error.')); }
  finally { client.release(); }
};

const getInbox = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, mr.read_at, sender.name as sender_name
      FROM message_recipients mr
      JOIN messages m ON mr.message_id = m.id
      LEFT JOIN users sender ON m.sent_by = sender.id
      WHERE mr.user_id = $1 ORDER BY m.created_at DESC LIMIT 50
    `, [req.user.id]);
    res.json(formatResponse(true, 'Inbox fetched.', result.rows));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const markAsRead = async (req, res) => {
  try {
    await pool.query('UPDATE message_recipients SET read_at = CURRENT_TIMESTAMP WHERE message_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json(formatResponse(true, 'Marked as read.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

const deleteMessage = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM messages WHERE id = $1 AND organization_id = $2 RETURNING id', [req.params.id, req.tenant]);
    if (!result.rows.length) return res.status(404).json(formatResponse(false, 'Not found.'));
    res.json(formatResponse(true, 'Message deleted.'));
  } catch (error) { res.status(500).json(formatResponse(false, 'Internal server error.')); }
};

module.exports = { getMessages, sendMessage, getInbox, markAsRead, deleteMessage };
