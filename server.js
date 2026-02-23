const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./src/routes/authRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
require('./src/services/cronService');
const medicalRecordRoutes = require('./src/routes/medicalRecordRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Gắn route
app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/medical-records', medicalRecordRoutes);
app.use('/api/payments', paymentRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});