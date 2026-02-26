const express = require('express');
const router = express.Router();

// Đã thêm getAllUsers và toggleLockUser vào đây
const { getRevenueStatistics, getAllUsers, toggleLockUser } = require('../controllers/adminController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

router.get('/revenue', verifyToken, verifyRole(['admin']), getRevenueStatistics);
router.get('/users', verifyToken, verifyRole(['admin']), getAllUsers);
router.put('/users/:id/lock', verifyToken, verifyRole(['admin']), toggleLockUser);

module.exports = router;