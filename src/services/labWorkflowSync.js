const db = require('../config/db');

/**
 * Đồng bộ appointments.lab_workflow_status theo test_orders của appointment.
 */
async function syncAppointmentLabWorkflow(connection, appointmentId) {
    const conn = connection || db;
    const exec = (sql, p) => (connection ? connection.execute(sql, p) : conn.execute(sql, p));

    try {
        const [[row]] = await exec(
            `SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_cnt,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_cnt
         FROM test_orders WHERE appointment_id = ?`,
            [appointmentId]
        );

        const total = Number(row?.total || 0);
        if (total === 0) {
            await exec(`UPDATE appointments SET lab_workflow_status = 'none' WHERE id = ?`, [appointmentId]);
            return;
        }

        const unpaid = Number(row?.unpaid_cnt || 0);
        const completed = Number(row?.completed_cnt || 0);

        let status = 'in_lab';
        if (unpaid > 0) {
            status = 'awaiting_lab_payment';
        } else if (completed < total) {
            status = 'in_lab';
        } else {
            status = 'awaiting_doctor_lab';
        }

        const [[appt]] = await exec(`SELECT lab_workflow_status FROM appointments WHERE id = ?`, [appointmentId]);
        if (appt?.lab_workflow_status === 'closed') {
            return;
        }

        await exec(`UPDATE appointments SET lab_workflow_status = ? WHERE id = ?`, [status, appointmentId]);
    } catch (e) {
        if (e.errno === 1054 || e.code === 'ER_BAD_FIELD_ERROR') {
            console.warn('[labWorkflowSync] Bỏ qua — chạy node scripts/migrateLabWorkflow.js');
            return;
        }
        throw e;
    }
}

module.exports = { syncAppointmentLabWorkflow };
