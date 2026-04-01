const db = require('../config/db');
const { syncAppointmentLabWorkflow } = require('../services/labWorkflowSync');

/**
 * TEST ORDERS CONTROLLER
 * Bác sĩ: Chỉ định xét nghiệm
 * Receptionist/Admin: Quản lý kết quả
 */

const createTestOrder = async (req, res) => {
    try {
        const { appointment_id, lab_test_id, quantity, notes } = req.body;

        if (!appointment_id || !lab_test_id) {
            return res.status(400).json({ message: 'appointment_id và lab_test_id là bắt buộc' });
        }

        const [appointments] = await db.execute('SELECT id FROM appointments WHERE id = ?', [appointment_id]);
        if (appointments.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy appointment này' });
        }

        const [tests] = await db.execute('SELECT id, price FROM lab_tests WHERE id = ? AND is_active = 1', [lab_test_id]);
        if (tests.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy xét nghiệm này hoặc đã vô hiệu hóa' });
        }

        await db.execute(
            `INSERT INTO test_orders (appointment_id, lab_test_id, quantity, notes, status)
            VALUES (?, ?, ?, ?, 'pending')`,
            [appointment_id, lab_test_id, quantity || 1, notes || null]
        );

        await syncAppointmentLabWorkflow(null, Number(appointment_id));

        res.status(201).json({ message: 'Đã chỉ định xét nghiệm thành công!' });
    } catch (error) {
        console.error('Lỗi tạo test order:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getTestOrdersByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const [orders] = await db.execute(
            `SELECT 
                tor.id, tor.appointment_id, tor.lab_test_id, tor.quantity, tor.payment_status,
                tor.status, tor.test_result, tor.notes, tor.created_at,
                lt.name AS test_name, lt.code, lt.price, lt.unit, lt.normal_range_min, lt.normal_range_max,
                ltc.name AS category_name
            FROM test_orders tor
            JOIN lab_tests lt ON lt.id = tor.lab_test_id
            LEFT JOIN lab_test_categories ltc ON lt.lab_test_category_id = ltc.id
            WHERE tor.appointment_id = ?
            ORDER BY tor.created_at DESC`,
            [appointmentId]
        );

        res.status(200).json({ orders });
    } catch (error) {
        console.error('Lỗi lấy test orders:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getAllTestOrders = async (req, res) => {
    try {
        const status = req.query.status || null;
        const limit = parseInt(req.query.limit ?? '100', 10);

        let sql = `SELECT 
                    tor.id, tor.appointment_id, tor.lab_test_id, tor.quantity, tor.status, tor.test_result, tor.notes, tor.created_at,
                    lt.name AS test_name, lt.price,
                    a.appointment_date, a.appointment_time,
                    p.full_name AS patient_name
                FROM test_orders tor
                JOIN lab_tests lt ON lt.id = tor.lab_test_id
                JOIN appointments a ON a.id = tor.appointment_id
                LEFT JOIN patients p ON p.id = a.patient_id
                WHERE 1=1`;
        const params = [];

        if (status) {
            sql += ' AND tor.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY tor.created_at DESC LIMIT ?';
        params.push(limit);

        const [orders] = await db.execute(sql, params);
        res.status(200).json({ orders });
    } catch (error) {
        console.error('Lỗi lấy test orders:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const updateTestResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { test_result, status } = req.body;

        const [orders] = await db.execute('SELECT id, appointment_id FROM test_orders WHERE id = ?', [id]);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy test order này' });
        }

        const newStatus = status || 'completed';
        await db.execute('UPDATE test_orders SET test_result = ?, status = ? WHERE id = ?', [
            test_result || null,
            newStatus,
            id
        ]);

        await syncAppointmentLabWorkflow(null, orders[0].appointment_id);

        res.status(200).json({ message: 'Đã cập nhật kết quả xét nghiệm thành công!' });
    } catch (error) {
        console.error('Lỗi cập nhật test result:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const deleteTestOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const [orders] = await db.execute('SELECT id, status, appointment_id FROM test_orders WHERE id = ?', [id]);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy test order này' });
        }

        if (orders[0].status !== 'pending') {
            return res.status(400).json({ message: 'Chỉ có thể xóa xét nghiệm chưa thực hiện (pending)' });
        }

        const apptId = orders[0].appointment_id;
        await db.execute('DELETE FROM test_orders WHERE id = ?', [id]);
        await syncAppointmentLabWorkflow(null, apptId);

        res.status(200).json({ message: 'Đã xóa chỉ định xét nghiệm thành công!' });
    } catch (error) {
        console.error('Lỗi xóa test order:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const updateTestOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'in-progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Trạng thái không hợp lệ. Phải là: ${validStatuses.join(', ')}` });
        }

        const [orders] = await db.execute('SELECT id, appointment_id FROM test_orders WHERE id = ?', [id]);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy test order này' });
        }

        await db.execute('UPDATE test_orders SET status = ? WHERE id = ?', [status, id]);
        await syncAppointmentLabWorkflow(null, orders[0].appointment_id);

        res.status(200).json({ message: `Đã cập nhật trạng thái thành "${status}"` });
    } catch (error) {
        console.error('Lỗi cập nhật trạng thái:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getTestOrdersSummary = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const [summary] = await db.execute(
            `SELECT 
                COUNT(*) AS total_tests,
                SUM(CASE WHEN tor.status = 'completed' THEN 1 ELSE 0 END) AS completed_tests,
                SUM(CASE WHEN tor.status = 'pending' THEN 1 ELSE 0 END) AS pending_tests,
                SUM(CASE WHEN tor.status = 'in-progress' THEN 1 ELSE 0 END) AS in_progress_tests,
                SUM(lt.price * tor.quantity) AS total_cost
            FROM test_orders tor
            JOIN lab_tests lt ON lt.id = tor.lab_test_id
            WHERE tor.appointment_id = ?`,
            [appointmentId]
        );

        res.status(200).json(summary[0]);
    } catch (error) {
        console.error('Lỗi lấy summary:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

module.exports = {
    createTestOrder,
    getTestOrdersByAppointment,
    getAllTestOrders,
    updateTestResult,
    deleteTestOrder,
    updateTestOrderStatus,
    getTestOrdersSummary
};
