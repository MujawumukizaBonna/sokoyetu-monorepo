const express = require('express');
const router = express.Router();
const { register, login, getMe, updateMe, changePassword, logoutAll } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { loginLimiter, registerLimiter, passwordLimiter, logoutAllLimiter } = require('../middleware/rateLimit');

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, updateMe);
// authMiddleware must run before passwordLimiter so the limiter can key on req.user.
router.put('/password', authMiddleware, passwordLimiter, changePassword);
router.post('/logout-all', authMiddleware, logoutAllLimiter, logoutAll);

module.exports = router;
