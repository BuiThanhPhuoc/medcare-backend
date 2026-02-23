const db = require('../config/db');
const bcrypt = require('bcrypt');

const register = async (req, res) => {
    try {
        const { username, phone, email, password, confirmPassword } = req.body;

        // 1. Validation cơ bản
        if (!username || !phone || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Mật khẩu nhập lại không khớp!" });
        }

        // 2. Validation Regex
        if (!/^[a-zA-Z0-9]{4,16}$/.test(username)) {
            return res.status(400).json({ message: "Username 4-16 ký tự, chỉ gồm chữ và số!" });
        }
        if (!/^(0[3|5|7|8|9])[0-9]{8}$/.test(phone)) {
            return res.status(400).json({ message: "Số điện thoại không hợp lệ!" });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ message: "Email sai định dạng!" });
        }
        if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(password)) {
            return res.status(400).json({ message: "Mật khẩu ít nhất 8 ký tự, có 1 chữ hoa và 1 ký tự đặc biệt!" });
        }

        // 3. Kiểm tra trùng lặp trong DB
        const [existingUsers] = await db.execute(
            'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?',
            [username, email, phone]
        );
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: "Tài khoản, email hoặc số điện thoại đã tồn tại!" });
        }

        // 4. Mã hóa mật khẩu và lưu vào DB
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.execute(
            'INSERT INTO users (username, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [username, phone, email, hashedPassword, 'patient']
        );

        res.status(201).json({ message: "Đăng ký thành công!", userId: result.insertId });

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { register };