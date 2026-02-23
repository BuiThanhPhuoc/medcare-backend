const express = require('express');
const router = express.Router();
const { examinePatient } = require('../controllers/medicalRecordController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// Route này bắt buộc người gọi phải đăng nhập và có role là "doctor"
router.post('/', verifyToken, verifyRole(['doctor']), examinePatient);

module.exports = router;