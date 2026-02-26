const db = require('../config/db');

const getRevenueStatistics = async (req, res) => {
    try {
        // 1. Tổng doanh thu toàn hệ thống
        const [totalResult] = await db.execute(
            'SELECT SUM(total_amount) AS total_revenue FROM payments'
        );

        // 2. Thống kê theo phương thức thanh toán
        const [methodResult] = await db.execute(
            'SELECT payment_method, SUM(total_amount) AS total, COUNT(id) AS total_transactions FROM payments GROUP BY payment_method'
        );

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

module.exports = { getRevenueStatistics };