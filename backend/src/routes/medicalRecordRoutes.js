const express = require('express');
const router = express.Router();

const { examinePatient, getPatientHistory, getMyMedicalRecords } = require('../controllers/medicalRecordController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Bác sĩ lưu hồ sơ bệnh án
router.post('/', verifyToken, verifyRole(['doctor']), examinePatient);

// Bệnh nhân xem lịch sử khám của chính mình
router.get('/history', verifyToken, verifyRole(['patient']), getPatientHistory); 

router.get('/my-records', verifyToken, verifyRole(['patient']), getMyMedicalRecords);

module.exports = router;