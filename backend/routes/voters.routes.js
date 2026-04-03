const express = require('express');
const router = express.Router();
const { getVoters, createVoter, updateVoter, deleteVoter, getVoterStats } = require('../controllers/voters.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/stats', getVoterStats);
router.get('/', getVoters);
router.post('/', createVoter);
router.put('/:id', updateVoter);
router.delete('/:id', requireMinRole('campaign_manager'), deleteVoter);

module.exports = router;
