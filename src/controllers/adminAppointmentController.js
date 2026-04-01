/**
 * Admin Appointments Controller
 * Quản lý lịch khám cho admin
 */

const db = require('../config/db');
const { calculatePagination, createPaginatedResponse } = require('../utils/paginationUtils');

/**
 * Get all appointments with pagination
 * Query params: page, limit, search, status, dateFrom, dateTo, doctorId
 */
exports.getAllAppointments = async (req, res) => {
    try {
        const pagination = calculatePagination(req.query.page, req.query.limit);
        const { search, status, dateFrom, dateTo, doctorId } = req.query;

        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];

        if (search) {
            whereClause += ' AND (u.username LIKE ? OR u.phone LIKE ? OR d.full_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            whereClause += ' AND a.status = ?';
            params.push(status);
        }

        if (dateFrom) {
            whereClause += ' AND DATE(a.appointment_date) >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            whereClause += ' AND DATE(a.appointment_date) <= ?';
            params.push(dateTo);
        }

        if (doctorId) {
            whereClause += ' AND a.doctor_id = ?';
            params.push(doctorId);
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            ${whereClause}
        `;
        const [[{ total }]] = await db.query(countQuery, params);

        // Get paginated data
        const dataQuery = `
            SELECT 
                a.id,
                a.appointment_date,
                a.appointment_time,
                a.status,
                pt.id as patient_id,
                u.id as patient_user_id,
                u.username as patient_name,
                u.email as patient_email,
                u.phone as patient_phone,
                d.id as doctor_id,
                d.full_name as doctor_name,
                d.specialty as specialty,
                p.total_amount as payment_amount,
                p.payment_method,
                p.payment_status
            FROM appointments a
            JOIN patients pt ON a.patient_id = pt.id
            JOIN users u ON pt.user_id = u.id
            JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN payments p ON a.id = p.appointment_id
            ${whereClause}
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
            LIMIT ? OFFSET ?
        `;

        const [appointments] = await db.query(dataQuery, [...params, pagination.limit, pagination.offset]);

        res.status(200).json(
            createPaginatedResponse(appointments, total, pagination)
        );

    } catch (error) {
        console.error('❌ Error in getAllAppointments:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

/**
 * Get appointment statistics
 */
exports.getAppointmentStatistics = async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                COUNT(*) as total_appointments,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                AVG(DATEDIFF(appointment_date, created_at)) as avg_booking_days
            FROM appointments
            WHERE appointment_date >= CURDATE()
        `);

        res.status(200).json(
            createPaginatedResponse(stats, 1, { page: 1, limit: 1 })
        );

    } catch (error) {
        console.error('❌ Error in getAppointmentStatistics:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

/**
 * Update appointment status
 */
exports.updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        const [result] = await db.query(
            'UPDATE appointments SET status = ? WHERE id = ?',
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Lịch khám không tìm thấy' });
        }

        res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công' });

    } catch (error) {
        console.error('❌ Error in updateAppointmentStatus:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

/**
 * Delete appointment
 */
exports.deleteAppointment = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            'DELETE FROM appointments WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Lịch khám không tìm thấy' });
        }

        res.status(200).json({ success: true, message: 'Xóa lịch khám thành công' });

    } catch (error) {
        console.error('❌ Error in deleteAppointment:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};

/**
 * Bulk update appointment status
 * Request body: { ids: [1, 2, 3], status: 'confirmed' }
 */
exports.bulkUpdateAppointmentStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'Phải chọn ít nhất 1 lịch khám' });
        }

        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        // Build placeholders for SQL IN clause
        const placeholders = ids.map(() => '?').join(',');
        
        const [result] = await db.query(
            `UPDATE appointments SET status = ? WHERE id IN (${placeholders})`,
            [status, ...ids]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Không có lịch khám nào được cập nhật' });
        }

        res.status(200).json({ 
            success: true, 
            message: `Cập nhật thành công ${result.affectedRows} lịch khám`,
            affectedRows: result.affectedRows 
        });

    } catch (error) {
        console.error('❌ Error in bulkUpdateAppointmentStatus:', error);
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
};
