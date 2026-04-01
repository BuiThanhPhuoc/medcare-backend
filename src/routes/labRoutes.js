const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');
const labTech = require('../controllers/labTechnicianController');
const labFlow = require('../controllers/labWorkflowController');

router.get('/queue', verifyToken, verifyRole(['lab_technician', 'admin']), labTech.getLabQueue);
router.get('/orders/:id', verifyToken, verifyRole(['lab_technician', 'admin']), labTech.getLabOrderDetail);
router.put('/orders/:id/result', verifyToken, verifyRole(['lab_technician', 'admin']), labTech.submitLabResult);

router.post('/pay/:appointmentId', verifyToken, verifyRole(['receptionist', 'admin']), labFlow.payLabTestsForAppointment);
router.get('/payment-summary/:appointmentId', verifyToken, verifyRole(['receptionist', 'admin']), labFlow.getLabPaymentSummary);
router.get('/payment-by-phone', verifyToken, verifyRole(['receptionist', 'admin']), labFlow.getLabPaymentByPhone);
router.post('/doctor-decision/:appointmentId', verifyToken, verifyRole(['doctor']), labFlow.doctorLabDecision);
router.get('/awaiting-doctor', verifyToken, verifyRole(['doctor']), labFlow.getAppointmentsAwaitingDoctorLab);

module.exports = router;
