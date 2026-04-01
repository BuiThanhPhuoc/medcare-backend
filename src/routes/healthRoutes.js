const express = require('express');
const router = express.Router();
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

const { saveVitalSigns, getVitalSigns, getAllVitalSigns } = require('../controllers/vitalSignsController');
const { getAllLabTests, getLabTest, createLabTest, updateLabTest, deleteLabTest } = require('../controllers/labTestsController');
const { getAllCategories, getCategoryWithTests, createCategory, updateCategory, deleteCategory } = require('../controllers/labTestCategoriesController');
const { createTestOrder, getTestOrdersByAppointment, getAllTestOrders, updateTestResult, deleteTestOrder, updateTestOrderStatus, getTestOrdersSummary } = require('../controllers/testOrdersController');

// ========================================
// VITAL SIGNS ROUTES (Doctor)
// ========================================

// Lưu/cập nhật chỉ số sức khỏe
router.post('/vital-signs', verifyToken, verifyRole(['doctor']), saveVitalSigns);

// Lấy vital signs của 1 appointment
router.get('/vital-signs/by-appointment/:appointmentId', verifyToken, verifyRole(['doctor', 'admin']), getVitalSigns);

// Lấy tất cả vital signs (lịch sử)
router.get('/vital-signs', verifyToken, verifyRole(['doctor', 'admin']), getAllVitalSigns);

// ========================================
// LAB TEST CATEGORIES ROUTES (Admin CRUD)
// ========================================

// Lấy danh sách tất cả danh mục xét nghiệm
router.get('/lab-test-categories', verifyToken, verifyRole(['doctor', 'admin']), getAllCategories);

// Lấy 1 danh mục kèm các xét nghiệm của nó
router.get('/lab-test-categories/:categoryId', verifyToken, verifyRole(['doctor', 'admin']), getCategoryWithTests);

// Tạo danh mục xét nghiệm mới
router.post('/lab-test-categories', verifyToken, verifyRole(['admin']), createCategory);

// Cập nhật danh mục xét nghiệm
router.put('/lab-test-categories/:categoryId', verifyToken, verifyRole(['admin']), updateCategory);

// Xóa danh mục xét nghiệm
router.delete('/lab-test-categories/:categoryId', verifyToken, verifyRole(['admin']), deleteCategory);

// ========================================
// LAB TESTS ROUTES (Admin CRUD)
// ========================================

// Lấy danh sách tất cả xét nghiệm (có thể filter theo category_id)
router.get('/lab-tests', verifyToken, verifyRole(['doctor', 'admin']), getAllLabTests);

// Lấy chi tiết 1 xét nghiệm
router.get('/lab-tests/:id', verifyToken, verifyRole(['doctor', 'admin', 'receptionist']), getLabTest);

// Thêm xét nghiệm mới
router.post('/lab-tests', verifyToken, verifyRole(['admin']), createLabTest);

// Cập nhật xét nghiệm
router.put('/lab-tests/:id', verifyToken, verifyRole(['admin']), updateLabTest);

// Xóa xét nghiệm
router.delete('/lab-tests/:id', verifyToken, verifyRole(['admin']), deleteLabTest);

// ========================================
// TEST ORDERS ROUTES (Doctor + Receptionist)
// ========================================

// Tạo chỉ định xét nghiệm (Doctor)
router.post('/test-orders', verifyToken, verifyRole(['doctor']), createTestOrder);

// Lấy xét nghiệm của 1 appointment
router.get('/test-orders/by-appointment/:appointmentId', verifyToken, verifyRole(['doctor', 'receptionist', 'admin']), getTestOrdersByAppointment);

// Lấy tất cả test orders
router.get('/test-orders', verifyToken, verifyRole(['receptionist', 'admin']), getAllTestOrders);

// Lấy bản tóm tắt xét nghiệm của 1 appointment
router.get('/test-orders/summary/:appointmentId', verifyToken, verifyRole(['doctor', 'receptionist', 'admin']), getTestOrdersSummary);

// Cập nhật kết quả xét nghiệm (Receptionist/Lab)
router.put('/test-orders/:id/result', verifyToken, verifyRole(['receptionist', 'admin']), updateTestResult);

// Thay đổi trạng thái
router.put('/test-orders/:id/status', verifyToken, verifyRole(['receptionist', 'admin']), updateTestOrderStatus);

// Xóa chỉ định (chỉ pending)
router.delete('/test-orders/:id', verifyToken, verifyRole(['doctor', 'admin']), deleteTestOrder);

module.exports = router;
