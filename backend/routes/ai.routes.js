/**
 * AI CHAT ROUTES v2
 * ─────────────────────────────────────────────────────────────────────
 * POST   /api/ai/chat              — Send message & get AI response
 * GET    /api/ai/sessions          — List user's chat sessions
 * GET    /api/ai/sessions/:id/messages — Get session messages
 * PUT    /api/ai/sessions/:id      — Rename session
 * DELETE /api/ai/sessions/:id      — Delete session
 *
 * Access: super_admin, mla only
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const aiController = require('../controllers/ai.controller');

const guard = [authenticateToken, requireRole('super_admin', 'mla')];

router.post('/chat', ...guard, aiController.chat);
router.get('/sessions', ...guard, aiController.getSessions);
router.get('/sessions/:id/messages', ...guard, aiController.getSessionMessages);
router.put('/sessions/:id', ...guard, aiController.updateSession);
router.delete('/sessions/:id', ...guard, aiController.deleteSession);

module.exports = router;
