const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS, // Mặc định XAMPP là rỗng
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test kết nối ngay khi chạy
pool.getConnection()
    .then(() => console.log('✅ Đã kết nối thành công với MySQL XAMPP!'))
    .catch((err) => console.error('❌ Lỗi kết nối DB:', err));

module.exports = pool;