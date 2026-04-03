const express = require('express');
const router = express.Router();
const { getTasks, createTask, updateTask, deleteTask, getTaskStats } = require('../controllers/tasks.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/stats', getTaskStats);
router.get('/', getTasks);
router.post('/', requireMinRole('ward_head'), createTask);
router.put('/:id', updateTask);
router.delete('/:id', requireMinRole('campaign_manager'), deleteTask);

module.exports = router;
