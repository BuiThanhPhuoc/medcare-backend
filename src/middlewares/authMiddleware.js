const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // 1. Lấy token từ header "Authorization"
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Không tìm thấy token, quyền truy cập bị từ chối!' });
    }

    try {
        // 2. Xác thực token bằng Secret Key đã cấu hình trong .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Lưu thông tin người dùng vào request
        next(); // Cho phép đi tiếp vào Controller
    } catch (err) {
        res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};