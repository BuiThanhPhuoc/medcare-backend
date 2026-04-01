const db = require('../config/db');

/**
 * Reception Controller
 * Quản lý API cho Reception Dashboard
 */
const receptionController = {
    /**
     * Lấy thống kê của nhân viên lễ tân
     * GET /api/reception/stats
     */
    getStats: async (req, res) => {
        try {
            const userId = req.user.id; // From auth middleware

            // Lấy dữ liệu reception từ user_id
            const [receptionists] = await db.execute(
                `SELECT COUNT(*) as count FROM receptionists WHERE user_id = ?`,
                [userId]
            );

            // Nếu không phải receptionist
            if (receptionists[0].count === 0) {
                return res.status(403).json({ message: 'Bạn không phải nhân viên lễ tân' });
            }

            // Lấy lịch hôm nay
            const today = new Date().toISOString().split('T')[0];
            const [todaySchedules] = await db.execute(
                `SELECT COUNT(*) as count FROM reception_schedules 
                 WHERE receptionist_id = (
                     SELECT id FROM receptionists WHERE user_id = ?
                 ) AND work_date = ?`,
                [userId, today]
            );

            // Lấy lịch tuần này
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const [weeklySchedules] = await db.execute(
                `SELECT COUNT(*) as count FROM reception_schedules 
                 WHERE receptionist_id = (
                     SELECT id FROM receptionists WHERE user_id = ?
                 ) AND work_date BETWEEN ? AND ?`,
                [userId, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
            );

            // Tính tổng giờ trong tuần (assume 4 giờ mỗi ca, sáng + chiều = 8 giờ)
            const totalHours = weeklySchedules[0].count * 4; // 4 hours per shift

            res.json({
                stats: {
                    todayShifts: todaySchedules[0].count,
                    weeklyShifts: weeklySchedules[0].count,
                    status: 'Hoạt động',
                    totalHours: totalHours
                }
            });
        } catch (error) {
            console.error('Lỗi lấy stats:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    },

    /**
     * Lấy thông tin cá nhân của nhân viên lễ tân
     * GET /api/reception/personal-info
     */
    getPersonalInfo: async (req, res) => {
        try {
            const userId = req.user.id;

            const [users] = await db.execute(
                `SELECT u.id, u.username, u.email, u.phone, u.role, r.full_name, r.address
                 FROM users u
                 LEFT JOIN receptionists r ON u.id = r.user_id
                 WHERE u.id = ?`,
                [userId]
            );

            if (users.length === 0) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' });
            }

            const user = users[0];
            res.json({
                personalInfo: {
                    fullName: user.full_name || user.username,
                    position: user.role || 'Lễ Tân / Thu Ngân',
                    email: user.email,
                    phone: user.phone || 'N/A',
                    address: user.address || 'N/A'
                }
            });
        } catch (error) {
            console.error('Lỗi lấy thông tin cá nhân:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    },

    /**
     * Lấy lịch ca hôm nay
     * GET /api/reception/shifts/today
     */
    getTodayShifts: async (req, res) => {
        try {
            const userId = req.user.id;
            const today = new Date().toISOString().split('T')[0];

            const [schedules] = await db.execute(
                `SELECT rs.id, rs.work_date, rs.shift, rs.status
                 FROM reception_schedules rs
                 JOIN receptionists r ON rs.receptionist_id = r.id
                 WHERE r.user_id = ? AND rs.work_date = ?
                 ORDER BY rs.shift ASC`,
                [userId, today]
            );

            res.json({ shifts: schedules });
        } catch (error) {
            console.error('Lỗi lấy ca hôm nay:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    },

    /**
     * Lấy lịch làm việc tuần này
     * GET /api/reception/schedule/weekly
     */
    getWeeklySchedule: async (req, res) => {
        try {
            const userId = req.user.id;

            // Tính ngày đầu tuần (thứ 2)
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
            
            const weekStart = new Date(today.setDate(diff));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            const [schedules] = await db.execute(
                `SELECT rs.id, rs.work_date, rs.shift, rs.status
                 FROM reception_schedules rs
                 JOIN receptionists r ON rs.receptionist_id = r.id
                 WHERE r.user_id = ? AND rs.work_date BETWEEN ? AND ?
                 ORDER BY rs.work_date ASC, rs.shift ASC`,
                [userId, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
            );

            res.json({ schedule: schedules });
        } catch (error) {
            console.error('Lỗi lấy lịch tuần:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    },

    /**
     * Lấy lịch làm việc của nhân viên lễ tân (endpoint hiện tại)
     * GET /api/reception/my-schedule
     */
    getMySchedule: async (req, res) => {
        try {
            const userId = req.user.id;

            const [receptionists] = await db.execute(
                `SELECT id FROM receptionists WHERE user_id = ?`,
                [userId]
            );

            if (receptionists.length === 0) {
                return res.json({ schedules: [] });
            }

            const receptionistId = receptionists[0].id;

            const [schedules] = await db.execute(
                `SELECT id, work_date, shift, status
                 FROM reception_schedules
                 WHERE receptionist_id = ?
                 ORDER BY work_date ASC, shift ASC`,
                [receptionistId]
            );

            res.json({ schedules });
        } catch (error) {
            console.error('Lỗi lấy lịch của tôi:', error);
            res.status(500).json({ message: 'Lỗi server', error: error.message });
        }
    }
};

module.exports = receptionController;
