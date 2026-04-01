const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const receptionScheduleCtrl = require('../controllers/receptionScheduleController');

// ========================================================
// 📅 RECEPTION SCHEDULE ROUTES
// ========================================================

/**
 * GET /api/reception/my-schedule
 * Lệ tân xem lịch làm việc của chính mình
 * Protected: Chỉ receptionist mới vào được
 */
router.get('/my-schedule', verifyToken, verifyRole(['receptionist']), receptionScheduleCtrl.getMySchedule);

module.exports = router;
