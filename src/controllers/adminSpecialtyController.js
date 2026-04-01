const db = require('../config/db');

const adminSpecialtyController = {
    // 1. Lấy danh sách chuyên khoa
    getAllSpecialties: async (req, res) => {
        try {
            const [specialties] = await db.execute(`
                SELECT c.*, COUNT(d.id) as doctors_count 
                FROM specialties c 
                LEFT JOIN doctors d ON c.name = d.specialty 
                GROUP BY c.id
                ORDER BY c.id DESC
            `);
            res.json({ success: true, specialties });
        } catch (error) { res.status(500).json({ message: "Server error", error: error.message }); }
    },

    // 2. Lấy chi tiết
    getSpecialtyById: async (req, res) => {
        try {
            const [specs] = await db.execute(`SELECT * FROM specialties WHERE id = ?`, [req.params.id]);
            if (specs.length === 0) return res.status(404).json({ message: "Specialty not found" });
            
            const specialty = specs[0];
            const [doctors] = await db.execute(`SELECT id FROM doctors WHERE specialty = ?`, [specialty.name]);
            const doctor_ids = doctors.map(doc => doc.id);

            res.json({ specialty, doctor_ids });
        } catch (error) { res.status(500).json({ message: "Server error" }); }
    },

    // 3. Thêm mới
    createSpecialty: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { name, slug, description, doctor_ids } = req.body;
            const autoSlug = slug || name.toLowerCase().replace(/ /g, '-');

            await connection.execute(
                `INSERT INTO specialties (name, slug, description) VALUES (?, ?, ?)`,
                [name, autoSlug, description]
            );

            if (doctor_ids && doctor_ids.length > 0) {
                const placeholders = doctor_ids.map(() => '?').join(',');
                await connection.execute(
                    `UPDATE doctors SET specialty = ? WHERE id IN (${placeholders})`,
                    [name, ...doctor_ids]
                );
            }

            await connection.commit();
            res.status(201).json({ message: "Specialty created successfully!" });
        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: "Error creating specialty" });
        } finally {
            connection.release();
        }
    },

    // 4. Cập nhật
    updateSpecialty: async (req, res) => {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { name, slug, description, doctor_ids } = req.body;
            const id = req.params.id;

            const [oldSpecs] = await connection.execute(`SELECT name FROM specialties WHERE id = ?`, [id]);
            const oldName = oldSpecs[0].name;

            await connection.execute(
                `UPDATE specialties SET name=?, slug=?, description=? WHERE id=?`,
                [name, slug, description, id]
            );

            await connection.execute(`UPDATE doctors SET specialty = NULL WHERE specialty = ?`, [oldName]);

            if (doctor_ids && doctor_ids.length > 0) {
                const placeholders = doctor_ids.map(() => '?').join(',');
                await connection.execute(
                    `UPDATE doctors SET specialty = ? WHERE id IN (${placeholders})`,
                    [name, ...doctor_ids]
                );
            }

            await connection.commit();
            res.json({ message: "Updated successfully!" });
        } catch (error) {
            await connection.rollback();
            res.status(500).json({ message: "Error updating specialty" });
        } finally {
            connection.release();
        }
    },

    // 5. Xóa
    deleteSpecialty: async (req, res) => {
        try {
            const [specs] = await db.execute(`SELECT name FROM specialties WHERE id = ?`, [req.params.id]);
            if (specs.length > 0) {
                await db.execute(`UPDATE doctors SET specialty = NULL WHERE specialty = ?`, [specs[0].name]);
                await db.execute(`DELETE FROM specialties WHERE id = ?`, [req.params.id]);
            }
            res.json({ message: "Deleted successfully!" });
        } catch (error) { res.status(500).json({ message: "Error deleting specialty" }); }
    }
};

module.exports = adminSpecialtyController;