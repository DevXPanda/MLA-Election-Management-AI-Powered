const express = require('express');
const router = express.Router();
const { getUsers, getUser, createUser, updateUser, deleteUser, getRoles } = require('../controllers/users.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

// 🔐 Authentication & Tenant Isolation
router.use(authenticateToken, injectTenantScope);

// 🛡️ ROLE PROTECTIONS
// Only Managers and above can view or manage users
router.use(requireMinRole('ward_head'));

router.get('/roles', getRoles);
router.get('/', getUsers);
router.get('/:id', getUser);
router.post('/', requireMinRole('campaign_manager'), createUser);
router.put('/:id', requireMinRole('campaign_manager'), updateUser);
router.delete('/:id', requireMinRole('mla'), deleteUser);

module.exports = router;
