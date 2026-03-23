const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: "Vui lòng nhập tài khoản và mật khẩu!" });
        }

        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?',
            [identifier, identifier, identifier]
        );

        if (users.length === 0) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });

        const user = users[0];

        if (user.is_locked) return res.status(403).json({ message: "Tài khoản của bạn đã bị khóa!" });

        // *** KIỂM TRA STATUS CHO BÁC SĨ (support cả tiếng Việt và tiếng Anh) ***
        console.log(`[LOGIN CHECK] User: ${user.username}, Role: ${user.role}, Status: ${user.status}`);
        if (user.role === 'doctor') {
            const inactiveStatuses = ['inactive', 'Ngừng hoạt động', '0']; // Các giá trị không hoạt động
            if (inactiveStatuses.includes(user.status)) {
                console.log(`[LOGIN BLOCKED] Doctor ${user.username} has inactive status: ${user.status}`);
                return res.status(403).json({ 
                    message: "❌ Bác sĩ đã ngừng hoạt động. Vui lòng liên hệ quản trị viên!" 
                });
            }
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // TRẢ VỀ THÊM CỜ is_first_login CHO FRONTEND BIẾT
        res.status(200).json({
            message: "Đăng nhập thành công!",
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                is_first_login: user.is_first_login // <--- QUAN TRỌNG
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// HÀM MỚI: Ép đổi mật khẩu lần đầu
const forceChangePassword = async (req, res) => {
    try {
        // Lấy ID từ token (middleware verifyToken sẽ cung cấp req.user)
        const userId = req.user.id;
        const { newPassword, confirmPassword } = req.body;

        if (!newPassword || !confirmPassword) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin!" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Mật khẩu không khớp!" });
        }

        // ÉP REGEX BẢO MẬT
        if (!/^(?=.*[A-Z])(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(newPassword)) {
            return res.status(400).json({ message: "Mật khẩu ít nhất 8 ký tự, có 1 chữ hoa và 1 ký tự đặc biệt!" });
        }

        // Băm mật khẩu mới
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Cập nhật DB: Đổi pass và tắt cờ is_first_login
        await db.execute(
            'UPDATE users SET password = ?, is_first_login = FALSE WHERE id = ?',
            [hashedPassword, userId]
        );

        res.status(200).json({ message: "Đổi mật khẩu thành công! Bạn có thể sử dụng hệ thống." });

    } catch (error) {
        res.status(500).json({ message: "Lỗi server khi đổi mật khẩu!" });
    }
};

module.exports = { register, login, forceChangePassword };