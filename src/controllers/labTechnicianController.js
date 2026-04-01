const db = require('../config/db');
const { syncAppointmentLabWorkflow } = require('../services/labWorkflowSync');

/** Hàng chờ: chỉ định đã thanh toán, chưa hoàn thành */
const getLabQueue = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT 
                tor.id AS order_id,
                tor.appointment_id,
                tor.lab_test_id,
                tor.quantity,
                tor.status,
                tor.payment_status,
                tor.test_result,
                tor.notes,
                tor.created_at,
                lt.name AS test_name,
                lt.code,
                lt.price,
                a.appointment_date,
                a.appointment_time,
                p.full_name AS patient_name,
                u.phone AS patient_phone
             FROM test_orders tor
             JOIN lab_tests lt ON lt.id = tor.lab_test_id
             JOIN appointments a ON a.id = tor.appointment_id
             JOIN patients p ON p.id = a.patient_id
             JOIN users u ON u.id = p.user_id
             WHERE tor.payment_status = 'paid'
               AND tor.status IN ('pending', 'in-progress')
             ORDER BY tor.created_at ASC`
        );
        res.status(200).json({ queue: rows });
    } catch (e) {
        console.error('getLabQueue:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getLabOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            `SELECT 
                tor.*,
                lt.name AS test_name,
                lt.code,
                lt.price,
                lt.unit,
                lt.normal_range_min,
                lt.normal_range_max,
                a.appointment_date,
                a.appointment_time,
                p.full_name AS patient_name,
                p.date_of_birth,
                p.gender,
                u.phone AS patient_phone
             FROM test_orders tor
             JOIN lab_tests lt ON lt.id = tor.lab_test_id
             JOIN appointments a ON a.id = tor.appointment_id
             JOIN patients p ON p.id = a.patient_id
             JOIN users u ON u.id = p.user_id
             WHERE tor.id = ?`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy chỉ định.' });
        res.status(200).json({ order: rows[0] });
    } catch (e) {
        console.error('getLabOrderDetail:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const submitLabResult = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const { test_result, status } = req.body;
        const newStatus = status === 'in-progress' ? 'in-progress' : 'completed';

        const [orders] = await connection.execute(
            `SELECT id, appointment_id, payment_status FROM test_orders WHERE id = ?`,
            [id]
        );
        if (orders.length === 0) return res.status(404).json({ message: 'Không tìm thấy chỉ định.' });
        if (orders[0].payment_status !== 'paid') {
            return res.status(400).json({ message: 'Chỉ định chưa thanh toán, không thể nhập kết quả.' });
        }

        await connection.beginTransaction();
        await connection.execute(
            `UPDATE test_orders SET test_result = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [test_result || null, newStatus, id]
        );
        await syncAppointmentLabWorkflow(connection, orders[0].appointment_id);
        await connection.commit();

        res.status(200).json({ message: 'Đã lưu kết quả xét nghiệm.' });
    } catch (e) {
        try {
            await connection.rollback();
        } catch (_) {}
        console.error('submitLabResult:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getLabQueue,
    getLabOrderDetail,
    submitLabResult
};
