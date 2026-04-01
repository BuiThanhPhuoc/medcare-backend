/**
 * Export Controller
 * Xử lý yêu cầu export dữ liệu ra Excel/PDF
 */

const { exportToExcel, exportToPDF, generateListReportHTML } = require('../utils/exportUtils');
const db = require('../config/db');

/**
 * Export danh sách Bác sĩ ra Excel
 */
exports.exportDoctorsExcel = async (req, res) => {
    try {
        // Lấy dữ liệu bác sĩ
        const [doctors] = await db.query(`
            SELECT 
                d.id as id,
                d.full_name as name,
                d.specialty as specialty,
                u.email,
                u.phone,
                d.description as qualification,
                d.experience as experience,
                CASE 
                    WHEN LOWER(d.status) IN ('active', 'đang hoạt động') THEN 'Có sẵn'
                    ELSE 'Không'
                END as status
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE u.role = 'doctor'
            ORDER BY d.full_name
        `);

        // Định nghĩa cột
        const columns = [
            { header: 'Mã bác sĩ', key: 'id', width: 12 },
            { header: 'Tên', key: 'name', width: 20 },
            { header: 'Chuyên khoa', key: 'specialty', width: 18 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'SĐT', key: 'phone', width: 12 },
            { header: 'Trình độ', key: 'qualification', width: 20 },
            { header: 'Kinh nghiệm (năm)', key: 'experience', width: 15 },
            { header: 'Trạng thái', key: 'status', width: 12 }
        ];

        // Export
        const buffer = await exportToExcel(doctors, columns, 'Bác sĩ', '📋 DANH SÁCH BÁC SĨ');

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Danh_sach_bac_si.xlsx"');
        res.send(buffer);

    } catch (error) {
        console.error('❌ Export doctors error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export dữ liệu bác sĩ' });
    }
};

/**
 * Export danh sách Bệnh nhân ra Excel
 */
exports.exportPatientsExcel = async (req, res) => {
    try {
        const [patients] = await db.query(`
            SELECT 
                u.id,
                COALESCE(p.full_name, u.username) as name,
                u.email,
                u.phone,
                p.date_of_birth,
                p.gender,
                p.address,
                u.created_at as joinDate
            FROM users u
            LEFT JOIN patients p ON p.user_id = u.id
            WHERE u.role = 'patient'
            ORDER BY u.username
        `);

        const columns = [
            { header: 'Mã bệnh nhân', key: 'id', width: 12 },
            { header: 'Tên', key: 'name', width: 20 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'SĐT', key: 'phone', width: 12 },
            { header: 'Ngày sinh', key: 'date_of_birth', width: 15 },
            { header: 'Giới tính', key: 'gender', width: 10 },
            { header: 'Địa chỉ', key: 'address', width: 30 },
            { header: 'Ngày tham gia', key: 'joinDate', width: 15 }
        ];

        const buffer = await exportToExcel(patients, columns, 'Bệnh nhân', '👥 DANH SÁCH BỆNH NHÂN');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Danh_sach_benh_nhan.xlsx"');
        res.send(buffer);

    } catch (error) {
        console.error('❌ Export patients error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export dữ liệu bệnh nhân' });
    }
};

/**
 * Export danh sách Lịch khám ra Excel
 */
exports.exportAppointmentsExcel = async (req, res) => {
    try {
        const { status, doctorId, month, year } = req.query;

        let query = `
            SELECT 
                a.id,
                a.appointment_date as date,
                a.appointment_time as time,
                u.username as patientName,
                u.phone as patientPhone,
                u.email as patientEmail,
                d.full_name as doctorName,
                d.specialty as specialty,
                a.status,
                p.total_amount as amount,
                p.payment_status
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN payments p ON a.id = p.appointment_id
            WHERE 1=1
        `;

        let params = [];

        if (status) {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        if (doctorId) {
            query += ` AND a.doctor_id = ?`;
            params.push(doctorId);
        }

        if (month && year) {
            query += ` AND YEAR(a.appointment_date) = ? AND MONTH(a.appointment_date) = ?`;
            params.push(year, month);
        }

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;

        const [appointments] = await db.query(query, params);

        // Transform status text
        const appointmentsData = appointments.map(apt => ({
            ...apt,
            status: apt.status === 'pending' ? 'Chờ xác nhận' : 
                   apt.status === 'confirmed' ? 'Đã xác nhận' :
                   apt.status === 'completed' ? 'Hoàn thành' :
                   apt.status === 'cancelled' ? 'Hủy' : apt.status,
            payment_status: apt.payment_status === 'completed' ? 'Đã thanh toán' :
                           apt.payment_status === 'pending' ? 'Chưa thanh toán' :
                           apt.payment_status === 'failed' ? 'Thất bại' : 'N/A'
        }));

        const columns = [
            { header: 'Mã lịch khám', key: 'id', width: 12 },
            { header: 'Ngày khám', key: 'date', width: 15 },
            { header: 'Giờ khám', key: 'time', width: 12 },
            { header: 'Bệnh nhân', key: 'patientName', width: 20 },
            { header: 'SĐT', key: 'patientPhone', width: 12 },
            { header: 'Email', key: 'patientEmail', width: 20 },
            { header: 'Bác sĩ', key: 'doctorName', width: 20 },
            { header: 'Chuyên khoa', key: 'specialty', width: 15 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Số tiền', key: 'amount', width: 12 },
            { header: 'Thanh toán', key: 'payment_status', width: 15 }
        ];

        const buffer = await exportToExcel(appointmentsData, columns, 'Lịch khám', '📅 DANH SÁCH LỊCH KHÁM');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Danh_sach_lich_kham_${year}-${month || 'all'}.xlsx"`);
        res.send(buffer);

    } catch (error) {
        console.error('❌ Export appointments error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export lịch khám' });
    }
};

/**
 * Export danh sách Thuốc ra Excel
 */
exports.exportMedicinesExcel = async (req, res) => {
    try {
        const [medicines] = await db.query(`
            SELECT 
                m.id as id,
                m.name as name,
                NULL as dosage,
                NULL as unit,
                NULL as category,
                m.quantity as stock,
                m.price,
                m.expiry_date as expiration_date,
                NULL as description
            FROM medicines m
            ORDER BY m.name
        `);

        const columns = [
            { header: 'Mã thuốc', key: 'id', width: 10 },
            { header: 'Tên thuốc', key: 'name', width: 25 },
            { header: 'Liều lượng', key: 'dosage', width: 15 },
            { header: 'Đơn vị', key: 'unit', width: 10 },
            { header: 'Loại', key: 'category', width: 15 },
            { header: 'Tồn kho', key: 'stock', width: 10 },
            { header: 'Giá', key: 'price', width: 12 },
            { header: 'HSD', key: 'expiration_date', width: 12 },
            { header: 'Mô tả', key: 'description', width: 20 }
        ];

        const buffer = await exportToExcel(medicines, columns, 'Thuốc', '💊 DANH SÁCH THUỐC');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Danh_sach_thuoc.xlsx"');
        res.send(buffer);

    } catch (error) {
        console.error('❌ Export medicines error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export danh sách thuốc' });
    }
};

