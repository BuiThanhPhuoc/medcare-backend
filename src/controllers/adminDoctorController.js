const db = require('../config/db');
const bcrypt = require('bcrypt');

const adminDoctorController = {
    getAllDoctors: async (req, res) => {
        try {
            // Lấy thêm username và email từ bảng users
            const [doctors] = await db.execute(`
                SELECT d.*, u.username, u.email 
                FROM doctors d 
                JOIN users u ON d.user_id = u.id 
                ORDER BY d.id DESC
            `);
            res.status(200).json({ doctors });
        } catch (error) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    getDoctorById: async (req, res) => {
        try {
            const { id } = req.params;
            const [doctors] = await db.execute(`
                SELECT d.*, u.username, u.email 
                FROM doctors d 
                JOIN users u ON d.user_id = u.id 
                WHERE d.id = ?
            `, [id]);

            if (doctors.length === 0) return res.status(404).json({ message: "Doctor not found!" });
            res.status(200).json({ doctor: doctors[0] });
        } catch (error) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    },

    createDoctor: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Toàn bộ key đã chuyển sang tiếng Anh
            const { username, password, email, full_name, phone, specialty, experience, status, address, description } = req.body;
            
            const [existingUser] = await connection.execute(
                'SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?', 
                [username, email, phone]
            );
            
            if (existingUser.length > 0) {
                return res.status(400).json({ message: "Username, Email or Phone already exists!" });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Insert Users
            const [userResult] = await connection.execute(
                'INSERT INTO users (username, password, email, phone, role) VALUES (?, ?, ?, ?, ?)',
                [username, hashedPassword, email, phone, 'doctor']
            );
            
            const userId = userResult.insertId;
            const avatar_url = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : null;

            // Insert Doctors
            await connection.execute(
                `INSERT INTO doctors 
                (user_id, full_name, phone, specialty, experience, status, address, description, avatar_url) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, full_name, phone, specialty, experience || 0, status || 'Active', address, description, avatar_url]
            );

            await connection.commit();
            res.status(201).json({ message: "Doctor created successfully!" });

        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: "Error creating doctor", error: error.message });
        } finally {
            connection.release();
        }
    },

    updateDoctor: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;
            const { email, full_name, phone, specialty, experience, status, address, description } = req.body;

            const [docs] = await connection.execute('SELECT user_id, avatar_url FROM doctors WHERE id = ?', [id]);
            if (docs.length === 0) return res.status(404).json({ message: "Doctor not found!" });
            
            const userId = docs[0].user_id;
            const avatar_url = req.file ? `http://localhost:5000/uploads/${req.file.filename}` : docs[0].avatar_url;

            // Đồng bộ qua bảng users
            await connection.execute('UPDATE users SET email = ?, phone = ? WHERE id = ?', [email, phone, userId]);

            // Cập nhật bảng doctors
            await connection.execute(
                `UPDATE doctors SET 
                full_name = ?, phone = ?, specialty = ?, experience = ?, 
                status = ?, address = ?, description = ?, avatar_url = ? 
                WHERE id = ?`,
                [full_name, phone, specialty, experience || 0, status, address, description, avatar_url, id]
            );

            await connection.commit();
            res.status(200).json({ message: "Updated successfully!" });

        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: "Error updating doctor", error: error.message });
        } finally {
            connection.release();
        }
    },

    deleteDoctor: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { id } = req.params;

            const [docs] = await connection.execute('SELECT user_id FROM doctors WHERE id = ?', [id]);
            if (docs.length === 0) return res.status(404).json({ message: "Doctor not found!" });

            await connection.execute('DELETE FROM users WHERE id = ?', [docs[0].user_id]);

            await connection.commit();
            res.status(200).json({ message: "Deleted successfully!" });
        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: "Error deleting doctor", error: error.message });
        } finally {
            connection.release();
        }
    }
};

module.exports = adminDoctorController;