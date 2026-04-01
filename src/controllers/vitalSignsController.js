const db = require('../config/db');

/**
 * VITAL SIGNS CONTROLLER
 * Quản lý chỉ số sức khỏe: Nhịp tim, nhịp thở, huyết áp, nhiệt độ
 */

// 1️⃣ Lưu/Cập nhật chỉ số sức khỏe
const saveVitalSigns = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { appointment_id, heart_rate, respiratory_rate, blood_pressure_systolic, blood_pressure_diastolic, body_temperature, preliminary_assessment } = req.body;

        if (!appointment_id) {
            return res.status(400).json({ message: "appointment_id là bắt buộc" });
        }

        // Kiểm tra appointment có tồn tại không
        const [appointments] = await connection.execute(
            'SELECT id FROM appointments WHERE id = ?',
            [appointment_id]
        );
        if (appointments.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy appointment này" });
        }

        // Kiểm tra xem đã có vital signs cho appointment này chưa
        const [existing] = await connection.execute(
            'SELECT id FROM vital_signs WHERE appointment_id = ?',
            [appointment_id]
        );

        await connection.beginTransaction();

        if (existing.length > 0) {
            // Update
            await connection.execute(
                `UPDATE vital_signs SET 
                    heart_rate = ?, respiratory_rate = ?, 
                    blood_pressure_systolic = ?, blood_pressure_diastolic = ?, 
                    body_temperature = ?, preliminary_assessment = ?
                WHERE appointment_id = ?`,
                [heart_rate, respiratory_rate, blood_pressure_systolic, blood_pressure_diastolic, body_temperature, preliminary_assessment, appointment_id]
            );
        } else {
            // Insert
            await connection.execute(
                `INSERT INTO vital_signs (appointment_id, heart_rate, respiratory_rate, blood_pressure_systolic, blood_pressure_diastolic, body_temperature, preliminary_assessment)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [appointment_id, heart_rate, respiratory_rate, blood_pressure_systolic, blood_pressure_diastolic, body_temperature, preliminary_assessment]
            );
        }

        await connection.commit();
        res.status(201).json({ message: "Đã lưu chỉ số sức khỏe thành công!" });
    } catch (error) {
        try { await connection.rollback(); } catch (e) {}
        console.error('Lỗi lưu vital signs:', error);
        res.status(500).json({ message: "Lỗi server!" });
    } finally {
        connection.release();
    }
};

// 2️⃣ Lấy vital signs của 1 appointment
const getVitalSigns = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const [vitals] = await db.execute(
            'SELECT * FROM vital_signs WHERE appointment_id = ?',
            [appointmentId]
        );
        
        if (vitals.length === 0) {
            return res.status(404).json({ message: "Không có dữ liệu vital signs cho appointment này" });
        }

        res.status(200).json(vitals[0]);
    } catch (error) {
        console.error('Lỗi lấy vital signs:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 3️⃣ Lấy tất cả vital signs (để xem lịch sử)
const getAllVitalSigns = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit ?? '50', 10);
        const [vitals] = await db.execute(
            `SELECT vs.*, a.appointment_date, a.appointment_time, p.full_name, d.full_name as doctor_name
             FROM vital_signs vs
             JOIN appointments a ON a.id = vs.appointment_id
             LEFT JOIN patients p ON p.id = a.patient_id
             LEFT JOIN doctors d ON d.id = a.doctor_id
             ORDER BY vs.created_at DESC
             LIMIT ?`,
            [limit]
        );

        res.status(200).json({ vitals });
    } catch (error) {
        console.error('Lỗi lấy vital signs:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = {
    saveVitalSigns,
    getVitalSigns,
    getAllVitalSigns
};
