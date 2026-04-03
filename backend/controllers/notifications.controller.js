const pool = require('../config/db');
const { formatResponse } = require('../utils/helpers');

// Get user notifications
const getNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    const unreadCount = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user.id]
    );

    res.json(formatResponse(true, 'Notifications fetched.', {
      notifications: result.rows,
      unread_count: parseInt(unreadCount.rows[0].count)
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Mark as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json(formatResponse(true, 'Notification marked as read.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

// Mark all as read
const markAllAsRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json(formatResponse(true, 'All notifications marked as read.'));
  } catch (error) {
    res.status(500).json(formatResponse(false, 'Internal server error.'));
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
