const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const scheduleController = require('../controllers/scheduleController');

// 🛡️ BẢO VỆ ROUTE (Chỉ có tài khoản mang role 'doctor' mới được vào)
router.use(verifyToken, verifyRole(['doctor']));

// ========================================================
// 📅 LỊCH LÀM VIỆC CỦA BÁC SĨ
// ========================================================
// Nhận API đăng ký lịch từ Frontend
router.post('/schedules/register', scheduleController.registerSchedule);
router.get('/schedules/my-schedules/:userId', scheduleController.getMyApprovedSchedules);

module.exports = router;