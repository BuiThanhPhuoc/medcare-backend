const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const { register, login, forceChangePassword } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);

// 🔥 ROUTE NÀY CHÍNH LÀ CHÌA KHÓA ĐỂ SỬA LỖI 404
router.post('/force-change-password', verifyToken, forceChangePassword);

module.exports = router;