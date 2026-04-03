const express = require('express');
const router = express.Router();
const { getTeamMembers, addTeamMember, updateTeamMember, removeTeamMember, getTeamStats } = require('../controllers/teams.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/stats', getTeamStats);
router.get('/', getTeamMembers);
router.post('/', requireMinRole('campaign_manager'), addTeamMember);
router.put('/:id', requireMinRole('campaign_manager'), updateTeamMember);
router.delete('/:id', requireMinRole('campaign_manager'), removeTeamMember);

module.exports = router;
