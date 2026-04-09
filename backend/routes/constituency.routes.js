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
router.put('/states/:id', requireMinRole('super_admin'), ctrl.updateState);
router.delete('/states/:id', requireMinRole('super_admin'), ctrl.deleteState);

router.get('/districts', requireMinRole('mla'), ctrl.getDistricts);
router.post('/districts', requireMinRole('super_admin'), ctrl.createDistrict);
router.put('/districts/:id', requireMinRole('super_admin'), ctrl.updateDistrict);
router.delete('/districts/:id', requireMinRole('super_admin'), ctrl.deleteDistrict);

// 🏰 Constituencies
router.get('/constituencies', requireMinRole('mla'), ctrl.getConstituencies);
router.post('/constituencies', requireMinRole('super_admin'), ctrl.createConstituency);
router.put('/constituencies/:id', requireMinRole('super_admin'), ctrl.updateConstituency);
router.delete('/constituencies/:id', requireMinRole('super_admin'), ctrl.deleteConstituency);

// 🗺️ Areas
router.get('/areas', requireMinRole('ward_head'), ctrl.getAreas);
router.post('/areas', requireMinRole('mla'), ctrl.createArea);
router.put('/areas/:id', requireMinRole('mla'), ctrl.updateArea);
router.delete('/areas/:id', requireMinRole('mla'), ctrl.deleteArea);

// 🏙️ Wards - Managers and higher
router.get('/wards', requireMinRole('ward_head'), ctrl.getWards);
router.post('/wards', requireMinRole('mla'), ctrl.createWard);
router.put('/wards/:id', requireMinRole('mla'), ctrl.updateWard);
router.delete('/wards/:id', requireMinRole('mla'), ctrl.deleteWard);

// ⛺ Booths - Ward Heads and higher
router.get('/booths', requireMinRole('booth_worker'), ctrl.getBooths); 
router.post('/booths', requireMinRole('mla'), ctrl.createBooth);
router.put('/booths/:id', requireMinRole('mla'), ctrl.updateBooth);
router.delete('/booths/:id', requireMinRole('mla'), ctrl.deleteBooth);

module.exports = router;
