const express = require('express');
const router = express.Router();
const {
  getMeetings, getMeetingStats, getMeetingById, createMeeting,
  updateMeeting, deleteMeeting, addParticipants, removeParticipant, sendInvites
} = require('../controllers/meetings.controller');
const { authenticateToken } = require('../middleware/auth');
const { injectTenantScope } = require('../middleware/tenant');
const { requireMinRole } = require('../middleware/rbac');

router.use(authenticateToken, injectTenantScope);

router.get('/', getMeetings);
router.get('/stats', getMeetingStats);
router.get('/:id', getMeetingById);
router.post('/', requireMinRole('mla'), createMeeting);
router.put('/:id', requireMinRole('mla'), updateMeeting);
router.delete('/:id', requireMinRole('mla'), deleteMeeting);
router.post('/:id/participants', requireMinRole('mla'), addParticipants);
router.delete('/:id/participants/:userId', requireMinRole('mla'), removeParticipant);
router.post('/:id/send-invites', requireMinRole('mla'), sendInvites);

module.exports = router;