/**
 * Export Doanh thu ra Excel
 */
exports.exportRevenueExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = `
            SELECT 
                DATE(p.created_at) as date,
                COUNT(*) as transactionCount,
                SUM(p.total_amount) as totalRevenue,
                GROUP_CONCAT(DISTINCT d.specialty) as specialties
            FROM payments p
            JOIN appointments a ON p.appointment_id = a.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE p.payment_status = 'completed'
        `;

        const params = [];
        if (startDate && endDate) {
            query += ` AND DATE(p.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` GROUP BY DATE(p.created_at) ORDER BY date DESC`;

        const [revenue] = await db.query(query, params);

        const columns = [
            { header: 'Ngày', key: 'date', width: 15 },
            { header: 'Số giao dịch', key: 'transactionCount', width: 15 },
            { header: 'Tổng doanh thu (VND)', key: 'totalRevenue', width: 18 },
            { header: 'Chuyên khoa', key: 'specialties', width: 25 }
        ];

        const buffer = await exportToExcel(revenue, columns, 'Doanh thu', `💰 BÁO CÁO DOANH THU ${startDate ? `(${startDate} - ${endDate})` : ''}`);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Bao_cao_doanh_thu.xlsx"');
        res.send(buffer);

    } catch (error) {
        console.error('❌ Export revenue error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export báo cáo doanh thu' });
    }
};

/**
 * Export danh sách Bác sĩ ra PDF
 */
exports.exportDoctorsPDF = async (req, res) => {
    try {
        const [doctors] = await db.query(`
            SELECT 
                d.id as id,
                d.full_name as name,
                d.specialty as specialty,
                u.email,
                u.phone,
                d.description as qualification,
                d.experience as experience,
                CASE 
                    WHEN LOWER(d.status) IN ('active', 'đang hoạt động') THEN 'Có sẵn'
                    ELSE 'Không'
                END as status
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE u.role = 'doctor'
            ORDER BY d.full_name
        `);

        const columns = [
            { header: 'Mã bác sĩ', key: 'id' },
            { header: 'Tên', key: 'name' },
            { header: 'Chuyên khoa', key: 'specialty' },
            { header: 'Email', key: 'email' },
            { header: 'SĐT', key: 'phone' },
            { header: 'Trình độ', key: 'qualification' },
            { header: 'Kinh nghiệm (năm)', key: 'experience' },
            { header: 'Trạng thái', key: 'status' }
        ];

        const htmlContent = generateListReportHTML('📋 DANH SÁCH BÁC SĨ', doctors, columns);
        const pdfBuffer = await exportToPDF(htmlContent, 'Danh_sach_bac_si.pdf');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Danh_sach_bac_si.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ Export doctors PDF error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export PDF bác sĩ' });
    }
};

/**
 * Export danh sách Bệnh nhân ra PDF
 */
exports.exportPatientsPDF = async (req, res) => {
    try {
        const [patients] = await db.query(`
            SELECT 
                u.id,
                COALESCE(p.full_name, u.username) as name,
                u.email,
                u.phone,
                p.date_of_birth,
                p.gender,
                p.address
            FROM users u
            LEFT JOIN patients p ON p.user_id = u.id
            WHERE u.role = 'patient'
            ORDER BY u.username
        `);

        const columns = [
            { header: 'Mã bệnh nhân', key: 'id' },
            { header: 'Tên', key: 'name' },
            { header: 'Email', key: 'email' },
            { header: 'SĐT', key: 'phone' },
            { header: 'Ngày sinh', key: 'date_of_birth' },
            { header: 'Giới tính', key: 'gender' },
            { header: 'Địa chỉ', key: 'address' }
        ];

        const htmlContent = generateListReportHTML('👥 DANH SÁCH BỆNH NHÂN', patients, columns);
        const pdfBuffer = await exportToPDF(htmlContent, 'Danh_sach_benh_nhan.pdf');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="Danh_sach_benh_nhan.pdf"');
        res.send(pdfBuffer);

    } catch (error) {
        console.error('❌ Export patients PDF error:', error);
        res.status(500).json({ success: false, message: 'Lỗi export PDF bệnh nhân' });
    }
};

module.exports = exports;
