const db = require('../config/db');

// GET all lab test categories
exports.getAllCategories = async (req, res) => {
  try {
    const [categories] = await db.execute('SELECT * FROM lab_test_categories WHERE is_active = 1 ORDER BY id ASC');
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Error fetching lab test categories:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh mục xét nghiệm',
      error: error.message
    });
  }
};

// GET single category with its tests
exports.getCategoryWithTests = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const [category] = await db.execute('SELECT * FROM lab_test_categories WHERE id = ?', [categoryId]);
    if (!category.length) {
      return res.status(404).json({
        success: false,
        message: 'Danh mục không tồn tại'
      });
    }

    const [tests] = await db.execute(
      'SELECT id, name, code, price, unit, normal_range_min, normal_range_max, description FROM lab_tests WHERE lab_test_category_id = ? AND is_active = 1 ORDER BY name ASC',
      [categoryId]
    );

    res.status(200).json({
      success: true,
      category: category[0],
      tests
    });
  } catch (error) {
    console.error('Error fetching category with tests:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh mục và xét nghiệm',
      error: error.message
    });
  }
};

// CREATE lab test category (Admin only)
exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục không được để trống'
      });
    }

    // Check if category already exists
    const [existingCategory] = await db.execute(
      'SELECT id FROM lab_test_categories WHERE name = ?',
      [name.trim()]
    );

    if (existingCategory.length) {
      return res.status(409).json({
        success: false,
        message: 'Danh mục này đã tồn tại'
      });
    }

    const [result] = await db.execute(
      'INSERT INTO lab_test_categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo danh mục thành công',
      categoryId: result.insertId
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo danh mục',
      error: error.message
    });
  }
};

// UPDATE lab test category (Admin only)
exports.updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Tên danh mục không được để trống'
      });
    }

    // Check if category exists
    const [category] = await db.execute('SELECT id FROM lab_test_categories WHERE id = ?', [categoryId]);
    if (!category.length) {
      return res.status(404).json({
        success: false,
        message: 'Danh mục không tồn tại'
      });
    }

    // Check if new name already exists (and it's not the same category)
    const [existingCategory] = await db.execute(
      'SELECT id FROM lab_test_categories WHERE name = ? AND id != ?',
      [name.trim(), categoryId]
    );

    if (existingCategory.length) {
      return res.status(409).json({
        success: false,
        message: 'Tên danh mục này đã được sử dụng'
      });
    }

    await db.execute(
      'UPDATE lab_test_categories SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description || null, categoryId]
    );

    res.status(200).json({
      success: true,
      message: 'Cập nhật danh mục thành công'
    });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật danh mục',
      error: error.message
    });
  }
};

// DELETE lab test category (Admin only)
// Soft delete - set is_active = 0 if tests exist, hard delete otherwise
exports.deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Check if category exists
    const [category] = await db.execute('SELECT id FROM lab_test_categories WHERE id = ?', [categoryId]);
    if (!category.length) {
      return res.status(404).json({
        success: false,
        message: 'Danh mục không tồn tại'
      });
    }

    // Check if category has any tests
    const [tests] = await db.execute('SELECT COUNT(*) as count FROM lab_tests WHERE lab_test_category_id = ?', [categoryId]);

    if (tests[0].count > 0) {
      // Soft delete - set is_active = 0
      await db.execute('UPDATE lab_test_categories SET is_active = 0 WHERE id = ?', [categoryId]);
      return res.status(200).json({
        success: true,
        message: 'Danh mục đã được vô hiệu hóa (vẫn có xét nghiệm sử dụng)'
      });
    } else {
      // Hard delete - no tests using this category
      await db.execute('DELETE FROM lab_test_categories WHERE id = ?', [categoryId]);
      res.status(200).json({
        success: true,
        message: 'Xóa danh mục thành công'
      });
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xóa danh mục',
      error: error.message
    });
  }
};
