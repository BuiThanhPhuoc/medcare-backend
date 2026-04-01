const db = require('../config/db');
const { 
    createVNPayment, 
    verifyVNPaymentIPN,
    createVNPaymentForDrugOrder,
    verifyVNPaymentIPNForDrugOrder
} = require('../services/vnpayService');
const { dispenseForAppointment } = require('../services/dispenseService');
const { syncAppointmentLabWorkflow } = require('../services/labWorkflowSync');

/**
 * Lễ tân: thu tiền và đồng thời mark các chỉ định xét nghiệm là đã thanh toán.
 * (Dùng chung cho cả thanh toán tiền mặt và VNPay "success".)
 */
async function payLabTestsIfAny(connection, appointmentId) {
    const apptId = Number(appointmentId);
    if (!Number.isFinite(apptId)) return { paidCount: 0 };

    const [orders] = await connection.execute(
        `SELECT id 
         FROM test_orders 
         WHERE appointment_id = ? AND payment_status = 'unpaid'`,
        [apptId]
    );

    const paidCount = orders.length || 0;
    if (paidCount === 0) return { paidCount: 0 };

    await connection.execute(
        `UPDATE test_orders 
         SET payment_status = 'paid' 
         WHERE appointment_id = ? AND payment_status = 'unpaid'`,
        [apptId]
    );

    await syncAppointmentLabWorkflow(connection, apptId);
    return { paidCount };
}

/**
 * Helper function to extract valid IPv4 from request
 */
function getClientIpAddress(req) {
    // Try x-forwarded-for first (from proxy/load balancer)
    let ip = req.headers['x-forwarded-for'];
    if (ip) {
        // x-forwarded-for can contain multiple IPs, get the first one
        ip = ip.split(',')[0].trim();
    }
    
    // Fallback to remoteAddress
    if (!ip) {
        ip = req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
    }
    
    // Convert IPv6 localhost to IPv4
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1';
    }
    
    // Remove ::ffff: prefix if present
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }
    
    return ip || '127.0.0.1';
}

const processPayment = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { appointment_id } = req.params; // Lấy ID lịch khám từ URL
        const { total_amount, payment_method } = req.body;

        if (!total_amount) {
            return res.status(400).json({ message: "Vui lòng nhập tổng số tiền thanh toán!" });
        }

        // 1. Kiểm tra lịch khám đã khám xong chưa và đã thanh toán chưa?
        const [appointments] = await connection.execute(
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

        await connection.beginTransaction();

        // 2. Lưu dữ liệu doanh thu vào bảng payments
        const [paymentResult] = await connection.execute(
            'INSERT INTO payments (appointment_id, total_amount, payment_method, payment_status) VALUES (?, ?, ?, ?)',
            [appointment_id, total_amount, payment_method || 'cash', 'completed']
        );
        const paymentId = paymentResult.insertId;

        // 3. Cấp thuốc FEFO nếu có đơn (dispenseService no-op khi không có đơn / không có dòng thuốc)
        try {
            await dispenseForAppointment(connection, Number(appointment_id), paymentId);
        } catch (dispenseErr) {
            await connection.rollback();
            return res.status(400).json({ message: dispenseErr.message || 'Không thể cấp thuốc.' });
        }

        // 3.5 Mark tiền xét nghiệm là đã thu (nếu có chỉ định chưa thanh toán)
        try {
            await payLabTestsIfAny(connection, Number(appointment_id));
        } catch (labPayErr) {
            await connection.rollback();
            return res.status(400).json({ message: labPayErr.message || 'Không thể cập nhật thanh toán xét nghiệm.' });
        }

        // 4. Cập nhật trạng thái payment_status trong bảng appointments
        await connection.execute(
            'UPDATE appointments SET payment_status = "paid" WHERE id = ?',
            [appointment_id]
        );

        await connection.commit();

        res.status(200).json({ message: "Thanh toán thành công! Đã ghi nhận doanh thu và cấp thuốc theo lô FEFO." });

    } catch (error) {
        try { await connection.rollback(); } catch (e) {}
        console.error("Lỗi thanh toán:", error);
        res.status(500).json({ message: "Lỗi server khi thanh toán!" });
    } finally {
        connection.release();
    }
};

