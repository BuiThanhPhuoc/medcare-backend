const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const receptionScheduleCtrl = require('../controllers/receptionScheduleController');
const receptionController = require('../controllers/receptionController');

// ========================================================
// 📅 RECEPTION DASHBOARD ROUTES
// ========================================================

/**
 * GET /api/reception/stats
 * Lấy thống kê của nhân viên lễ tân
 */
router.get('/stats', verifyToken, verifyRole(['receptionist']), receptionController.getStats);

/**
 * GET /api/reception/personal-info
 * Lấy thông tin cá nhân của nhân viên lễ tân
 */
router.get('/personal-info', verifyToken, verifyRole(['receptionist']), receptionController.getPersonalInfo);

/**
 * GET /api/reception/shifts/today
 * Lấy ca làm việc hôm nay
 */
router.get('/shifts/today', verifyToken, verifyRole(['receptionist']), receptionController.getTodayShifts);

/**
 * GET /api/reception/schedule/weekly
 * Lấy lịch làm việc tuần này
 */
router.get('/schedule/weekly', verifyToken, verifyRole(['receptionist']), receptionController.getWeeklySchedule);

/**
 * GET /api/reception/my-schedule
 * Lệ tân xem lịch làm việc của chính mình
 * Protected: Chỉ receptionist mới vào được
 */
router.get('/my-schedule', verifyToken, verifyRole(['receptionist']), receptionScheduleCtrl.getMySchedule);

module.exports = router;
