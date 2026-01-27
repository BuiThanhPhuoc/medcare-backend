const db = require('../configs/db');

const User = {
    // Tìm user theo email để kiểm tra trùng lặp
    findByEmail: async (email) => {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    },
    // Lưu user mới vào database
    create: async (userData) => {
        const { full_name, email, password, role } = userData;
        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)',
            [full_name, email, password, role || 'patient']
        );
        return result.insertId;
    }
};

module.exports = User;