const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');
const {
  getBoothStrength,
  getWardSurveyCount,
  getTopIssues,
  getWorkerPerformance,
  getDailyTrends,
  getAnalyticsOverview,
} = require('../controllers/analytics.controller');

// All analytics require auth + tenant scope + minimum campaign_manager level
router.use(authenticateToken, injectTenantScope);

router.get('/booth-strength', requireMinRole('campaign_manager'), getBoothStrength);
router.get('/ward-survey-count', requireMinRole('campaign_manager'), getWardSurveyCount);
router.get('/top-issues', requireMinRole('ward_head'), getTopIssues);
router.get('/worker-performance', requireMinRole('campaign_manager'), getWorkerPerformance);
router.get('/daily-trends', requireMinRole('ward_head'), getDailyTrends);
router.get('/overview', requireMinRole('ward_head'), getAnalyticsOverview);

module.exports = router;
