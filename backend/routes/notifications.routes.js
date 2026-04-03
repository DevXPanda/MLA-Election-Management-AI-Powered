const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notifications.controller');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getNotifications);
router.put('/mark-read/:id', markAsRead);
router.put('/mark-read-all', markAllAsRead);

module.exports = router;
