const express = require('express');
const router = express.Router();
const { getRevenueStatistics } = require('../controllers/adminController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Chỉ có Role 'admin' mới được xem doanh thu
router.get('/revenue', verifyToken, verifyRole(['admin']), getRevenueStatistics);

module.exports = router;