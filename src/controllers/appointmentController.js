const db = require('../config/db');

const bookAppointment = async (req, res) => {
    try {
        // Lấy ID của patient từ token (đã được middleware giải mã và gán vào req.user)
        const patientId = req.user.id; 
        const { doctor_id, appointment_date, appointment_time } = req.body;

        // 1. Validation đầu vào
        if (!doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ message: "Vui lòng chọn bác sĩ, ngày và giờ khám!" });
        }

        // 2. Kiểm tra xem người được chọn có đúng là bác sĩ không
        const [doctors] = await db.execute('SELECT * FROM users WHERE id = ? AND role = "doctor"', [doctor_id]);
        if (doctors.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy bác sĩ này!" });
        }

        // 3. Kiểm tra xem giờ đó bác sĩ đã có lịch chưa (Tránh đặt trùng lịch)
        const [existingAppointments] = await db.execute(
            'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
            [doctor_id, appointment_date, appointment_time]
        );

        if (existingAppointments.length > 0) {
            return res.status(409).json({ message: "Bác sĩ đã có lịch hẹn vào thời gian này, vui lòng chọn giờ khác!" });
        }

        // 4. Lưu vào Database (Mặc định status là 'pending')
        const [result] = await db.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)',
            [patientId, doctor_id, appointment_date, appointment_time]
        );

        res.status(201).json({ 
            message: "Đặt lịch khám thành công!", 
            appointmentId: result.insertId 
        });

        // TODO: Phần này sau này sẽ gọi hàm gửi Email xác nhận bằng nodemailer (mình sẽ làm ở bước sau cho đỡ rối)

    } catch (error) {
        console.error("Lỗi đặt lịch:", error);
        res.status(500).json({ message: "Lỗi server khi đặt lịch!" });
    }
};

module.exports = { bookAppointment };