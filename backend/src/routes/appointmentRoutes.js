const express = require('express');
const router = express.Router();

const { 
    bookAppointment, 
    searchByPhone, 
    checkInAppointment, 
    getDoctors,
    getDoctorAppointments,
    getUnpaidAppointments, 
<<<<<<< HEAD
=======
    processPayment,
>>>>>>> 6c7f697c9d77efeae9874b188addb03cfb6d5a99
    getBookedSlots
} = require('../controllers/appointmentController');

const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// 1. Lấy danh sách bác sĩ
router.get('/doctors', verifyToken, getDoctors);

// 2. Bác sĩ xem lịch khám của mình
router.get('/doctor-schedule', verifyToken, verifyRole(['doctor']), getDoctorAppointments);

// 2.5. Lấy danh sách slots đã đặt (để disable trên Frontend)
router.get('/booked-slots', verifyToken, verifyRole(['patient']), getBookedSlots);

// 3. Patient đặt lịch khám
router.post('/', verifyToken, verifyRole(['patient']), bookAppointment);

// 4. Lễ tân tìm kiếm lịch khám
router.get('/search', verifyToken, verifyRole(['receptionist', 'admin']), searchByPhone);
    
// 5. Lễ tân check-in 
router.put('/:id/checkin', verifyToken, verifyRole(['receptionist', 'admin']), checkInAppointment);

// 6. Route lấy danh sách chờ thu tiền
router.get('/unpaid', verifyToken, verifyRole(['receptionist', 'admin']), getUnpaidAppointments);

module.exports = router;