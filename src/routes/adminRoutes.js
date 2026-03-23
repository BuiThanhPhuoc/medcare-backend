const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware'); // Để up ảnh
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

// === IMPORT CÁC CONTROLLERS ===
const { getRevenueStatistics, getRevenueTimeline, getAllUsers, toggleLockUser } = require('../controllers/adminController');
const doctorCtrl = require('../controllers/adminDoctorController');
const specialtyCtrl = require('../controllers/adminSpecialtyController');
const postCtrl = require('../controllers/adminPostController');
const adminCategoryTagController = require('../controllers/adminCategoryTagController');
const scheduleController = require('../controllers/scheduleController');
const receptionScheduleCtrl = require('../controllers/receptionScheduleController');

// ========================================================
// 🛡️ BẢO VỆ TẤT CẢ ROUTE (Chỉ có 'admin' mới được vào)
// ========================================================
router.use(verifyToken, verifyRole(['admin']));

// ========================================================
// 📊 QUẢN LÝ DOANH THU VÀ USERS
// ========================================================
router.get('/revenue', getRevenueStatistics);
router.get('/revenue/timeline', getRevenueTimeline);
router.get('/users', getAllUsers);
router.put('/users/:id/lock', toggleLockUser);

// ========================================================
// 👨‍⚕️ QUẢN LÝ BÁC SĨ (CRUD)
// ========================================================
router.get('/doctors', doctorCtrl.getAllDoctors);
router.get('/doctors/:id', doctorCtrl.getDoctorById);
router.post('/doctors', upload.single('avatar'), doctorCtrl.createDoctor);
router.put('/doctors/:id', upload.single('avatar'), doctorCtrl.updateDoctor);
router.delete('/doctors/:id', doctorCtrl.deleteDoctor);

// ========================================================
// 🏥 QUẢN LÝ CHUYÊN KHOA (CRUD)
// ========================================================
router.get('/specialties', specialtyCtrl.getAllSpecialties);
router.get('/specialties/:id', specialtyCtrl.getSpecialtyById);
router.post('/specialties', specialtyCtrl.createSpecialty);
router.put('/specialties/:id', specialtyCtrl.updateSpecialty);
router.delete('/specialties/:id', specialtyCtrl.deleteSpecialty);

// ========================================================
// 📰 QUẢN LÝ BÀI VIẾT (CMS)
// ========================================================
router.get('/posts', postCtrl.getAllPosts);
router.get('/posts/trashed', postCtrl.getTrashedPosts); 
router.get('/posts/:id', postCtrl.getPostById);
router.post('/posts', postCtrl.createPost);
router.put('/posts/:id', postCtrl.updatePost);
router.delete('/posts/:id', postCtrl.softDeletePost); 
router.post('/posts/:id/restore', postCtrl.restorePost); 
router.delete('/posts/:id/force', postCtrl.forceDeletePost); 

// DANH MỤC & THẺ BÀI VIẾT
router.get('/categories', adminCategoryTagController.getAllCategories);
router.get('/tags', adminCategoryTagController.getAllTags);

router.get('/schedules/pending', scheduleController.getPendingSchedules);
router.put('/schedules/bulk-update', scheduleController.updateScheduleStatusBulk);

// ========================================================
// 📅 QUẢN LÝ LỊCH LỄ TÂN
// ========================================================
router.get('/receptionists', receptionScheduleCtrl.getAllReceptionists);
router.get('/receptionists/:id', receptionScheduleCtrl.getReceptionistById);
router.post('/receptionists', receptionScheduleCtrl.createReceptionist);
router.put('/receptionists/:id', upload.single('avatar'), receptionScheduleCtrl.updateReceptionist);
router.delete('/receptionists/:id', receptionScheduleCtrl.deleteReceptionist);
router.get('/receptionists/:receptionistId/schedule', receptionScheduleCtrl.getReceptionistSchedule);
router.post('/receptionists/:receptionistId/schedule', receptionScheduleCtrl.assignReceptionistSchedule);

module.exports = router;