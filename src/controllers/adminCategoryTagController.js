const db = require('../config/db');

const adminCategoryTagController = {
    // API lấy danh sách Danh mục
    getAllCategories: async (req, res) => {
        try {
            const [categories] = await db.execute('SELECT * FROM categories ORDER BY name ASC');
            res.status(200).json({ categories });
        } catch (error) {
            res.status(500).json({ message: "Lỗi lấy danh mục", error: error.message });
        }
    },

    // API lấy danh sách Thẻ
    getAllTags: async (req, res) => {
        try {
            const [tags] = await db.execute('SELECT * FROM tags ORDER BY name ASC');
            res.status(200).json({ tags });
        } catch (error) {
            res.status(500).json({ message: "Lỗi lấy thẻ", error: error.message });
        }
    }
};

module.exports = adminCategoryTagController;