/**
 * Tạo yêu cầu thanh toán VNPay
 * POST /api/payments/vnpay/create
 */
const createVNPaymentRequest = async (req, res) => {
    try {
        const { appointment_id, amount } = req.body;
        
        if (!appointment_id || !amount) {
            return res.status(400).json({ message: "Vui lòng cung cấp appointment_id và amount" });
        }

        // Lấy IP address của khách hàng
        const ipAddress = getClientIpAddress(req);

        const result = await createVNPayment(appointment_id, amount, ipAddress);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error("Lỗi tạo yêu cầu VNPay:", error);
        return res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Tạo yêu cầu thanh toán VNPay cho đơn hàng thuốc
 * POST /api/payments/vnpay/drug-order/create
 */
const createVNPaymentRequestForDrugOrder = async (req, res) => {
    try {
        const { drug_order_id, amount } = req.body;
        
        if (!drug_order_id || !amount) {
            return res.status(400).json({ message: "Vui lòng cung cấp drug_order_id và amount" });
        }

        // Lấy IP address của khách hàng
        const ipAddress = getClientIpAddress(req);

        const result = await createVNPaymentForDrugOrder(drug_order_id, amount, ipAddress);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error("Lỗi tạo yêu cầu VNPay cho đơn hàng thuốc:", error);
        return res.status(400).json({ 
            success: false,
            message: error.message 
        });
    }
};

/**
 * Xử lý kết quả thanh toán VNPay (Return URL)
 * GET /api/payments/vnpay/return
 */
const handleVNPaymentReturn = async (req, res) => {
    try {
        // IMPORTANT: Phải lấy ALL parameters từ VNPay (bao gồm cả những cái chưa biết)
        // vì signature được tính từ TẤT CẢ params
        const vnp_Params = req.query;

        // Kiểm tra xem đây là thanh toán cho lịch khám hay đơn hàng thuốc
        const transactionRef = req.query.vnp_TxnRef || '';
        const isDrugOrder = transactionRef.includes('drug_');

        if (isDrugOrder) {
            const result = await verifyVNPaymentIPNForDrugOrder(vnp_Params);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

            if (result.success) {
                return res.redirect(`${frontendUrl}/drug-order-success?transaction=${transactionRef}&order=${result.drugOrderId}`);
            } else {
                return res.redirect(`${frontendUrl}/drug-order-failed?transaction=${transactionRef}&message=${encodeURIComponent(result.message)}`);
            }
        } else {
            const result = await verifyVNPaymentIPN(vnp_Params);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

            if (result.success) {
                return res.redirect(`${frontendUrl}/payment-success?transaction=${transactionRef}&appointment=${result.appointmentId}`);
            } else {
                return res.redirect(`${frontendUrl}/payment-failed?transaction=${transactionRef}&message=${encodeURIComponent(result.message)}`);
            }
        }
    } catch (error) {
        console.error("Lỗi xử lý kết quả VNPay:", error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/payment-failed?message=${encodeURIComponent('Lỗi xác minh thanh toán')}`);
    }
};

/**
 * Xử lý IPN callback từ VNPay
 * POST /api/payments/vnpay/ipn
 */
const handleVNPaymentIPN = async (req, res) => {
    try {
        const transactionRef = req.query.vnp_TxnRef || '';
        const isDrugOrder = transactionRef.includes('drug_');

        let result;
        if (isDrugOrder) {
            result = await verifyVNPaymentIPNForDrugOrder(req.query);
        } else {
            result = await verifyVNPaymentIPN(req.query);
        }
        
        // VNPay yêu cầu phản hồi IPN với RespCode=00 nếu xử lý thành công
        if (result.success) {
            return res.status(200).json({ RespCode: '00', Message: 'Confirm Success' });
        } else {
            return res.status(200).json({ RespCode: '01', Message: 'Invalid Signature' });
        }
    } catch (error) {
        console.error("Lỗi IPN VNPay:", error);
        return res.status(200).json({ RespCode: '99', Message: 'Unknow error' });
    }
};

module.exports = { 
    processPayment,
    createVNPaymentRequest,
    createVNPaymentRequestForDrugOrder,
    handleVNPaymentReturn,
    handleVNPaymentIPN
};