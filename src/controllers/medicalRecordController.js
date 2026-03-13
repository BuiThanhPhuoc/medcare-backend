const db = require('../config/db');

const examinePatient = async (req, res) => {
    try {
        const doctorId = req.user.id; // Lấy ID của bác sĩ từ token
        const { appointment_id, diagnosis, prescription, note } = req.body;

        if (!appointment_id || !diagnosis) {
            return res.status(400).json({ message: "Vui lòng nhập mã lịch khám và chẩn đoán bệnh!" });
        }

        // 1. Kiểm tra lịch khám có tồn tại, có đúng của bác sĩ này và đang ở trạng thái "checked-in" không?
        const [appointments] = await db.execute(
            'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?',
            [appointment_id, doctorId]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy lịch khám này hoặc bạn không phụ trách ca này!" });
        }

        const appointment = appointments[0];

        // Áp dụng đúng luật bạn vạch ra: Chỉ khám khi đã check-in
        if (appointment.status !== 'checked-in') {
            return res.status(400).json({ message: "Bệnh nhân chưa check-in hoặc ca khám đã kết thúc!" });
        }

        // 2. Lưu hồ sơ khám bệnh vào bảng medical_records
        await db.execute(
            'INSERT INTO medical_records (appointment_id, diagnosis, prescription, note) VALUES (?, ?, ?, ?)',
            [appointment_id, diagnosis, prescription, note || 'Không có ghi chú']
        );

        // 3. Cập nhật trạng thái lịch khám thành "completed" (Đã khám xong)
        await db.execute(
            'UPDATE appointments SET status = "completed" WHERE id = ?',
            [appointment_id]
        );

        res.status(201).json({ message: "Hoàn thành khám bệnh và lưu hồ sơ thành công!" });

    } catch (error) {
        console.error("Lỗi khám bệnh:", error);
        res.status(500).json({ message: "Lỗi server khi lưu hồ sơ bệnh án!" });
    }
};


const getPatientHistory = async (req, res) => {
    try {
        const patientId = req.user.id; // Lấy ID bệnh nhân từ token

        // Query kết hợp 3 bảng: appointments, medical_records và users (để lấy tên bác sĩ)
        const [history] = await db.execute(`
            SELECT 
                a.id AS appointment_id,
                a.appointment_date,
                a.appointment_time,
                d.username AS doctor_name,
                mr.diagnosis,
                mr.prescription,
                mr.note,
                a.payment_status
            FROM appointments a
            JOIN users d ON a.doctor_id = d.id
            LEFT JOIN medical_records mr ON a.id = mr.appointment_id
            WHERE a.patient_id = ? AND a.status = 'completed'
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [patientId]);

        if (history.length === 0) {
            return res.status(200).json({ message: "Bạn chưa có lịch sử khám bệnh nào.", history: [] });
        }

        res.status(200).json({ history });

    } catch (error) {
        console.error("Lỗi lấy lịch sử khám:", error);
        res.status(500).json({ message: "Lỗi server khi lấy hồ sơ bệnh án!" });
    }
};

// API: Bệnh nhân xem lịch sử khám và toa thuốc của chính mình
const getMyMedicalRecords = async (req, res) => {
    try {
        const patientId = req.user.id; 
        
        // Nối 3 bảng: Bệnh án + Lịch khám + User(Bác sĩ) để lấy đủ thông tin
        const [records] = await db.execute(`
            SELECT m.id, m.diagnosis, m.prescription, m.note, a.appointment_date, u.username AS doctor_name
            FROM medical_records m
            JOIN appointments a ON m.appointment_id = a.id
            JOIN users u ON a.doctor_id = u.id
            WHERE a.patient_id = ?
            ORDER BY a.appointment_date DESC
        `, [patientId]);

        res.status(200).json({ records });
    } catch (error) {
        console.error("Lỗi lấy bệnh án:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { examinePatient, getPatientHistory, getMyMedicalRecords };