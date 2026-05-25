const express = require('express');
const router = express.Router();
const {
  createMember,
  getMembers,
  getMember,
  updateMember,
  deleteMember,
  getSummary,
  getTopPerformers,
  getWards,
  getCreatorDetails
} = require('../controllers/party-members.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

// Enforce auth and scope
router.use(authenticateToken, injectTenantScope);
// Minimum role: Ward Head (super_admin, mla, campaign_manager, ward_head are allowed)
router.use(requireMinRole('ward_head'));

// Analytics routes (Declared before :id wildcard)
router.get('/analytics/summary', getSummary);
router.get('/analytics/top-performers', getTopPerformers);
router.get('/analytics/wards', getWards);
router.get('/analytics/creator/:id', getCreatorDetails);

router.get('/', getMembers);
router.get('/:id', getMember);
router.post('/', createMember);
router.put('/:id', updateMember);
router.delete('/:id', deleteMember);

module.exports = router;
