/**
 * Export Routes
 * Router cho các endpoint export dữ liệu
 */

const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Export Bác sĩ
router.get('/doctors/excel', verifyToken, verifyRole(['admin']), exportController.exportDoctorsExcel);
router.get('/doctors/pdf', verifyToken, verifyRole(['admin']), exportController.exportDoctorsPDF);

// Export Bệnh nhân
router.get('/patients/excel', verifyToken, verifyRole(['admin']), exportController.exportPatientsExcel);
router.get('/patients/pdf', verifyToken, verifyRole(['admin']), exportController.exportPatientsPDF);

// Export Lịch khám
router.get('/appointments/excel', verifyToken, verifyRole(['admin']), exportController.exportAppointmentsExcel);

// Export Thuốc
router.get('/medicines/excel', verifyToken, verifyRole(['admin']), exportController.exportMedicinesExcel);

// Export Doanh thu
router.get('/revenue/excel', verifyToken, verifyRole(['admin']), exportController.exportRevenueExcel);

module.exports = router;
