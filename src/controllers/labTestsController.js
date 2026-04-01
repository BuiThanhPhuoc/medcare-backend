const db = require('../config/db');

/**
 * LAB TESTS CONTROLLER
 * Admin: CRUD loại xét nghiệm + giá
 */

// 1️⃣ Lấy danh sách tất cả xét nghiệm (kèm category info)
const getAllLabTests = async (req, res) => {
    try {
        const categoryId = req.query.category_id || null;
        const isActive = req.query.is_active !== undefined ? (req.query.is_active === 'true' ? 1 : 0) : null;

        let sql = `
            SELECT lt.*, ltc.name as category_name 
            FROM lab_tests lt
            LEFT JOIN lab_test_categories ltc ON lt.lab_test_category_id = ltc.id
            WHERE 1=1
        `;
        const params = [];

        if (categoryId) {
            sql += ' AND lt.lab_test_category_id = ?';
            params.push(categoryId);
        }

        if (isActive !== null) {
            sql += ' AND lt.is_active = ?';
            params.push(isActive);
        }

        sql += ' ORDER BY ltc.name, lt.name ASC';

        const [tests] = await db.execute(sql, params);
        res.status(200).json({ tests });
    } catch (error) {
        console.error('Lỗi lấy danh sách xét nghiệm:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 2️⃣ Lấy 1 xét nghiệm chi tiết
const getLabTest = async (req, res) => {
    try {
        const { id } = req.params;
        const [tests] = await db.execute(
            `SELECT lt.*, ltc.name as category_name 
            FROM lab_tests lt
            LEFT JOIN lab_test_categories ltc ON lt.lab_test_category_id = ltc.id
            WHERE lt.id = ?`,
            [id]
        );

        if (tests.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy xét nghiệm này" });
        }

        res.status(200).json(tests[0]);
    } catch (error) {
        console.error('Lỗi lấy xét nghiệm:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 3️⃣ Tạo xét nghiệm mới
const createLabTest = async (req, res) => {
    try {
        const { name, code, lab_test_category_id, price, description, normal_range_min, normal_range_max, unit } = req.body;

        // Validate
        if (!name || !code || !lab_test_category_id || !price) {
            return res.status(400).json({ message: "Vui lòng cung cấp tên, mã xét nghiệm, danh mục và giá" });
        }

        // Check category exists
        const [category] = await db.execute(
            'SELECT id FROM lab_test_categories WHERE id = ?',
            [lab_test_category_id]
        );
        if (category.length === 0) {
            return res.status(400).json({ message: "Danh mục xét nghiệm không tồn tại" });
        }

        // Check code unique
        const [existing] = await db.execute(
            'SELECT id FROM lab_tests WHERE code = ?',
            [code]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: `Mã xét nghiệm "${code}" đã tồn tại` });
        }

        await db.execute(
            `INSERT INTO lab_tests (name, code, lab_test_category_id, price, description, normal_range_min, normal_range_max, unit, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [name, code, lab_test_category_id, price, description || null, normal_range_min || null, normal_range_max || null, unit || null]
        );

        res.status(201).json({ message: "Đã thêm xét nghiệm thành công!" });
    } catch (error) {
        console.error('Lỗi tạo xét nghiệm:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 4️⃣ Cập nhật xét nghiệm
const updateLabTest = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, lab_test_category_id, price, description, normal_range_min, normal_range_max, unit, is_active } = req.body;

        // Check xét nghiệm tồn tại
        const [existing] = await db.execute(
            'SELECT id FROM lab_tests WHERE id = ?',
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy xét nghiệm này" });
        }

        // Check code unique (nếu thay đổi)
        if (code) {
            const [codeExists] = await db.execute(
                'SELECT id FROM lab_tests WHERE code = ? AND id != ?',
                [code, id]
            );
            if (codeExists.length > 0) {
                return res.status(400).json({ message: `Mã xét nghiệm "${code}" đã tồn tại` });
            }
        }

        // Check category exists (nếu thay đổi)
        if (lab_test_category_id) {
            const [categoryExists] = await db.execute(
                'SELECT id FROM lab_test_categories WHERE id = ?',
                [lab_test_category_id]
            );
            if (categoryExists.length === 0) {
                return res.status(400).json({ message: "Danh mục xét nghiệm không tồn tại" });
            }
        }

        // Build update query
        const updates = [];
        const params = [];
        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (code !== undefined) { updates.push('code = ?'); params.push(code); }
        if (lab_test_category_id !== undefined) { updates.push('lab_test_category_id = ?'); params.push(lab_test_category_id); }
        if (price !== undefined) { updates.push('price = ?'); params.push(price); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description || null); }
        if (normal_range_min !== undefined) { updates.push('normal_range_min = ?'); params.push(normal_range_min || null); }
        if (normal_range_max !== undefined) { updates.push('normal_range_max = ?'); params.push(normal_range_max || null); }
        if (unit !== undefined) { updates.push('unit = ?'); params.push(unit || null); }
        if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ message: "Không có dữ liệu để cập nhật" });
        }

        params.push(id);
        const sql = `UPDATE lab_tests SET ${updates.join(', ')} WHERE id = ?`;
        await db.execute(sql, params);

        res.status(200).json({ message: "Đã cập nhật xét nghiệm thành công!" });
    } catch (error) {
        console.error('Lỗi cập nhật xét nghiệm:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 5️⃣ Xóa xét nghiệm
const deleteLabTest = async (req, res) => {
    try {
        const { id } = req.params;

        // Check xét nghiệm tồn tại
        const [existing] = await db.execute(
            'SELECT id FROM lab_tests WHERE id = ?',
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy xét nghiệm này" });
        }

        // Check có test_orders sử dụng không
        const [orders] = await db.execute(
            'SELECT COUNT(*) as count FROM test_orders WHERE lab_test_id = ?',
            [id]
        );
        if (orders[0].count > 0) {
            // Soft delete: cập nhật is_active = 0 thay vì xóa
            await db.execute(
                'UPDATE lab_tests SET is_active = 0 WHERE id = ?',
                [id]
            );
            return res.status(200).json({ message: "Đã vô hiệu hóa xét nghiệm (không xóa vì có test orders)" });
        }

        // Hard delete nếu chưa được sử dụng
        await db.execute('DELETE FROM lab_tests WHERE id = ?', [id]);
        res.status(200).json({ message: "Đã xóa xét nghiệm thành công!" });
    } catch (error) {
        console.error('Lỗi xóa xét nghiệm:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = {
    getAllLabTests,
    getLabTest,
    createLabTest,
    updateLabTest,
    deleteLabTest
};
