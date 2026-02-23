const db = require('../config/db');
const { sendConfirmationEmail } = require('../services/emailService'); // Import service gửi mail

const bookAppointment = async (req, res) => {
    try {
        const patientId = req.user.id; 
        const { doctor_id, appointment_date, appointment_time } = req.body;

        if (!doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ message: "Vui lòng chọn bác sĩ, ngày và giờ khám!" });
        }

        const [doctors] = await db.execute('SELECT * FROM users WHERE id = ? AND role = "doctor"', [doctor_id]);
        if (doctors.length === 0) return res.status(404).json({ message: "Không tìm thấy bác sĩ này!" });

        const [existingAppointments] = await db.execute(
            'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
            [doctor_id, appointment_date, appointment_time]
        );
        if (existingAppointments.length > 0) return res.status(409).json({ message: "Bác sĩ đã có lịch hẹn giờ này!" });

        // 1. Lưu vào DB
        const [result] = await db.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)',
            [patientId, doctor_id, appointment_date, appointment_time]
        );

        // 2. Lấy email của patient để gửi thông báo
        const [patients] = await db.execute('SELECT email FROM users WHERE id = ?', [patientId]);
        const patientEmail = patients[0].email;

        // 3. Chạy hàm gửi mail (không cần await để user không phải đợi mail gửi xong mới nhận được response)
        sendConfirmationEmail(patientEmail, appointment_date, appointment_time);

        res.status(201).json({ 
            message: "Đặt lịch khám thành công! Vui lòng kiểm tra email.", 
            appointmentId: result.insertId 
        });

    } catch (error) {
        console.error("Lỗi đặt lịch:", error);
        res.status(500).json({ message: "Lỗi server khi đặt lịch!" });
    }
};

// API: Lễ tân tìm lịch khám trong ngày theo số điện thoại
const searchByPhone = async (req, res) => {
    try {
        const { phone } = req.query; // Lấy từ query string: ?phone=09...
        if (!phone) return res.status(400).json({ message: "Vui lòng nhập số điện thoại!" });

        const [appointments] = await db.execute(`
            SELECT a.id, a.appointment_time, a.status, u.username as patient_name, u.phone
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE u.phone = ? AND a.appointment_date = CURDATE()
        `, [phone]);

        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API: Lễ tân bấm nút Check-in
const checkInAppointment = async (req, res) => {
    try {
        const { id } = req.params; // Lấy ID của lịch khám trên URL
        
        // Cập nhật trạng thái
        const [result] = await db.execute(
            'UPDATE appointments SET status = "checked-in" WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Không tìm thấy lịch khám này!" });
        }

        res.status(200).json({ message: "Check-in thành công! Bệnh nhân có thể vào khám." });
    } catch (error) {
        console.error("Lỗi check-in:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { bookAppointment, searchByPhone, checkInAppointment };