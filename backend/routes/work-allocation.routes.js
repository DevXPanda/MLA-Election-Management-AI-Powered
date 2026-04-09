const express = require('express');
const router = express.Router();
const { 
  getAllocations, 
  getMyTasks,
  updateStatus,
  uploadProof,
  getWorkStats,
  createAllocation, 
  updateAllocation, 
  deleteAllocation,
  getWorkTypes
} = require('../controllers/work-allocation.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireRole, requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken);
router.use(injectTenantScope);

// Management & Admin views
router.get('/', getAllocations);
router.get('/stats', requireMinRole('campaign_manager'), getWorkStats);
router.get('/types', getWorkTypes);

// Personal task tracking (Workers, Ward Heads, Managers)
router.get('/my-tasks', getMyTasks);
router.patch('/:id/status', updateStatus);
router.post('/:id/upload-proof', uploadProof);

// Creation & Management
router.post('/', requireRole('super_admin', 'mla', 'campaign_manager'), createAllocation);
router.put('/:id', requireRole('super_admin', 'mla', 'campaign_manager'), updateAllocation);
router.delete('/:id', requireRole('super_admin', 'mla', 'campaign_manager'), deleteAllocation);

module.exports = router;
