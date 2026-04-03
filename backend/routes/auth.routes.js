const express = require('express');
const router = express.Router();
const { login, getProfile, changePassword } = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

router.post('/login', login);
router.get('/profile', authenticateToken, getProfile);
router.put('/change-password', authenticateToken, changePassword);

module.exports = router;
