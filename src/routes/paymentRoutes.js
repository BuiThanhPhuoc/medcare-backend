const express = require('express');
const router = express.Router();
const { 
    processPayment, 
    createVNPaymentRequest,
    createVNPaymentRequestForDrugOrder,
    handleVNPaymentReturn, 
    handleVNPaymentIPN 
} = require('../controllers/paymentController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// === VNPay Routes (MUST BE FIRST) ===
// Tạo yêu cầu thanh toán VNPay cho lịch khám
router.post('/vnpay/create', verifyToken, createVNPaymentRequest);

// Tạo yêu cầu thanh toán VNPay cho đơn hàng thuốc
router.post('/vnpay/drug-order/create', verifyToken, verifyRole(['patient']), createVNPaymentRequestForDrugOrder);

// Xử lý kết quả thanh toán VNPay (Return URL)
router.get('/vnpay/return', handleVNPaymentReturn);

// Xử lý IPN callback từ VNPay
router.post('/vnpay/ipn', handleVNPaymentIPN);

// Thanh toán tiền mặt - Chỉ Lễ tân (hoặc Admin) mới có quyền
router.post('/:appointment_id', verifyToken, verifyRole(['receptionist', 'admin']), processPayment);

module.exports = router;