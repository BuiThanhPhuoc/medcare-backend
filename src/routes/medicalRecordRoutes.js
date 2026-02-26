const express = require('express');
const router = express.Router();

// Chỉ giữ lại 1 dòng import gộp này thôi
const { examinePatient, getPatientHistory } = require('../controllers/medicalRecordController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Bác sĩ lưu hồ sơ bệnh án
router.post('/', verifyToken, verifyRole(['doctor']), examinePatient);

// Bệnh nhân xem lịch sử khám của chính mình
router.get('/history', verifyToken, verifyRole(['patient']), getPatientHistory); 

module.exports = router;