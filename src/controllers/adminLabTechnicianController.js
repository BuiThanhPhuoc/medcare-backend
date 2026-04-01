const db = require('../config/db');
const bcrypt = require('bcrypt');

const adminLabTechnicianController = {
    getAllLabTechnicians: async (req, res) => {
        try {
            const [rows] = await db.execute(`
                SELECT
                    lt.id,
                    lt.full_name,
                    lt.phone,
                    lt.department,
                    lt.address,
                    lt.hire_date,
                    lt.status,
                    lt.notes,
                    lt.avatar_url,
                    u.username,
                    u.email
                FROM lab_technicians lt
                INNER JOIN users u ON lt.user_id = u.id
                WHERE u.role = 'lab_technician'
                ORDER BY lt.id DESC
            `);
            res.status(200).json({ success: true, labTechnicians: rows });
        } catch (error) {
            console.error('getAllLabTechnicians:', error);
            res.status(500).json({ success: false, message: 'Server error', error: error.message });
        }
    },

    getLabTechnicianById: async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await db.execute(
                `
                SELECT lt.*, u.username, u.email
                FROM lab_technicians lt
                JOIN users u ON lt.user_id = u.id
                WHERE lt.id = ?
            `,
                [id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy kỹ thuật viên!' });
            res.status(200).json({ labTechnician: rows[0] });
        } catch (error) {
            res.status(500).json({ message: 'Server error', error: error.message });
        }
    },

    createLabTechnician: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const {
                username,
                password,
                email,
                phone,
                full_name,
                department,
                address,
                hire_date,
                status,
                notes
            } = req.body;

            const [existingUser] = await connection.execute(
                'SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?',
                [username, email, phone]
            );
            if (existingUser.length > 0) {
                await connection.rollback();
                return res.status(400).json({ message: 'Username, Email hoặc Phone đã tồn tại!' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, email, phone, role) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, email, phone, 'lab_technician']
            );
            const userId = userResult.insertId;
            const avatar_url = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : null;

            await connection.execute(
                `INSERT INTO lab_technicians
                (user_id, full_name, phone, department, address, hire_date, status, notes, avatar_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    full_name,
                    phone,
                    department || null,
                    address || null,
                    hire_date || null,
                    status || 'Active',
                    notes || null,
                    avatar_url
                ]
            );

            await connection.commit();
            res.status(201).json({ message: 'Tạo kỹ thuật viên thành công!' });
        } catch (error) {
            await connection.rollback();
            console.error('createLabTechnician:', error);
            res.status(500).json({ message: 'Lỗi tạo kỹ thuật viên', error: error.message });
        } finally {
            connection.release();
        }
    },

    updateLabTechnician: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;
            const { email, phone, full_name, department, address, hire_date, status, notes } = req.body;

            const [rows] = await connection.execute(
                'SELECT user_id, avatar_url FROM lab_technicians WHERE id = ?',
                [id]
            );
            if (rows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Không tìm thấy kỹ thuật viên!' });
            }

            const userId = rows[0].user_id;
            const avatar_url = req.file
                ? `http://localhost:5000/uploads/${req.file.filename}`
                : rows[0].avatar_url;

            await connection.execute('UPDATE users SET email = ?, phone = ? WHERE id = ?', [
                email,
                phone,
                userId
            ]);

            await connection.execute(
                `UPDATE lab_technicians SET
                full_name = ?, phone = ?, department = ?, address = ?, hire_date = ?,
                status = ?, notes = ?, avatar_url = ?
                WHERE id = ?`,
                [
                    full_name,
                    phone,
                    department || null,
                    address || null,
                    hire_date || null,
                    status,
                    notes || null,
                    avatar_url,
                    id
                ]
            );

            await connection.commit();
            res.status(200).json({ message: 'Cập nhật thành công!' });
        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: 'Lỗi cập nhật', error: error.message });
        } finally {
            connection.release();
        }
    },

    deleteLabTechnician: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;

            const [rows] = await connection.execute('SELECT user_id FROM lab_technicians WHERE id = ?', [id]);
            if (rows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: 'Không tìm thấy kỹ thuật viên!' });
            }

            await connection.execute('DELETE FROM users WHERE id = ?', [rows[0].user_id]);

            await connection.commit();
            res.status(200).json({ message: 'Đã xóa!' });
        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: 'Lỗi xóa', error: error.message });
        } finally {
            connection.release();
        }
    }
};

module.exports = adminLabTechnicianController;
