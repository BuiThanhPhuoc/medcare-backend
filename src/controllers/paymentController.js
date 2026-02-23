const db = require('../config/db');

const processPayment = async (req, res) => {
    try {
        const { appointment_id } = req.params; // Lấy ID lịch khám từ URL
        const { total_amount, payment_method } = req.body;

        if (!total_amount) {
            return res.status(400).json({ message: "Vui lòng nhập tổng số tiền thanh toán!" });
        }

        // 1. Kiểm tra lịch khám đã khám xong chưa và đã thanh toán chưa?
        const [appointments] = await db.execute(
            'SELECT status, payment_status FROM appointments WHERE id = ?',
            [appointment_id]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy lịch khám này!" });
        }
        
        const appointment = appointments[0];
        
        // Bắt lỗi logic nghiệp vụ
        if (appointment.status !== 'completed') {
            return res.status(400).json({ message: "Bệnh nhân chưa khám xong, không thể thu tiền!" });
        }
        if (appointment.payment_status === 'paid') {
            return res.status(400).json({ message: "Hóa đơn này đã được thanh toán rồi!" });
        }

        // 2. Lưu dữ liệu doanh thu vào bảng payments
        await db.execute(
            'INSERT INTO payments (appointment_id, total_amount, payment_method) VALUES (?, ?, ?)',
            [appointment_id, total_amount, payment_method || 'cash']
        );

        // 3. Cập nhật trạng thái payment_status trong bảng appointments
        await db.execute(
            'UPDATE appointments SET payment_status = "paid" WHERE id = ?',
            [appointment_id]
        );

        res.status(200).json({ message: "Thanh toán thành công! Đã ghi nhận doanh thu." });

    } catch (error) {
        console.error("Lỗi thanh toán:", error);
        res.status(500).json({ message: "Lỗi server khi thanh toán!" });
    }
};

module.exports = { processPayment };