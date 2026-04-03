const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/constituency.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

// 🔒 All routes require authenticated user and tenant scope injection
router.use(authenticateToken, injectTenantScope);

// 🛡️ Hierarchy - Strategic only
router.get('/hierarchy', requireMinRole('ward_head'), ctrl.getHierarchy);

// States & Districts - Global infrastructure (SuperAdmin or MLAs only)
router.get('/states', requireMinRole('mla'), ctrl.getStates);
router.post('/states', requireMinRole('super_admin'), ctrl.createState);

router.get('/districts', requireMinRole('mla'), ctrl.getDistricts);
router.post('/districts', requireMinRole('super_admin'), ctrl.createDistrict);

// 🏰 Constituencies
router.get('/constituencies', requireMinRole('mla'), ctrl.getConstituencies);
router.post('/constituencies', requireMinRole('super_admin'), ctrl.createConstituency);
router.put('/constituencies/:id', requireMinRole('super_admin'), ctrl.updateConstituency);
router.delete('/constituencies/:id', requireMinRole('super_admin'), ctrl.deleteConstituency);

// 🏙️ Wards - Managers and higher
router.get('/wards', requireMinRole('ward_head'), ctrl.getWards);
router.post('/wards', requireMinRole('campaign_manager'), ctrl.createWard);
router.put('/wards/:id', requireMinRole('campaign_manager'), ctrl.updateWard);
router.delete('/wards/:id', requireMinRole('campaign_manager'), ctrl.deleteWard);

// ⛺ Booths - Ward Heads and higher
router.get('/booths', requireMinRole('booth_worker'), ctrl.getBooths); // Workers see booths for assignment
router.post('/booths', requireMinRole('campaign_manager'), ctrl.createBooth);
router.put('/booths/:id', requireMinRole('ward_head'), ctrl.updateBooth);
router.delete('/booths/:id', requireMinRole('campaign_manager'), ctrl.deleteBooth);

module.exports = router;
