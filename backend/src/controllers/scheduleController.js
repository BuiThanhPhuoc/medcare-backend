const db = require('../config/db');

const scheduleController = {
    // 1. [BÁC SĨ] Đăng ký lịch làm việc (Hàm cũ giữ nguyên)
    registerSchedule: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { doctor_id, start_date, weeks, schedule_pattern } = req.body;

            const [doctorRows] = await connection.execute(`SELECT id FROM doctors WHERE user_id = ?`, [doctor_id]);
            if (doctorRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: "Tài khoản này chưa được liên kết với hồ sơ Bác sĩ nào!" });
            }

            const realDoctorId = doctorRows[0].id; 
            const startDateObj = new Date(start_date);

            for (let w = 0; w < weeks; w++) {
                for (let dayOfWeek = 1; dayOfWeek <= 6; dayOfWeek++) {
                    const shifts = schedule_pattern[dayOfWeek]; 
                    if (shifts && shifts.length > 0) {
                        const currentDate = new Date(startDateObj);
                        currentDate.setDate(startDateObj.getDate() + (w * 7) + (dayOfWeek - 1));
                        const formattedDate = currentDate.toISOString().split('T')[0];

                        for (let shift of shifts) {
                            const [exist] = await connection.execute(
                                `SELECT id FROM doctor_schedules WHERE doctor_id = ? AND work_date = ? AND shift = ?`,
                                [realDoctorId, formattedDate, shift]
                            );
                            if (exist.length === 0) {
                                await connection.execute(
                                    `INSERT INTO doctor_schedules (doctor_id, work_date, shift, status) VALUES (?, ?, ?, 'pending')`,
                                    [realDoctorId, formattedDate, shift]
                                );
                            }
                        }
                    }
                }
            }
            await connection.commit();
            res.status(201).json({ message: "Đăng ký lịch thành công! Vui lòng chờ Admin duyệt." });
        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: "Lỗi server khi đăng ký lịch" });
        } finally {
            connection.release();
        }
    },

    // 2. [ADMIN] Lấy danh sách lịch đang CHỜ DUYỆT (pending)
    getPendingSchedules: async (req, res) => {
        try {
            const [schedules] = await db.execute(`
                SELECT ds.id, ds.work_date, ds.shift, ds.status, d.full_name as doctor_name 
                FROM doctor_schedules ds
                JOIN doctors d ON ds.doctor_id = d.id
                WHERE ds.status = 'pending'
                ORDER BY ds.work_date ASC, d.id ASC
            `);
            res.json({ schedules });
        } catch (error) {
            res.status(500).json({ message: "Lỗi lấy danh sách duyệt lịch" });
        }
    },

    // 3. [ADMIN] Duyệt/Từ chối lịch hàng loạt (Cực kỳ tiện lợi cho Admin)
    updateScheduleStatusBulk: async (req, res) => {
        try {
            const { ids, status } = req.body; // status: 'approved' hoặc 'rejected'
            if (!ids || ids.length === 0) return res.status(400).json({ message: "Chưa chọn lịch nào!" });

            // Tạo chuỗi dấu chấm hỏi (?,?,?) dựa trên số lượng ID
            const placeholders = ids.map(() => '?').join(',');
            await db.execute(`UPDATE doctor_schedules SET status = ? WHERE id IN (${placeholders})`, [status, ...ids]);
            
            res.json({ message: `Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} lịch thành công!` });
        } catch (error) {
            res.status(500).json({ message: "Lỗi cập nhật trạng thái lịch" });
        }
    },

    // 4. [BÁC SĨ] Lấy danh sách lịch đã được duyệt của chính mình
    getMyApprovedSchedules: async (req, res) => {
        try {
            const userId = req.params.userId;
            
            // Dịch từ user_id sang doctor_id
            const [doctorRows] = await db.execute(`SELECT id FROM doctors WHERE user_id = ?`, [userId]);
            if (doctorRows.length === 0) return res.json({ schedules: [] });
            
            const realDoctorId = doctorRows[0].id;

            // Chỉ lấy những lịch có status = 'approved' và từ ngày hôm nay trở đi
            const [schedules] = await db.execute(`
                SELECT id, work_date, shift, status 
                FROM doctor_schedules 
                WHERE doctor_id = ? AND status = 'approved' AND work_date >= CURDATE()
                ORDER BY work_date ASC
            `, [realDoctorId]);

            res.json({ schedules });
        } catch (error) {
            res.status(500).json({ message: "Lỗi lấy lịch bác sĩ" });
        }
    }
};

module.exports = scheduleController;