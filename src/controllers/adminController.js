const db = require('../config/db');

// 1. Hàm thống kê doanh thu
const getRevenueStatistics = async (req, res) => {
    try {
        const [totalResult] = await db.execute('SELECT SUM(total_amount) AS total_revenue FROM payments');
        const [methodResult] = await db.execute('SELECT payment_method, SUM(total_amount) AS total, COUNT(id) AS total_transactions FROM payments GROUP BY payment_method');

        res.status(200).json({
            message: "Thống kê doanh thu thành công!",
            data: {
                total_revenue: totalResult[0].total_revenue || 0,
                revenue_by_method: methodResult
            }
        });
    } catch (error) {
        console.error("Lỗi thống kê:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 1.1 Hàm thống kê doanh thu theo ngày (timeline)
// Dùng created_at trong bảng payments để dựng biểu đồ doanh thu theo thời gian.
const getRevenueTimeline = async (req, res) => {
    try {
        const daysParam = parseInt(req.query.days ?? '7', 10);
        const days = Number.isFinite(daysParam) ? daysParam : 7;
        const safeDays = Math.min(Math.max(days, 1), 30); // giới hạn 1..30 ngày

        // safeDays=7 -> lấy từ CURDATE() - 6 ngày đến hôm nay (tính cả hôm nay)
        const offsetDays = safeDays - 1;

        const [rows] = await db.execute(
            `
            SELECT
                DATE(created_at) AS day,
                SUM(total_amount) AS total_revenue,
                COUNT(id) AS total_transactions
            FROM payments
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY day ASC
            `,
            [offsetDays]
        );

        res.status(200).json({
            message: "Thống kê doanh thu theo ngày thành công!",
            data: {
                timeline: rows.map((r) => ({
                    day: r.day,
                    total_revenue: r.total_revenue || 0,
                    total_transactions: r.total_transactions || 0
                }))
            }
        });
    } catch (error) {
        console.error("Lỗi thống kê timeline:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 2. Hàm lấy danh sách user
const getAllUsers = async (req, res) => {
    try {
        const { calculatePagination, createPaginatedResponse } = require('../utils/paginationUtils');
        const pagination = calculatePagination(req.query.page, req.query.limit);
        const { search, role: roleFilter, status: statusFilter } = req.query;

        // Build WHERE clause
        let whereClause = 'WHERE id != ?';
        let params = [req.user.id];

        if (search) {
            whereClause += ' AND (username LIKE ? OR email LIKE ? OR phone LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (roleFilter) {
            whereClause += ' AND role = ?';
            params.push(roleFilter);
        }

        if (statusFilter) {
            whereClause += ' AND status = ?';
            params.push(statusFilter);
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
        const [[{ total }]] = await db.query(countQuery, params);

        // Get paginated data
        const dataQuery = `
            SELECT id, username, email, phone, role, status, is_locked, created_at 
            FROM users 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [users] = await db.query(dataQuery, [...params, pagination.limit, pagination.offset]);

        // Return shape expected by frontend: { success, users, pagination }
        res.status(200).json({
            success: true,
            users,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total,
                hasNextPage: pagination.page * pagination.limit < total,
                hasPrevPage: pagination.page > 1
            }
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách user:", error);
        res.status(500).json({ success: false, message: "Lỗi server!", error: error.message });
    }
};

// 3. Hàm khóa/mở khóa tài khoản
const toggleLockUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (id == req.user.id) {
            return res.status(400).json({ message: "Không thể tự khóa tài khoản của chính mình!" });
        }

        const [users] = await db.execute('SELECT status, role FROM users WHERE id = ?', [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy người dùng này!" });
        }

        if (users[0].role === 'admin') {
            return res.status(403).json({ message: "Không thể khóa tài khoản của Admin khác!" });
        }

        const newStatus = users[0].status === 'active' ? 'inactive' : 'active'; 
        
        await db.execute('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);

        const message = newStatus === 'inactive' ? "Đã khóa tài khoản thành công!" : "Đã mở khóa tài khoản thành công!";
        res.status(200).json({ message });

    } catch (error) {
        console.error("Lỗi khóa tài khoản:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { getRevenueStatistics, getRevenueTimeline, getAllUsers, toggleLockUser };