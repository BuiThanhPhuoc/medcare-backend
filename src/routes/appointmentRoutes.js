const express = require('express');
const router = express.Router();

// Đã bổ sung 2 hàm thu tiền (getUnpaidAppointments, processPayment) vào danh sách import
const { 
    bookAppointment, 
    searchByPhone, 
    checkInAppointment, 
    getDoctors,
    getDoctorAppointments,
    getUnpaidAppointments, 
    processPayment 
} = require('../controllers/appointmentController');

const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// 1. Lấy danh sách bác sĩ
router.get('/doctors', verifyToken, getDoctors);

// 2. Bác sĩ xem lịch khám của mình
router.get('/doctor-schedule', verifyToken, verifyRole(['doctor']), getDoctorAppointments);

// 3. Patient đặt lịch khám
router.post('/', verifyToken, verifyRole(['patient']), bookAppointment);

// 4. Lễ tân tìm kiếm lịch khám
router.get('/search', verifyToken, verifyRole(['receptionist', 'admin']), searchByPhone);
    
// 5. Lễ tân check-in 
router.put('/:id/checkin', verifyToken, verifyRole(['receptionist', 'admin']), checkInAppointment);

// 6. Route lấy danh sách chờ thu tiền
router.get('/unpaid', verifyToken, verifyRole(['receptionist', 'admin']), getUnpaidAppointments);

// 7. Route xử lý thanh toán
router.put('/:id/pay', verifyToken, verifyRole(['receptionist', 'admin']), processPayment);

module.exports = router;