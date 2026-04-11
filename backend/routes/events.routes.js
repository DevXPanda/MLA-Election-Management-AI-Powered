const express = require('express');
const router = express.Router();
const { getEvents, createEvent, updateEvent, deleteEvent, addParticipants, getParticipants, markAttendance, getEventExecutionLog } = require('../controllers/events.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/', getEvents);
router.post('/', requireMinRole('campaign_manager'), createEvent);
router.put('/:id', requireMinRole('campaign_manager'), updateEvent);
router.delete('/:id', requireMinRole('mla'), deleteEvent);
router.get('/:id/execution-log', getEventExecutionLog);
router.get('/:id/participants', getParticipants);
router.post('/:id/participants', requireMinRole('campaign_manager'), addParticipants);
router.post('/:id/attendance', requireMinRole('ward_head'), markAttendance);

module.exports = router;
