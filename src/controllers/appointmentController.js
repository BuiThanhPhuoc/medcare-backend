const db = require('../config/db');
const { sendConfirmationEmail } = require('../services/emailService'); // Import service gửi mail

const bookAppointment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { doctor_id, appointment_date, appointment_time } = req.body;

        if (!doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ message: "Vui lòng chọn bác sĩ, ngày và giờ khám!" });
        }

        // Lấy patient_id từ patients table (patient_id khác với user_id)
        const [patients] = await db.execute(
            'SELECT id, user_id FROM patients WHERE user_id = ?',
            [userId]
        );

        if (patients.length === 0) {
            return res.status(404).json({ message: "Bệnh nhân không tìm thấy. Vui lòng cập nhật hồ sơ bệnh nhân trước!" });
        }

        const patientId = patients[0].id;

        // Kiểm tra doctor tồn tại, có hồ sơ đầy đủ và đang hoạt động
        const [doctors] = await db.execute(`
            SELECT d.id as doctor_id, u.id as user_id, d.status, d.full_name
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ? AND u.role = 'doctor' AND u.status = 'active' AND d.status IN ('Active', 'Đang hoạt động')
        `, [doctor_id]);
        if (doctors.length === 0) return res.status(404).json({ message: "Bác sĩ này không khả dụng hoặc đang ngừng hoạt động!" });
        
        const doctorRecord = doctors[0];

        // Kiểm tra doctor có lịch làm việc được duyệt vào ngày này không
        const [schedules] = await db.execute(`
            SELECT id FROM doctor_schedules 
            WHERE doctor_id = ? AND work_date = ? AND status = 'approved'
        `, [doctor_id, appointment_date]);
        if (schedules.length === 0) {
            return res.status(400).json({ message: "Bác sĩ không có lịch làm việc được duyệt vào ngày này!" });
        }

        // Check existing appointments (appointments.doctor_id stores doctors.id)
        const [existingAppointments] = await db.execute(
            'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
            [doctorRecord.doctor_id, appointment_date, appointment_time]
        );
        if (existingAppointments.length > 0) return res.status(409).json({ message: "Giờ khám này đã được đặt rồi!" });

        // Lưu vào DB (lưu patient_id từ patients table)
        const [result] = await db.execute(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time) VALUES (?, ?, ?, ?)',
            [patientId, doctorRecord.doctor_id, appointment_date, appointment_time]
        );

        // Gửi email thông báo
        try {
            const [userEmail] = await db.execute('SELECT email FROM users WHERE id = ?', [userId]);
            if (userEmail.length > 0) {
                sendConfirmationEmail(userEmail[0].email, appointment_date, appointment_time);
            }
        } catch (emailError) {
            console.error("Lỗi gửi email:", emailError);
            // Không throw error, chỉ log nếu email gửi thất bại
        }

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
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
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
// API: Lấy danh sách chuyên khoa
const getSpecialties = async (req, res) => {
    try {
        const [specialties] = await db.execute(`
            SELECT DISTINCT specialty
            FROM doctors
            WHERE status IN ('Active', 'Đang hoạt động')
            ORDER BY specialty ASC
        `);
        
        // Format specialty names
        const formattedSpecialties = specialties.map((spec, index) => ({
            id: index + 1,
            name: spec.specialty || 'Khác'
        }));
        
        res.status(200).json({ specialties: formattedSpecialties });
    } catch (error) {
        console.error("Lỗi lấy danh sách chuyên khoa:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API: Lấy danh sách bác sĩ, có thể lọc theo chuyên khoa
const getDoctors = async (req, res) => {
    try {
        const { specialty } = req.query;
        
        let query = `
            SELECT d.id, u.id as user_id, u.username, d.full_name, d.specialty, d.status
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE u.role = 'doctor' AND u.status = 'active' AND d.status IN ('Active', 'Đang hoạt động')
        `;
        
        if (specialty && specialty.trim() !== '') {
            query += ` AND d.specialty = ?`;
            const [doctors] = await db.execute(query, [specialty]);
            return res.status(200).json({ doctors });
        } else {
            const [doctors] = await db.execute(query + ` ORDER BY d.full_name ASC`);
            return res.status(200).json({ doctors });
        }
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
        
        const doctorId = doctorRows[0].id;
        const [appointments] = await db.execute(`
            SELECT a.id, a.appointment_time, a.status, a.lab_workflow_status, a.admission_requested,
                   u.username AS patient_name, u.phone
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
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
            SELECT a.id, a.appointment_date, a.appointment_time, u.username AS patient_name, u.phone, m.diagnosis,
                   d.full_name AS doctor_name
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
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

// API: Lấy chi tiết appointment để hiển thị hóa đơn tại quầy thu ngân
const getBillingAppointmentDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const appointmentId = Number(id);
        if (!Number.isFinite(appointmentId)) {
            return res.status(400).json({ message: 'appointmentId không hợp lệ' });
        }

        const [rows] = await db.execute(`
            SELECT
                a.id,
                a.appointment_date,
                a.appointment_time,
                a.status AS appointment_status,
                a.payment_status,
                a.lab_workflow_status,
                u.username AS patient_name,
                u.phone AS patient_phone,
                d.full_name AS doctor_name,
                m.diagnosis,
                m.note
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN medical_records m ON a.id = m.appointment_id
            WHERE a.id = ?
            LIMIT 1
        `, [appointmentId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy lịch khám.' });
        }

        return res.status(200).json({ appointment: rows[0] });
    } catch (error) {
        console.error('Lỗi getBillingAppointmentDetail:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

// API: Lấy danh sách appointments đã đặt theo doctor_id và date
const getBookedSlots = async (req, res) => {
    try {
        const { doctor_id, appointment_date } = req.query;

        if (!doctor_id || !appointment_date) {
            return res.status(400).json({ message: "Vui lòng cung cấp doctor_id và appointment_date!" });
        }

        // Verify doctor exists
        const [doctorInfo] = await db.execute('SELECT id FROM doctors WHERE id = ?', [doctor_id]);
        if (doctorInfo.length === 0) {
            return res.status(404).json({ message: "Bác sĩ không tồn tại!" });
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

// API: Lễ tân lấy danh sách tất cả bệnh nhân hôm nay
const getTodayAppointments = async (req, res) => {
    try {
        const [appointments] = await db.execute(`
            SELECT a.id, a.appointment_time, a.status, a.appointment_date, 
                   u.username AS patient_name, u.phone AS patient_phone,
                   d.full_name AS doctor_name
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_date = CURDATE()
            ORDER BY a.appointment_time ASC
        `);

        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Lỗi lấy danh sách bệnh nhân hôm nay:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

const getDoctorAppointmentDetail = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const [doctorRows] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: 'Bác sĩ chưa có hồ sơ thông tin!' });
        }
        const doctorId = doctorRows[0].id;
        const [rows] = await db.execute(
            `SELECT a.*, u.username AS patient_name, u.phone AS patient_phone
             FROM appointments a
             JOIN patients pt ON a.patient_id = pt.id
             JOIN users u ON pt.user_id = u.id
             WHERE a.id = ? AND a.doctor_id = ?`,
            [id, doctorId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy lịch khám.' });
        }
        res.status(200).json({ appointment: rows[0] });
    } catch (error) {
        console.error('Lỗi getDoctorAppointmentDetail:', error);
        res.status(500).json({ message: 'Lỗi server!' });
    }
};

// API: Patient xem tất cả lịch khám của mình
const getPatientAppointments = async (req, res) => {
    try {
        const userId = req.user.id;

        // Lấy patient_id từ user_id
        const [patients] = await db.execute(
            'SELECT id FROM patients WHERE user_id = ?',
            [userId]
        );

        if (patients.length === 0) {
            return res.status(404).json({ message: "Bệnh nhân không tìm thấy!" });
        }

        const patientId = patients[0].id;

        // Lấy tất cả lịch khám (chưa bị hủy) sắp xếp theo ngày gần nhất
        const [appointments] = await db.execute(`
            SELECT 
                a.id,
                a.appointment_date,
                a.appointment_time,
                a.status,
                a.payment_status,
                d.full_name AS doctor_name,
                d.specialty,
                u.phone AS doctor_phone
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE a.patient_id = ? AND a.status != 'cancelled'
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [patientId]);

        res.status(200).json({ appointments });
    } catch (error) {
        console.error("Lỗi lấy lịch khám bệnh nhân:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// API: Patient hủy lịch khám (chỉ được hủy trước 1 ngày)
const cancelPatientAppointment = async (req, res) => {
    try {
        const userId = req.user.id;
        const { appointmentId } = req.params;

        // Lấy patient_id từ user_id
        const [patients] = await db.execute(
            'SELECT id FROM patients WHERE user_id = ?',
            [userId]
        );

        if (patients.length === 0) {
            return res.status(404).json({ message: "Bệnh nhân không tìm thấy!" });
        }

        const patientId = patients[0].id;

        // Lấy thông tin lịch khám
        const [appointments] = await db.execute(
            'SELECT * FROM appointments WHERE id = ? AND patient_id = ?',
            [appointmentId, patientId]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ message: "Lịch khám không tìm thấy!" });
        }

        const appointment = appointments[0];

        // Kiểm tra lịch khám đã được hủy chưa
        if (appointment.status === 'cancelled') {
            return res.status(400).json({ message: "Lịch khám này đã bị hủy rồi!" });
        }

        // Kiểm tra xem đã khám rồi hay chưa (không được hủy nếu đã checked-in hoặc completed)
        if (appointment.status === 'checked-in' || appointment.status === 'completed') {
            return res.status(400).json({ message: "Không thể hủy lịch khám đã khám xong!" });
        }

        // Kiểm tra thời gian: chỉ hủy được trước 1 ngày (24 giờ)
        const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
        const currentDateTime = new Date();
        const timeUntilAppointment = appointmentDateTime.getTime() - currentDateTime.getTime();
        const hoursUntilAppointment = timeUntilAppointment / (1000 * 60 * 60);

        if (hoursUntilAppointment < 24) {
            return res.status(400).json({ 
                message: `Không thể hủy lịch khám. Bạn cần hủy trước ít nhất 1 ngày (${hoursUntilAppointment.toFixed(1)} giờ còn lại)` 
            });
        }

        // Cập nhật status thành 'cancelled'
        await db.execute(
            'UPDATE appointments SET status = ? WHERE id = ?',
            ['cancelled', appointmentId]
        );

        res.status(200).json({ message: "Hủy lịch khám thành công!" });
    } catch (error) {
        console.error("Lỗi hủy lịch khám:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = {
    bookAppointment,
    searchByPhone,
    checkInAppointment,
    getDoctors,
    getDoctorAppointments,
    getDoctorAppointmentDetail,
    getUnpaidAppointments,
    getBillingAppointmentDetail,
    getBookedSlots,
    getTodayAppointments,
    getSpecialties,
    getPatientAppointments,
    cancelPatientAppointment
};