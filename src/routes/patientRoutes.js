const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');
const { getPatientProfile, updatePatientProfile } = require('../controllers/patientController');

// Get patient profile
router.get('/profile', verifyToken, verifyRole(['patient']), getPatientProfile);

// Update patient profile with avatar upload
router.put('/profile', verifyToken, verifyRole(['patient']), upload.single('avatar'), updatePatientProfile);

module.exports = router;
