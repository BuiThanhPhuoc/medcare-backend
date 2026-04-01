const db = require('../config/db');

/**
 * Reception Schedule Controller
 * Quản lý lịch làm việc của Lễ tân (được gán bởi Admin)
 */
const receptionScheduleController = {
    /**
     * [ADMIN] Lấy danh sách Lễ tân
     * GET /api/admin/receptionists
     */
    getAllReceptionists: async (req, res) => {
        try {
            console.log('🔍 Fetching receptionists...');
            
            const [receptionists] = await db.execute(`
                SELECT u.id, u.username, u.email, u.phone, 
                       r.id as receptionist_id, r.full_name, r.address, r.hire_date, r.avatar, u.status
                FROM users u
                JOIN receptionists r ON u.id = r.user_id
                WHERE u.role = 'receptionist'
                ORDER BY r.id ASC
            `);
            
            console.log(`✅ Found ${receptionists.length} receptionists`);
            res.json({ receptionists });
        } catch (error) {
            console.error('❌ Lỗi lấy danh sách lễ tân:');
            console.error('  Message:', error.message);
            console.error('  Code:', error.code);
            console.error('  Stack:', error.stack);
            res.status(500).json({ 
                message: 'Lỗi server khi lấy danh sách lễ tân',
                error: error.message
            });
        }
    },

    /**
     * [ADMIN] Lấy lịch của 1 Lễ tân
     * GET /api/admin/receptionists/:receptionistId/schedule
     */
    getReceptionistSchedule: async (req, res) => {
        try {
            const { receptionistId } = req.params;

            // Validate parameter
            if (!receptionistId) {
                return res.status(400).json({ message: 'ID lễ tân không hợp lệ' });
            }

            const [schedules] = await db.execute(
                `SELECT id, work_date, shift, status
                 FROM reception_schedules
                 WHERE receptionist_id = ?
                 ORDER BY work_date ASC`,
                [parseInt(receptionistId)]
            );

            res.json({ schedules });
        } catch (error) {
            console.error('Lỗi lấy lịch lễ tân:', error);
            res.status(500).json({ message: 'Lỗi server' });
        }
    },

    /**
     * [ADMIN] Gán lịch cho Lễ tân (có thể add/update/delete hàng loạt)
     * POST /api/admin/receptionists/:receptionistId/schedule
     * Body: { schedules: [{ work_date, shift }, ...] }
     */
    assignReceptionistSchedule: async (req, res) => {
        let connection;
        try {
            connection = await db.getConnection();
            await connection.beginTransaction();
            
            const { receptionistId } = req.params;
            const { schedules } = req.body;

            // Validate parameter
            if (!receptionistId) {
                await connection.rollback();
                return res.status(400).json({ message: 'ID lễ tân không hợp lệ' });
            }

            const receptionist_id = parseInt(receptionistId);

            if (!Array.isArray(schedules) || schedules.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Danh sách lịch không hợp lệ' });
            }

            // Kiểm tra lễ tân tồn tại
            const [receptionists] = await connection.execute(
                `SELECT id FROM receptionists WHERE id = ?`,
                [receptionist_id]
            );

            if (receptionists.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Không tìm thấy Lễ tân này' });
            }

            // Xóa lịch cũ
            await connection.execute(
                `DELETE FROM reception_schedules WHERE receptionist_id = ?`,
                [receptionist_id]
            );

            // Thêm lịch mới
            for (let schedule of schedules) {
                const { work_date, shift } = schedule;
                if (!work_date || !shift) continue;

                await connection.execute(
                    `INSERT INTO reception_schedules (receptionist_id, work_date, shift, status)
                     VALUES (?, ?, ?, ?)`,
                    [receptionist_id, work_date, shift, 'active']
                );
            }

            await connection.commit();
            res.json({ message: 'Cập nhật lịch thành công!' });
        } catch (error) {
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('Lỗi rollback:', rollbackError);
                }
            }
            console.error('Lỗi gán lịch:', error);
            res.status(500).json({ message: 'Lỗi server khi gán lịch', error: error.message });
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },

    /**
     * [RECEPTIONIST] Lấy lịch làm việc của chính mình
     * GET /api/reception/my-schedule
     */
    getMySchedule: async (req, res) => {
        try {
            const userId = req.user?.id; // Từ token (JWT middleware)
            if (!userId) {
                return res.status(401).json({ message: 'Chưa xác thực' });
            }

            // Lấy receptionist_id từ user_id
            const [receptionistRows] = await db.execute(
                `SELECT id FROM receptionists WHERE user_id = ?`,
                [userId]
            );

            if (receptionistRows.length === 0) {
                return res.json({ schedules: [] });
            }

            const receptionistId = receptionistRows[0].id;

            // Lấy lịch từ hôm nay trở đi
            const [schedules] = await db.execute(
                `SELECT id, work_date, shift, status
                 FROM reception_schedules
                 WHERE receptionist_id = ? AND work_date >= CURDATE() AND status = 'active'
                 ORDER BY work_date ASC`,
                [receptionistId]
            );

            res.json({ schedules });
        } catch (error) {
            console.error('Lỗi lấy lịch của tôi:', error);
            res.status(500).json({ message: 'Lỗi server' });
        }
    },

    /**
     * [ADMIN] Lấy chi tiết 1 lễ tân
     * GET /api/admin/receptionists/:id
     */
    getReceptionistById: async (req, res) => {
        try {
            const { id } = req.params;
            const [receptionists] = await db.execute(`
                SELECT u.id, u.username, u.email, u.phone, u.status,
                       r.full_name, r.address, r.hire_date, r.avatar
                FROM users u
                JOIN receptionists r ON u.id = r.user_id
                WHERE u.role = 'receptionist' AND u.id = ?
            `, [id]);

            if (receptionists.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy lễ tân này!" });
            }

            res.json({ receptionist: receptionists[0] });
        } catch (error) {
            console.error('Lỗi lấy chi tiết lễ tân:', error);
            res.status(500).json({ message: 'Lỗi server' });
        }
    },

    /**
     * [ADMIN] Tạo lễ tân mới
     * POST /api/admin/receptionists
     */
    createReceptionist: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const bcrypt = require('bcrypt');
            const { username, password, email, phone, full_name, address, hire_date } = req.body;

            // Validation
            if (!username || !password || !email || !phone || !full_name) {
                await connection.rollback();
                return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc (username, password, email, phone, full_name)!" });
            }

            // Kiểm tra trùng lặp
            const [existing] = await connection.execute(
                'SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?',
                [username, email, phone]
            );
            if (existing.length > 0) {
                await connection.rollback();
                return res.status(400).json({ message: "Username, Email hoặc Phone đã tồn tại!" });
            }

            // Mã hóa mật khẩu
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Tạo user với role='receptionist'
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, email, phone, role) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, email, phone, 'receptionist']
            );

            const userId = userResult.insertId;

            // Tạo receptionist record (kèm full_name, address, hire_date, avatar)
            await connection.execute(
                'INSERT INTO receptionists (user_id, full_name, address, hire_date, avatar) VALUES (?, ?, ?, ?, ?)',
                [userId, full_name, address || null, hire_date || null, null]
            );

            await connection.commit();
            res.status(201).json({ message: "Thêm lễ tân thành công!" });
        } catch (error) {
            await connection.rollback();
            console.error('Lỗi tạo lễ tân:', error);
            res.status(500).json({ message: 'Lỗi server khi tạo lễ tân' });
        } finally {
            connection.release();
        }
    },

    /**
     * [ADMIN] Cập nhật lễ tân
     * PUT /api/admin/receptionists/:id
     */
    updateReceptionist: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;
            const { email, phone, full_name, address, hire_date } = req.body;
            
            // Xử lý avatar upload
            let avatarUrl = null;
            if (req.file) {
                avatarUrl = `http://localhost:5000/uploads/${req.file.filename}`;
            }

            // Cập nhật users table
            await connection.execute(
                'UPDATE users SET email = ?, phone = ? WHERE id = ? AND role = "receptionist"',
                [email, phone, id]
            );

            // Cập nhật receptionists table
            if (avatarUrl) {
                await connection.execute(
                    'UPDATE receptionists SET full_name = ?, address = ?, hire_date = ?, avatar = ? WHERE user_id = ?',
                    [full_name, address || null, hire_date || null, avatarUrl, id]
                );
            } else {
                await connection.execute(
                    'UPDATE receptionists SET full_name = ?, address = ?, hire_date = ? WHERE user_id = ?',
                    [full_name, address || null, hire_date || null, id]
                );
            }

            await connection.commit();
            res.json({ message: "Cập nhật lễ tân thành công!" });
        } catch (error) {
            await connection.rollback();
            console.error('Lỗi cập nhật lọ tân:', error);
            res.status(500).json({ message: 'Lỗi server' });
        } finally {
            connection.release();
        }
    },

    /**
     * [ADMIN] Xóa lễ tân
     * DELETE /api/admin/receptionists/:id
     */
    deleteReceptionist: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;

            // Xóa receptionist record
            await connection.execute(
                'DELETE FROM receptionists WHERE user_id = ?',
                [id]
            );

            // Xóa user
            await connection.execute(
                'DELETE FROM users WHERE id = ? AND role = "receptionist"',
                [id]
            );

            await connection.commit();
            res.json({ message: "Xóa lễ tân thành công!" });
        } catch (error) {
            await connection.rollback();
            console.error('Lỗi xóa lệ tân:', error);
            res.status(500).json({ message: 'Lỗi server' });
        } finally {
            connection.release();
        }
    }
};

module.exports = receptionScheduleController;
