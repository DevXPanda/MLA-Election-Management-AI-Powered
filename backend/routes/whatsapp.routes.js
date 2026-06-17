const express = require('express');
const router = express.Router();
const {
  getTemplates,
  createTemplate,
  deleteTemplate,
  getRecipients,
  sendWhatsAppMessages,
  getCampaigns,
  getCampaignMessages,
  getCampaignAnalytics,
  getWhatsAppSettings,
  saveWhatsAppSettings,
  verifyWebhook,
  receiveWebhook
} = require('../controllers/whatsapp.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireRole } = require('../middleware/rbac');

// Webhook endpoints (Public - accessed by Meta)
router.get('/webhook', verifyWebhook);
router.post('/webhook', receiveWebhook);

// All other WhatsApp campaign functions require authentication
router.use(authenticateToken, injectTenantScope);

router.get('/settings', requireRole('super_admin'), getWhatsAppSettings);
router.post('/settings', requireRole('super_admin'), saveWhatsAppSettings);

router.get('/templates', requireRole('super_admin', 'mla'), getTemplates);
router.post('/templates', requireRole('super_admin', 'mla'), createTemplate);
router.delete('/templates/:id', requireRole('super_admin', 'mla'), deleteTemplate);
router.get('/recipients', requireRole('super_admin', 'mla'), getRecipients);
router.post('/send', requireRole('super_admin', 'mla'), sendWhatsAppMessages);
router.get('/campaigns', requireRole('super_admin', 'mla'), getCampaigns);
router.get('/campaigns/:id/messages', requireRole('super_admin', 'mla'), getCampaignMessages);
router.get('/analytics', requireRole('super_admin', 'mla'), getCampaignAnalytics);

module.exports = router;
