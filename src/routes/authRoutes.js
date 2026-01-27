const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);

// Chỉ những người có Token hợp lệ mới xem được thông tin này
router.get('/profile', authMiddleware, (req, res) => {
    res.json({
        message: "Truy cập vùng dữ liệu an toàn thành công!",
        user: req.user
    });
});

module.exports = router;