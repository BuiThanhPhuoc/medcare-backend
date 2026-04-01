const express = require('express');
const cors = require('cors');
require('dotenv').config();

// === IMPORT ROUTES ===
const authRoutes = require('./src/routes/authRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
require('./src/services/cronService'); // Chạy CronJob
const medicalRecordRoutes = require('./src/routes/medicalRecordRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const medicineRoutes = require('./src/routes/medicineRoutes');
const drugOrderRoutes = require('./src/routes/drugOrderRoutes');
const adminRoutes = require('./src/routes/adminRoutes'); // Khai báo duy nhất 1 lần ✅
const doctorRoutes = require('./src/routes/doctorRoutes'); 
const receptionRoutes = require('./src/routes/receptionRoutes');
const patientRoutes = require('./src/routes/patientRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const exportRoutes = require('./src/routes/exportRoutes');
const labRoutes = require('./src/routes/labRoutes');

const app = express();

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());

// Gắn thư mục uploads để Frontend có thể lấy được ảnh (Ví dụ: avatar, thumbnail)
app.use('/uploads', express.static('uploads'));

// === GẮN ROUTES ===
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/drug-orders', drugOrderRoutes);
app.use('/api/admin', adminRoutes); // Gắn duy nhất 1 lần ✅
app.use('/api/doctor', doctorRoutes); 
app.use('/api/reception', receptionRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/lab', labRoutes);

// === KHỞI ĐỘNG SERVER ===
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});