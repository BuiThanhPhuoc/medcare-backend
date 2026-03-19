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
        // *** CHỈ LẤY DOCTORS ĐANG HOẠT ĐỘNG ***
        const [doctors] = await db.execute(
            'SELECT id, username, status FROM users WHERE role = "doctor" AND status = "active"'
        );
        res.status(200).json({ doctors });
    } catch (error) {
        console.error("Lỗi lấy danh sách bác sĩ:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API: Bác sĩ xem danh sách bệnh nhân CỦA MÌNH trong hôm nay
const getDoctorAppointments = async (req, res) => {
    try {
        const doctorId = req.user.id; 
        
        // Đã xóa a.reason khỏi câu lệnh SELECT
        const [appointments] = await db.execute(`
            SELECT a.id, a.appointment_time, a.status, u.username AS patient_name, u.phone
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
            ORDER BY a.appointment_time ASC
        `, [doctorId]);

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
            SELECT a.id, a.appointment_date, a.appointment_time, u.username AS patient_name, u.phone, m.diagnosis
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
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

// API 2: Lễ tân bấm nút Xác nhận thu tiền
const processPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute(
            'UPDATE appointments SET payment_status = "paid" WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Không tìm thấy lịch khám!" });
        }
        res.status(200).json({ message: "💰 Thu tiền thành công!" });
    } catch (error) {
        console.error("Lỗi thanh toán:", error);
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

        const [appointments] = await db.execute(
            `SELECT appointment_time FROM appointments 
             WHERE doctor_id = ? AND appointment_date = ? AND status != "cancelled"`,
            [doctor_id, appointment_date]
        );

        // Trả về danh sách TIME đã được đặt
        const bookedTimes = appointments.map(apt => apt.appointment_time);
        res.status(200).json({ bookedTimes });
    } catch (error) {
        console.error("Lỗi lấy danh sách slots:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { bookAppointment, searchByPhone, checkInAppointment, getDoctors, getDoctorAppointments, getUnpaidAppointments, processPayment, getBookedSlots };