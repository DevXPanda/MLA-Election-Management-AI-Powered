const express = require('express');
const router = express.Router();
const { getMedia, createMedia, trackDownload, deleteMedia } = require('../controllers/media.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/', getMedia);
router.post('/', requireMinRole('campaign_manager'), createMedia);
router.post('/:id/download', trackDownload);
router.delete('/:id', requireMinRole('campaign_manager'), deleteMedia);

module.exports = router;
