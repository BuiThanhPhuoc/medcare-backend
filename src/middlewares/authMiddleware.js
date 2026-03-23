const jwt = require('jsonwebtoken');

// 1. Middleware kiểm tra xem user có mang theo Token hợp lệ không
const verifyToken = (req, res, next) => {
    // Lấy token từ header của request
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Vui lòng đăng nhập để thực hiện chức năng này!" });
    }

    // Tách lấy phần mã token (bỏ chữ 'Bearer ' ở đầu)
    const token = authHeader.split(' ')[1];

    try {
        // Giải mã token bằng chìa khóa bí mật trong .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Gắn thông tin giải mã được (id, role) vào req để các hàm phía sau dùng
        req.user = decoded; 
        
        // Cho phép đi tiếp vào Controller
        next(); 
    } catch (error) {
        // In lỗi chi tiết ra Terminal và trả về cho Postman/Thunder Client
        console.log("Lỗi JWT cụ thể:", error.message);
        // Token không hợp lệ/expired => coi như chưa xác thực
        return res.status(401).json({ 
            message: "Token không hợp lệ hoặc đã hết hạn!", 
            chi_tiet_loi: error.message 
        });
    }
};

// 2. Middleware kiểm tra quyền (Role)
const verifyRole = (allowedRoles) => {
    return (req, res, next) => {
        // req.user đã được gán từ hàm verifyToken ở trên
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: "Bạn không có quyền truy cập chức năng này!" });
        }
        next();
    };
};

module.exports = { verifyToken, verifyRole };