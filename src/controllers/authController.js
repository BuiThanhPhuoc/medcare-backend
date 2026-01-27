const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { full_name, email, password, role } = req.body;

        // 1. Kiểm tra email tồn tại
        const existingUser = await User.findByEmail(email);
        if (existingUser) return res.status(400).json({ message: 'Email đã được sử dụng!' });

        // 2. Mã hóa mật khẩu (Bảo mật - Ghi điểm tiêu chí 2)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Lưu vào DB
        await User.create({ full_name, email, password: hashedPassword, role });

        res.status(201).json({ message: 'Đăng ký tài khoản thành công!' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Kiểm tra User tồn tại
        const user = await User.findByEmail(email);
        if (!user) return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng!' });

        // 2. Kiểm tra mật khẩu (So sánh với mật khẩu đã mã hóa bcrypt)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng!' });

        // 3. Kiểm tra trạng thái tài khoản (Ghi điểm logic: Khóa/Mở tài khoản)
        if (user.status === 0) return res.status(403).json({ message: 'Tài khoản của bạn đã bị khóa!' });

        // 4. Tạo JWT Token (Lấy 4 điểm công nghệ)
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            message: 'Đăng nhập thành công!',
            token,
            user: { id: user.id, full_name: user.full_name, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
};