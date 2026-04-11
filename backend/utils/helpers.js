const pool = require('../config/db');

/**
 * Log an activity — now includes organization_id and entity tracking
 */
const logActivity = async (userId, action, module, details = {}, ipAddress = null, organizationId = null, eventId = null) => {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, module, details, ip_address, organization_id, event_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, module, JSON.stringify(details), ipAddress, organizationId, eventId]
    );
  } catch (error) {
    console.error('Error logging activity:', error.message);
  }
};

const paginate = (query, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  return `${query} LIMIT ${limit} OFFSET ${offset}`;
};

const formatResponse = (success, message, data = null, meta = null) => {
  const response = { success, message };
  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;
  return response;
};

/**
 * sendNotification — persists a tactical alert and broadcasts via Socket.io
 */
const sendNotification = async (req, userId, title, message, type = 'info', link = null) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, link, organization_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, title, message, type, link, req.tenant]
    );

    const notificationAt = result.rows[0];

    // Emit live to the user's private socket (or org-room if general)
    if (req.io) {
      // For now, we emit to the whole organization room if broad, 
      // but in a production environment, we'd emit to a private `user_${userId}` room.
      req.io.to(`org_${req.tenant}`).emit('notification:new', notificationAt);
    }
    return notificationAt;
  } catch (error) {
    console.error('Error sending notification:', error.message);
  }
};

module.exports = { logActivity, paginate, formatResponse, sendNotification };
