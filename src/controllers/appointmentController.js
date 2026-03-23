const db = require('../config/db');
const { sendConfirmationEmail } = require('../services/emailService'); // Import service gửi mail

const bookAppointment = async (req, res) => {
    try {
        const patientId = req.user.id; 
        const { doctor_id, appointment_date, appointment_time } = req.body;

        if (!doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ message: "Vui lòng chọn bác sĩ, ngày và giờ khám!" });
        }

        // Kiểm tra doctor tồn tại, có hồ sơ đầy đủ và đang hoạt động
        // doctor_id ở đây là d.id từ doctors table
        const [doctors] = await db.execute(`
            SELECT d.id as doctor_id, u.id as user_id, d.status, d.full_name
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ? AND u.role = 'doctor' AND u.status = 'active' AND d.status IN ('Active', 'Đang hoạt động')
        `, [doctor_id]);
        if (doctors.length === 0) return res.status(404).json({ message: "Bác sĩ này không khả dụng hoặc đang ngừng hoạt động!" });
        
        const doctorUserId = doctors[0].user_id;

        // Kiểm tra doctor có lịch làm việc được duyệt vào ngày này không
        const [schedules] = await db.execute(`
            SELECT id FROM doctor_schedules 
            WHERE doctor_id = ? AND work_date = ? AND status = 'approved'
        `, [doctor_id, appointment_date]);
        if (schedules.length === 0) {
            return res.status(400).json({ message: "Bác sĩ không có lịch làm việc được duyệt vào ngày này!" });
        }

        // Check existing appointments (appointments.doctor_id stores user_id)
        const [existingAppointments] = await db.execute(
            'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
            [doctorUserId, appointment_date, appointment_time]
        );
        if (existingAppointments.length > 0) return res.status(409).json({ message: "Giờ khám này đã được đặt rồi!" });

        // 1. Lưu vào DB (lưu user_id của doctor, appointments.doctor_id lưu user_id)
        const [result] = await db.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)',
            [patientId, doctorUserId, appointment_date, appointment_time]
        );

        // 2. Lấy email của patient để gửi thông báo
        const [patients] = await db.execute('SELECT email FROM users WHERE id = ?', [patientId]);
        const patientEmail = patients[0].email;

        // 3. Chạy hàm gửi mail 
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
        const { phone } = req.query; 
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
        const { id } = req.params; 
        
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

// API: Lấy danh sách bác sĩ cho Frontend
const getDoctors = async (req, res) => {
    try {
        // Lấy doctors: CHỈ có hồ sơ, đang hoạt động, và user active
        const [doctors] = await db.execute(`
            SELECT d.id, u.id as user_id, u.username, d.full_name, d.specialty, d.status
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE u.role = 'doctor' AND u.status = 'active' AND d.status IN ('Active', 'Đang hoạt động')
            ORDER BY d.full_name ASC
        `);
        res.status(200).json({ doctors });
    } catch (error) {
        console.error("Lỗi lấy danh sách bác sĩ:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API: Bác sĩ xem danh sách bệnh nhân CỦA MÌNH trong hôm nay
const getDoctorAppointments = async (req, res) => {
    try {
        const userId = req.user.id; 
        const [doctorRows] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: "Bác sĩ chưa có hồ sơ thông tin!" });
        }
        
        const [appointments] = await db.execute(`
            SELECT a.id, a.appointment_time, a.status, u.username AS patient_name, u.phone
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
            ORDER BY a.appointment_time ASC
        `, [userId]);

        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Lỗi lấy lịch khám cho bác sĩ:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API 1: Lễ tân lấy danh sách bệnh nhân đã khám xong (completed) nhưng chưa đóng tiền (unpaid)
const getUnpaidAppointments = async (req, res) => {
    try {
        const [appointments] = await db.execute(`
            SELECT a.id, a.appointment_date, a.appointment_time, u.username AS patient_name, u.phone, m.diagnosis,
                   d.full_name AS doctor_name
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            JOIN users doctor_user ON a.doctor_id = doctor_user.id
            LEFT JOIN doctors d ON doctor_user.id = d.user_id
            LEFT JOIN medical_records m ON a.id = m.appointment_id
            WHERE a.status = 'completed' AND a.payment_status = 'unpaid'
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        `);
        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Lỗi lấy danh sách thu tiền:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API: Lấy danh sách appointments đã đặt theo doctor_id và date
const getBookedSlots = async (req, res) => {
    try {
        const { doctor_id, appointment_date } = req.query;

        if (!doctor_id || !appointment_date) {
            return res.status(400).json({ message: "Vui lòng cung cấp doctor_id và appointment_date!" });
        }

        // doctor_id từ query là doctors.id, cần lấy user_id của doctor
        const [doctorInfo] = await db.execute('SELECT user_id FROM doctors WHERE id = ?', [doctor_id]);
        if (doctorInfo.length === 0) {
            return res.status(404).json({ message: "Bác sĩ không tồn tại!" });
        }
        const doctorUserId = doctorInfo[0].user_id;

        const [appointments] = await db.execute(
            `SELECT appointment_time FROM appointments 
             WHERE doctor_id = ? AND appointment_date = ? AND status != "cancelled"`,
            [doctorUserId, appointment_date]
        );

        // Trả về danh sách TIME đã được đặt
        const bookedTimes = appointments.map(apt => apt.appointment_time);
        res.status(200).json({ bookedTimes });
    } catch (error) {
        console.error("Lỗi lấy danh sách slots:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { bookAppointment, searchByPhone, checkInAppointment, getDoctors, getDoctorAppointments, getUnpaidAppointments, getBookedSlots };