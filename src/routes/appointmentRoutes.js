const express = require('express');
const router = express.Router();

const { 
    bookAppointment, 
    searchByPhone, 
    checkInAppointment, 
    getDoctors,
    getDoctorAppointments,
    getDoctorAppointmentDetail,
    getUnpaidAppointments, 
    getBookedSlots,
    getTodayAppointments,
    getSpecialties,
    getBillingAppointmentDetail,
    getPatientAppointments,
    cancelPatientAppointment
} = require('../controllers/appointmentController');

const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// 0.5. Lấy danh sách chuyên khoa
router.get('/specialties', verifyToken, getSpecialties);

// 1. Lấy danh sách bác sĩ
router.get('/doctors', verifyToken, getDoctors);

// 2. Bác sĩ xem lịch khám của mình
router.get('/doctor-schedule', verifyToken, verifyRole(['doctor']), getDoctorAppointments);

// 2.1 Chi tiết 1 lịch (cho trang viết bệnh án)
router.get('/doctor-appointment/:id', verifyToken, verifyRole(['doctor']), getDoctorAppointmentDetail);

// 2.5. Lấy danh sách slots đã đặt (để disable trên Frontend)
router.get('/booked-slots', verifyToken, verifyRole(['patient']), getBookedSlots);

// 2.7. Lễ tân lấy danh sách bệnh nhân hôm nay
router.get('/today', verifyToken, verifyRole(['receptionist', 'admin']), getTodayAppointments);

// 3. Patient xem tất cả lịch khám của mình
router.get('/my-appointments', verifyToken, verifyRole(['patient']), getPatientAppointments);

// 3. Patient đặt lịch khám
router.post('/', verifyToken, verifyRole(['patient']), bookAppointment);

// 4. Lễ tân tìm kiếm lịch khám
router.get('/search', verifyToken, verifyRole(['receptionist', 'admin']), searchByPhone);
    
// 5. Lễ tân check-in 
router.put('/:id/check-in', verifyToken, verifyRole(['receptionist', 'admin']), checkInAppointment);

// 5.1 Patient hủy lịch khám (trước 1 ngày)
router.put('/:appointmentId/cancel', verifyToken, verifyRole(['patient']), cancelPatientAppointment);

// 6. Route lấy danh sách chờ thu tiền
router.get('/unpaid', verifyToken, verifyRole(['receptionist', 'admin']), getUnpaidAppointments);

// API: Route lấy chi tiết hóa đơn tại quầy thu ngân
router.get('/billing/:id', verifyToken, verifyRole(['receptionist', 'admin']), getBillingAppointmentDetail);

module.exports = router;