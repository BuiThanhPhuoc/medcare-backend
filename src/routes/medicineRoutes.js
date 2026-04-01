const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const {
    getAllMedicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    importMedicinesFromExcel,
    downloadMedicineTemplate,
    getDrugsWithStock,
    createDrug,
    getDrugBatches,
    addDrugBatch,
    getExpiringBatches,
    downloadBatchTemplate,
    importDrugBatchesFromExcel,
    getPrescriptionByAppointment,
    getDispenseByAppointment,
    getInventoryLogs
} = require('../controllers/medicineController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Bác sĩ và Admin đều có thể xem danh sách thuốc
router.get('/', verifyToken, verifyRole(['admin', 'doctor']), getAllMedicines);

// Chỉ Admin mới có quyền Nhập thuốc và Sửa giá/Số lượng thuốc
router.post('/', verifyToken, verifyRole(['admin']), addMedicine);
router.put('/:id', verifyToken, verifyRole(['admin']), updateMedicine);
router.delete('/:id', verifyToken, verifyRole(['admin']), deleteMedicine);

// Admin: tải template import thuốc Excel
router.get('/template', verifyToken, verifyRole(['admin']), downloadMedicineTemplate);

// Admin: import thuốc từ file Excel
// mode: merge | replace | skip
router.post('/import', verifyToken, verifyRole(['admin']), upload.single('file'), importMedicinesFromExcel);

// ===== Stage 1: Drugs + Batches =====
router.get('/drugs', verifyToken, verifyRole(['admin', 'doctor']), getDrugsWithStock);
router.post('/drugs', verifyToken, verifyRole(['admin']), createDrug);
router.get('/drugs/:drugId/batches', verifyToken, verifyRole(['admin', 'doctor']), getDrugBatches);
router.post('/drugs/:drugId/batches', verifyToken, verifyRole(['admin']), addDrugBatch);
router.get('/warnings/expiring', verifyToken, verifyRole(['admin', 'doctor']), getExpiringBatches);
router.get('/batches/template', verifyToken, verifyRole(['admin']), downloadBatchTemplate);
router.post('/batches/import', verifyToken, verifyRole(['admin']), upload.single('file'), importDrugBatchesFromExcel);

// APIs đọc dữ liệu luồng kê đơn/cấp phát/tồn kho để test qua API
router.get('/prescriptions/by-appointment/:appointmentId', verifyToken, verifyRole(['admin', 'doctor', 'receptionist']), getPrescriptionByAppointment);
router.get('/dispense/by-appointment/:appointmentId', verifyToken, verifyRole(['admin', 'doctor', 'receptionist']), getDispenseByAppointment);
router.get('/inventory/logs', verifyToken, verifyRole(['admin', 'doctor', 'receptionist']), getInventoryLogs);

module.exports = router;