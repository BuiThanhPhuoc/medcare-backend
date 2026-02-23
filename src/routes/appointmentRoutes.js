const express = require('express');
const router = express.Router();
const { bookAppointment } = require('../controllers/appointmentController');

// Import cái khiên bảo vệ mà chúng ta vừa tạo
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Route POST /api/appointments
// Kẹp 2 cái middleware vào trước khi cho phép chạy hàm bookAppointment
router.post('/', verifyToken, verifyRole(['patient']), bookAppointment);

module.exports = router;