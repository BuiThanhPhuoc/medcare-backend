const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { register, login, forceChangePassword, changePassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/force-change-password', verifyToken, forceChangePassword);
router.post('/change-password', verifyToken, changePassword);

module.exports = router;