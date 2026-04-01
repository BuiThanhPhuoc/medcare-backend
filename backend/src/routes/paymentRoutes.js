const express = require('express');
const router = express.Router();
const { processPayment } = require('../controllers/paymentController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Chỉ Lễ tân (hoặc Admin) mới có quyền thu tiền
router.post('/:appointment_id', verifyToken, verifyRole(['receptionist', 'admin']), processPayment);

module.exports = router;