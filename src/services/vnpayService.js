const db = require('../config/db');
const vnpayUtils = require('../utils/vnpayUtils');
const { dispenseForAppointment } = require('./dispenseService');
const { syncAppointmentLabWorkflow } = require('./labWorkflowSync');

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
 * Tạo yêu cầu thanh toán VNPay
 * @param {number} appointmentId - ID lịch khám
 * @param {number} amount - Số tiền thanh toán
 * @param {string} ipAddress - Địa chỉ IP khách hàng
 * @returns {Object} Kết quả tạo yêu cầu
 */
async function createVNPayment(appointmentId, amount, ipAddress) {
    const connection = await db.getConnection();
    
    try {
        // 1. Kiểm tra lịch khám có tồn tại không
        const [appointments] = await connection.execute(
            'SELECT status, payment_status FROM appointments WHERE id = ?',
            [appointmentId]
        );

        if (appointments.length === 0) {
            throw new Error('Lịch khám không tồn tại');
        }

        const appointment = appointments[0];

        // 2. Kiểm tra điều kiện thanh toán
        if (appointment.status !== 'completed') {
            throw new Error('Bệnh nhân chưa khám xong, không thể thanh toán');
        }

        if (appointment.payment_status === 'paid') {
            throw new Error('Hóa đơn này đã được thanh toán rồi');
        }

        if (!amount || amount <= 0) {
            throw new Error('Số tiền thanh toán không hợp lệ');
        }

        // 3. Tạo bản ghi VNPay transaction trong database
        const transactionRef = vnpayUtils.generateTransactionRef(appointmentId);
        
        const [result] = await connection.execute(
            `INSERT INTO vnpay_transactions 
             (appointment_id, amount, transaction_ref, status, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            [appointmentId, amount, transactionRef, 'pending']
        );

        // 4. Tạo URL thanh toán
        const paymentUrl = vnpayUtils.buildPaymentUrl({
            appointmentId,
            transactionRef,
            amount,
            orderInfo: `Thanh toán lịch khám #${appointmentId}`,
            ipAddress
        });

        return {
            success: true,
            appointmentId,
            amount,
            transactionRef,
            paymentUrl
        };
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Xác minh kết quả thanh toán từ VNPay IPN
 * @param {Object} vnpParams - Các tham số từ VNPay
 * @returns {Object} Kết quả xác minh
 */
async function verifyVNPaymentIPN(vnpParams) {
    const connection = await db.getConnection();
    
    try {
        // 1. Xác minh chữ ký
        if (!vnpayUtils.verifyIpnSignature(vnpParams)) {
            throw new Error('Chữ ký không hợp lệ');
        }

        const transactionRef = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const transactionNo = vnpParams['vnp_TransactionNo'];
        const bankCode = vnpParams['vnp_BankCode'];

        // 2. Lấy thông tin giao dịch
        const [transactions] = await connection.execute(
            'SELECT * FROM vnpay_transactions WHERE transaction_ref = ?',
            [transactionRef]
        );

        if (transactions.length === 0) {
            throw new Error('Giao dịch không tồn tại');
        }

        const transaction = transactions[0];
        const paymentStatus = vnpayUtils.getPaymentStatus(responseCode);

        // 3. Cập nhật trạng thái giao dịch VNPay
        await connection.beginTransaction();

        try {
            await connection.execute(
                `UPDATE vnpay_transactions 
                 SET status = ?, response_code = ?, transaction_no = ?, bank_code = ?, updated_at = NOW()
                 WHERE id = ?`,
                [paymentStatus.status, responseCode, transactionNo, bankCode, transaction.id]
            );

            // 4. Nếu thanh toán thành công, cập nhật trạng thái thanh toán trong appointments
            if (paymentStatus.status === 'success') {
                const [paymentResult] = await connection.execute(
                    `INSERT INTO payments 
                     (appointment_id, total_amount, payment_method, payment_status, vnpay_transaction_id) 
                     VALUES (?, ?, ?, 'completed', ?)`,
                    [transaction.appointment_id, transaction.amount, 'transfer', transaction.id]
                );
                const paymentId = paymentResult.insertId;

                // Đồng bộ thanh toán xét nghiệm trước khi cấp phát thuốc
                await payLabTestsIfAny(connection, transaction.appointment_id);

                await connection.execute(
                    'UPDATE appointments SET payment_status = ? WHERE id = ?',
                    ['paid', transaction.appointment_id]
                );

                try {
                    await dispenseForAppointment(connection, transaction.appointment_id, paymentId);
                } catch (dispenseErr) {
                    throw dispenseErr;
                }
            }

            await connection.commit();

            return {
                success: paymentStatus.status === 'success',
                transactionRef,
                status: paymentStatus.status,
                message: paymentStatus.message,
                responseCode,
                appointmentId: transaction.appointment_id
            };
        } catch (innerError) {
            await connection.rollback();
            throw innerError;
        }
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Lấy thông tin giao dịch VNPay
 * @param {string} transactionRef - Mã giao dịch
 * @returns {Object} Thông tin giao dịch
 */
async function getVNPaymentTransaction(transactionRef) {
    const connection = await db.getConnection();

    try {
        const [transactions] = await connection.execute(
            'SELECT * FROM vnpay_transactions WHERE transaction_ref = ?',
            [transactionRef]
        );

        if (transactions.length === 0) {
            throw new Error('Giao dịch không tồn tại');
        }

        return transactions[0];
    } finally {
        connection.release();
    }
}

/**
 * Tạo yêu cầu thanh toán VNPay cho đơn đặt hàng thuốc
 * @param {number} drugOrderId - ID đơn hàng thuốc
 * @param {number} amount - Số tiền thanh toán
 * @param {string} ipAddress - Địa chỉ IP khách hàng
 * @returns {Object} Kết quả tạo yêu cầu
 */
async function createVNPaymentForDrugOrder(drugOrderId, amount, ipAddress) {
    const connection = await db.getConnection();
    
    try {
        // 1. Kiểm tra đơn hàng có tồn tại không
        const [orders] = await connection.execute(
            'SELECT total_amount, payment_status FROM drug_orders WHERE id = ?',
            [drugOrderId]
        );

        if (orders.length === 0) {
            throw new Error('Đơn hàng không tồn tại');
        }

        const order = orders[0];

        // 2. Kiểm tra điều kiện thanh toán
        if (order.payment_status === 'completed') {
            throw new Error('Đơn hàng này đã được thanh toán rồi');
        }

        if (!amount || amount <= 0 || amount !== order.total_amount) {
            throw new Error('Số tiền thanh toán không hợp lệ');
        }

        // 3. Tạo bản ghi VNPay transaction trong database
        const transactionRef = vnpayUtils.generateTransactionRef(`drug_${drugOrderId}`);
        
        const [result] = await connection.execute(
            `INSERT INTO vnpay_transactions 
             (drug_order_id, amount, transaction_ref, status, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            [drugOrderId, amount, transactionRef, 'pending']
        );

        // 4. Tạo URL thanh toán
        const paymentUrl = vnpayUtils.buildPaymentUrl({
            appointmentId: null,
            transactionRef,
            amount,
            orderInfo: `Thanh toán đơn hàng thuốc #${drugOrderId}`,
            ipAddress
        });

        return {
            success: true,
            drugOrderId,
            amount,
            transactionRef,
            paymentUrl
        };
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Xác minh kết quả thanh toán VNPay cho đơn hàng thuốc
 * @param {Object} vnpParams - Các tham số từ VNPay
 * @returns {Object} Kết quả xác minh
 */
async function verifyVNPaymentIPNForDrugOrder(vnpParams) {
    const connection = await db.getConnection();
    
    try {
        // 1. Xác minh chữ ký
        if (!vnpayUtils.verifyIpnSignature(vnpParams)) {
            throw new Error('Chữ ký không hợp lệ');
        }

        const transactionRef = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const transactionNo = vnpParams['vnp_TransactionNo'];
        const bankCode = vnpParams['vnp_BankCode'];

        // 2. Lấy thông tin giao dịch
        const [transactions] = await connection.execute(
            'SELECT * FROM vnpay_transactions WHERE transaction_ref = ? AND drug_order_id IS NOT NULL',
            [transactionRef]
        );

        if (transactions.length === 0) {
            throw new Error('Giao dịch không tồn tại');
        }

        const transaction = transactions[0];
        const paymentStatus = vnpayUtils.getPaymentStatus(responseCode);

        // 3. Cập nhật trạng thái giao dịch VNPay
        await connection.beginTransaction();

        try {
            await connection.execute(
                `UPDATE vnpay_transactions 
                 SET status = ?, response_code = ?, transaction_no = ?, bank_code = ?, updated_at = NOW()
                 WHERE id = ?`,
                [paymentStatus.status, responseCode, transactionNo, bankCode, transaction.id]
            );

            // 4. Nếu thanh toán thành công, cập nhật trạng thái đơn hàng
            if (paymentStatus.status === 'success') {
                await connection.execute(
                    'UPDATE drug_orders SET payment_status = ?, order_status = ? WHERE id = ?',
                    ['completed', 'confirmed', transaction.drug_order_id]
                );
            }

            await connection.commit();

            return {
                success: paymentStatus.status === 'success',
                transactionRef,
                status: paymentStatus.status,
                message: paymentStatus.message,
                responseCode,
                drugOrderId: transaction.drug_order_id
            };
        } catch (innerError) {
            await connection.rollback();
            throw innerError;
        }
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    createVNPayment,
    verifyVNPaymentIPN,
    getVNPaymentTransaction,
    createVNPaymentForDrugOrder,
    verifyVNPaymentIPNForDrugOrder
};
