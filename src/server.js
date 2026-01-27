const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const pool = require('./configs/db');

// Nạp biến môi trường
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Kiểm tra kết nối Database ngay khi khởi động
const checkConnection = async () => {
    try {
        await pool.query('SELECT 1');
        console.log('✅ MySQL Connected (XAMPP)');
    } catch (err) {
        console.error('❌ Database connection failed:', err.message);
    }
};

checkConnection();

// Route kiểm tra server
app.get('/', (req, res) => {
    res.json({ message: "Chào mừng đến với API phòng khám MedCare!" });
});

app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});