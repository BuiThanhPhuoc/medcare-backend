const express = require('express');
const router = express.Router();
const { getAllMedicines, addMedicine, updateMedicine, deleteMedicine } = require('../controllers/medicineController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Bác sĩ và Admin đều có thể xem danh sách thuốc
router.get('/', verifyToken, verifyRole(['admin', 'doctor']), getAllMedicines);

// Chỉ Admin mới có quyền Nhập thuốc và Sửa giá/Số lượng thuốc
router.post('/', verifyToken, verifyRole(['admin']), addMedicine);
router.put('/:id', verifyToken, verifyRole(['admin']), updateMedicine);
router.delete('/:id', verifyToken, verifyRole(['admin']), deleteMedicine);

module.exports = router;