const express = require('express');
const router = express.Router();
const { getDashboardStats, getActivityLog } = require('../controllers/dashboard.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/stats', getDashboardStats);
router.get('/activity', requireMinRole('campaign_manager'), getActivityLog);

module.exports = router;
