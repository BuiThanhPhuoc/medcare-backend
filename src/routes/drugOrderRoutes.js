const express = require('express');
const router = express.Router();
const { 
    getMyOrders, 
    getOrderDetail, 
    createOrder, 
    cancelOrder, 
    confirmPayment,
    createVNPayPayment,
    getPaymentStatus,
    getAvailableMedicines 
} = require('../controllers/drugOrderController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Tất cả routes đều yêu cầu xác thực với role 'patient'
router.use(verifyToken, verifyRole(['patient']));

// Lấy danh sách thuốc có sẵn
router.get('/available-medicines', getAvailableMedicines);

// Lấy danh sách đơn hàng của bệnh nhân
router.get('/', getMyOrders);

// Tạo đơn hàng mới
router.post('/', createOrder);

// Lấy chi tiết đơn hàng
router.get('/:orderId', getOrderDetail);

// Kiểm tra trạng thái thanh toán
router.get('/:orderId/payment-status', getPaymentStatus);

// Hủy đơn hàng
router.put('/:orderId/cancel', cancelOrder);

// Xác nhận thanh toán (dùng cho COD)
router.put('/:orderId/confirm-payment', confirmPayment);

// Tạo thanh toán VNPay
router.post('/:orderId/create-vnpay-payment', createVNPayPayment);

module.exports = router;
