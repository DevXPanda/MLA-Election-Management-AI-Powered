const express = require('express');
const router = express.Router();
const { getSurveys, createSurvey, deleteSurvey, getSurveyStats, getSurveyIssues, createSurveyIssue } = require('../controllers/surveys.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/stats', getSurveyStats);
router.get('/issues', getSurveyIssues);
router.post('/issues', requireMinRole('campaign_manager'), createSurveyIssue);
router.get('/', getSurveys);
router.post('/', createSurvey);
router.delete('/:id', requireMinRole('campaign_manager'), deleteSurvey);

module.exports = router;
