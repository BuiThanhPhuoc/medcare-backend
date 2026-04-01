const db = require('../config/db');
const { syncAppointmentLabWorkflow } = require('../services/labWorkflowSync');

/** Lễ tân / admin: thu phí xét nghiệm (tất cả chỉ định chưa thanh toán của lịch khám) */
const payLabTestsForAppointment = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { appointmentId } = req.params;

        const [orders] = await connection.execute(
            `SELECT id FROM test_orders WHERE appointment_id = ? AND payment_status = 'unpaid'`,
            [appointmentId]
        );
        if (orders.length === 0) {
            return res.status(400).json({ message: 'Không có chỉ định xét nghiệm cần thu phí.' });
        }

        await connection.beginTransaction();
        await connection.execute(
            `UPDATE test_orders SET payment_status = 'paid' WHERE appointment_id = ? AND payment_status = 'unpaid'`,
            [appointmentId]
        );
        await syncAppointmentLabWorkflow(connection, Number(appointmentId));
        await connection.commit();

        res.status(200).json({ message: `Đã ghi nhận thanh toán xét nghiệm (${orders.length} chỉ định).` });
    } catch (e) {
        try {
            await connection.rollback();
        } catch (_) {}
        console.error('payLabTestsForAppointment:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    } finally {
        connection.release();
    }
};

/** Tóm tắt chỉ định + phí xét nghiệm theo appointment (lễ tân) */
const getLabPaymentSummary = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const [rows] = await db.execute(
            `SELECT 
                tor.id, tor.lab_test_id, tor.quantity, tor.payment_status, tor.status AS order_status,
                lt.name AS test_name, lt.code, lt.price,
                (lt.price * tor.quantity) AS line_total
             FROM test_orders tor
             JOIN lab_tests lt ON lt.id = tor.lab_test_id
             WHERE tor.appointment_id = ?
             ORDER BY tor.id ASC`,
            [appointmentId]
        );
        const unpaid = rows.filter((r) => r.payment_status === 'unpaid');
        const totalUnpaid = unpaid.reduce((s, r) => s + Number(r.line_total || 0), 0);
        res.status(200).json({ items: rows, unpaid_total: totalUnpaid, unpaid_count: unpaid.length });
    } catch (e) {
        console.error('getLabPaymentSummary:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

/** Bác sĩ: sau khi xem kết quả XN — đồng ý xuất / chỉ định nhập viện */
const doctorLabDecision = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { decision, notes } = req.body;
        if (!['approve_discharge', 'admission'].includes(decision)) {
            return res.status(400).json({ message: 'decision phải là approve_discharge hoặc admission' });
        }

        const admission = decision === 'admission' ? 1 : 0;
        await db.execute(
            `UPDATE appointments 
             SET lab_workflow_status = 'closed', admission_requested = ?, lab_review_notes = ?
             WHERE id = ?`,
            [admission, notes || null, appointmentId]
        );

        res.status(200).json({
            message:
                decision === 'admission'
                    ? 'Đã ghi nhận chỉ định nhập viện.'
                    : 'Đã xác nhận kết quả xét nghiệm. Có thể tiếp tục kê đơn / thanh toán.'
        });
    } catch (e) {
        console.error('doctorLabDecision:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

/** Danh sách lịch khám chờ bác sĩ xem lại kết quả XN */
const getAppointmentsAwaitingDoctorLab = async (req, res) => {
    try {
        const userId = req.user.id;
        const [docs] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (docs.length === 0) return res.status(404).json({ message: 'Không tìm thấy hồ sơ bác sĩ' });
        const doctorId = docs[0].id;

        const [rows] = await db.execute(
            `SELECT a.id, a.appointment_date, a.appointment_time, a.lab_workflow_status,
                    p.full_name AS patient_name, u.phone AS patient_phone
             FROM appointments a
             JOIN patients p ON p.id = a.patient_id
             JOIN users u ON u.id = p.user_id
             WHERE a.doctor_id = ? AND a.lab_workflow_status = 'awaiting_doctor_lab'
             ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
            [doctorId]
        );
        res.status(200).json({ appointments: rows });
    } catch (e) {
        console.error('getAppointmentsAwaitingDoctorLab:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

/** Lấy danh sách lab payment theo phone và payment status (cho lễ tân) */
const getLabPaymentByPhone = async (req, res) => {
    try {
        const { phone, paymentStatus } = req.query;

        let whereClause = '1=1'; // Mặc định không có điều kiện
        const params = [];

        // Filter theo phone nếu có
        if (phone && phone.trim()) {
            whereClause += ` AND u.phone LIKE ?`;
            params.push(`%${phone.trim()}%`);
        }

        // Filter theo payment status nếu có
        if (paymentStatus && ['unpaid', 'paid'].includes(paymentStatus)) {
            whereClause += ` AND tor.payment_status = ?`;
            params.push(paymentStatus);
        }

        const [appointments] = await db.execute(
            `SELECT DISTINCT
                a.id AS appointment_id,
                a.appointment_date,
                a.appointment_time,
                p.full_name AS patient_name,
                u.phone AS patient_phone,
                COUNT(tor.id) AS total_tests,
                COALESCE(SUM(CASE WHEN tor.payment_status = 'unpaid' THEN 1 ELSE 0 END), 0) AS unpaid_count,
                COALESCE(SUM(CASE WHEN tor.payment_status = 'unpaid' THEN lt.price * tor.quantity ELSE 0 END), 0) AS unpaid_amount
             FROM appointments a
             JOIN patients p ON p.id = a.patient_id
             JOIN users u ON u.id = p.user_id
             LEFT JOIN test_orders tor ON tor.appointment_id = a.id
             LEFT JOIN lab_tests lt ON lt.id = tor.lab_test_id
             WHERE ${whereClause}
             GROUP BY a.id
             ORDER BY a.appointment_date DESC, a.appointment_time DESC
             LIMIT 50`,
            params
        );

        res.status(200).json({ appointments });
    } catch (e) {
        console.error('getLabPaymentByPhone:', e);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

module.exports = {
    payLabTestsForAppointment,
    getLabPaymentSummary,
    doctorLabDecision,
    getAppointmentsAwaitingDoctorLab,
    getLabPaymentByPhone
};
