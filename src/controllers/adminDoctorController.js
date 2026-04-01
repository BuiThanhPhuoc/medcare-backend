const db = require('../config/db');
const bcrypt = require('bcrypt');
const { calculatePagination, createPaginatedResponse } = require('../utils/paginationUtils');

const adminDoctorController = {
    getAllDoctors: async (req, res) => {
        try {
            const pagination = calculatePagination(req.query.page, req.query.limit);
            const { search, specialty, status } = req.query;

            // Prefer compatibility view if present
            const getEffectiveTable = async (viewName, tableName) => {
                try {
                    const [[{ cnt }]] = await db.query(
                        'SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
                        [process.env.DB_NAME, viewName]
                    );
                    return cnt > 0 ? viewName : tableName;
                } catch (e) {
                    return tableName;
                }
            };

            const doctorsSource = await getEffectiveTable('doctors_compat', 'doctors');
            const usingCompat = doctorsSource === 'doctors_compat';

            // Build WHERE clause
            let whereClause = 'WHERE 1=1';
            let params = [];

            if (search) {
                if (usingCompat) {
                    whereClause += ' AND (d.full_name LIKE ? OR d.specialty_name LIKE ? OR u.username LIKE ?)';
                    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
                } else {
                    whereClause += ' AND (d.full_name LIKE ? OR d.specialty LIKE ? OR u.username LIKE ?)';
                    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
                }
            }

            if (specialty) {
                if (usingCompat) {
                    whereClause += ' AND d.specialty_name = ?';
                    params.push(specialty);
                } else {
                    whereClause += ' AND d.specialty = ?';
                    params.push(specialty);
                }
            }

            if (status) {
                if (usingCompat) {
                    const statusValue = status === 'Active' ? 1 : 0;
                    whereClause += ' AND d.is_available = ?';
                    params.push(statusValue);
                } else {
                    whereClause += ' AND d.status = ?';
                    params.push(status);
                }
            }

            // Get total count (join with users table)
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM ${doctorsSource} d 
                INNER JOIN users u ON d.user_id = u.id 
                ${whereClause}
            `;
            const [[{ total }]] = await db.query(countQuery, params);

            // Get paginated data
            let dataQuery;
            if (usingCompat) {
                dataQuery = `
                    SELECT 
                        d.doctor_id as id,
                        d.full_name,
                        d.phone,
                        d.experience_years as experience,
                        d.avatar_url,
                        CASE WHEN d.is_available = 1 THEN 'Active' ELSE 'Inactive' END as status,
                        d.specialty_name as specialty,
                        u.username,
                        u.email
                    FROM ${doctorsSource} d 
                    INNER JOIN users u ON d.user_id = u.id 
                    ${whereClause}
                    ORDER BY d.doctor_id DESC
                    LIMIT ? OFFSET ?
                `;
            } else {
                dataQuery = `
                    SELECT 
                        d.id as id,
                        d.full_name,
                        d.phone,
                        d.experience,
                        d.avatar_url,
                        d.status,
                        d.specialty as specialty,
                        u.username,
                        u.email
                    FROM ${doctorsSource} d 
                    INNER JOIN users u ON d.user_id = u.id 
                    ${whereClause}
                    ORDER BY d.id DESC
                    LIMIT ? OFFSET ?
                `;
            }

            const [doctors] = await db.query(dataQuery, [...params, pagination.limit, pagination.offset]);

            // Return shape expected by frontend: { success, doctors, pagination }
            res.status(200).json({
                success: true,
                doctors,
                pagination: {
                    page: pagination.page,
                    limit: pagination.limit,
                    total,
                    hasNextPage: pagination.page * pagination.limit < total,
                    hasPrevPage: pagination.page > 1
                }
            });
        } catch (error) {
            console.error('❌ Error in getAllDoctors:', error);
            res.status(500).json({ success: false, message: "Server error", error: error.message });
        }
    },

    getDoctorById: async (req, res) => {
        try {
            const { id } = req.params;

            // determine whether compatibility view exists
            const [[{ cnt }]] = await db.query(
                'SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
                [process.env.DB_NAME, 'doctors_compat']
            );
            const usingCompat = cnt > 0;

            if (usingCompat) {
                const [doctors] = await db.execute(`
                    SELECT d.*, u.username, u.email
                    FROM doctors_compat d
                    JOIN users u ON d.user_id = u.id
                    WHERE d.doctor_id = ?
                `, [id]);

                if (doctors.length === 0) return res.status(404).json({ message: "Doctor not found!" });
                return res.status(200).json({ doctor: doctors[0] });
            } else {
                const [doctors] = await db.execute(`
                    SELECT d.*, u.username, u.email 
                    FROM doctors d 
                    JOIN users u ON d.user_id = u.id 
                    WHERE d.id = ?
                `, [id]);

                if (doctors.length === 0) return res.status(404).json({ message: "Doctor not found!" });
                return res.status(200).json({ doctor: doctors[0] });
            }
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