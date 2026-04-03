const express = require('express');
const router = express.Router();
const { getMessages, sendMessage, getInbox, markAsRead, deleteMessage } = require('../controllers/messages.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/inbox', getInbox);
router.get('/', requireMinRole('campaign_manager'), getMessages);
router.post('/', requireMinRole('campaign_manager'), sendMessage);
router.put('/:id/read', markAsRead);
router.delete('/:id', requireMinRole('campaign_manager'), deleteMessage);

module.exports = router;
