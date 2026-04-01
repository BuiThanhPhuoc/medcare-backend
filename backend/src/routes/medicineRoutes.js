const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const upload = require('../middlewares/uploadMiddleware');
const {
    getAllMedicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    importMedicinesFromExcel,
    downloadMedicineTemplate
} = require('../controllers/medicineController');
=======
const { getAllMedicines, addMedicine, updateMedicine, deleteMedicine } = require('../controllers/medicineController');
>>>>>>> 6c7f697c9d77efeae9874b188addb03cfb6d5a99
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Bác sĩ và Admin đều có thể xem danh sách thuốc
router.get('/', verifyToken, verifyRole(['admin', 'doctor']), getAllMedicines);

// Chỉ Admin mới có quyền Nhập thuốc và Sửa giá/Số lượng thuốc
router.post('/', verifyToken, verifyRole(['admin']), addMedicine);
router.put('/:id', verifyToken, verifyRole(['admin']), updateMedicine);
router.delete('/:id', verifyToken, verifyRole(['admin']), deleteMedicine);
<<<<<<< HEAD

// Admin: tải template import thuốc Excel
router.get('/template', verifyToken, verifyRole(['admin']), downloadMedicineTemplate);

// Admin: import thuốc từ file Excel
// mode: merge | replace | skip
router.post('/import', verifyToken, verifyRole(['admin']), upload.single('file'), importMedicinesFromExcel);
=======
>>>>>>> 6c7f697c9d77efeae9874b188addb03cfb6d5a99

module.exports = router;