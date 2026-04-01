const mysql = require('mysql2/promise');
require('dotenv').config();

const connectTimeout = process.env.DB_CONNECT_TIMEOUT
    ? Number(process.env.DB_CONNECT_TIMEOUT)
    : 60000;

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS, // Mặc định XAMPP là rỗng
    database: process.env.DB_NAME,
    connectTimeout,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test kết nối ngay khi chạy
pool.getConnection()
    .then(() => console.log('✅ Đã kết nối thành công với MySQL XAMPP!'))
    .catch((err) => console.error('❌ Lỗi kết nối DB:', err));

module.exports = pool;