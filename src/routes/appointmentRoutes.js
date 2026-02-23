const express = require('express');
const router = express.Router();

// Import các hàm từ Controller (Gộp chung 1 dòng)
const { bookAppointment, searchByPhone, checkInAppointment } = require('../controllers/appointmentController');

// Import cái khiên bảo vệ
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Patient đặt lịch khám
router.post('/', verifyToken, verifyRole(['patient']), bookAppointment);

// Lễ tân tìm kiếm lịch khám hôm nay (GET /api/appointments/search?phone=...)
router.get('/search', verifyToken, verifyRole(['receptionist', 'admin']), searchByPhone);

// Lễ tân check-in (PUT /api/appointments/:id/checkin)
router.put('/:id/checkin', verifyToken, verifyRole(['receptionist', 'admin']), checkInAppointment);

module.exports = router;