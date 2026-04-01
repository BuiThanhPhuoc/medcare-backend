const db = require('../config/db');
const { createVNPaymentForDrugOrder, verifyVNPaymentIPNForDrugOrder } = require('../services/vnpayService');

/**
 * GET /api/drug-orders - Lấy danh sách đơn hàng thuốc của bệnh nhân
 */
const getMyOrders = async (req, res) => {
    try {
        const patientId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const offset = (pageNum - 1) * limitNum;

        let query = `SELECT do.*, 
                     COUNT(doi.id) as item_count,
                     SUM(doi.subtotal) as total_calculated
                     FROM drug_orders do
                     LEFT JOIN drug_order_items doi ON do.id = doi.order_id
                     WHERE do.patient_id = ?`;
        const params = [patientId];

        if (status) {
            query += ' AND do.order_status = ?';
            params.push(status);
        }

        query += ' GROUP BY do.id ORDER BY do.order_date DESC LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const [orders] = await db.query(query, params);

        // Lấy tổng số records
        let countQuery = 'SELECT COUNT(*) as total FROM drug_orders WHERE patient_id = ?';
        const countParams = [patientId];
        if (status) {
            countQuery += ' AND order_status = ?';
            countParams.push(status);
        }
        const [countRows] = await db.query(countQuery, countParams);
        const total = countRows[0]?.total || 0;

        res.json({
            success: true,
            orders,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách đơn hàng:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đơn hàng' });
    }
};

/**
 * GET /api/drug-orders/:orderId - Lấy chi tiết đơn hàng
 */
const getOrderDetail = async (req, res) => {
    try {
        const { orderId } = req.params;
        const patientId = req.user.id;

        const [orderRows] = await db.query(
            'SELECT * FROM drug_orders WHERE id = ? AND patient_id = ?',
            [orderId, patientId]
        );
        const order = orderRows[0];

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        const [items] = await db.query(
            `SELECT 
                doi.id,
                doi.drug_id,
                doi.batch_id,
                doi.quantity,
                doi.price_at_time,
                doi.subtotal,
                d.name as drug_name,
                d.unit,
                d.generic_name,
                db.batch_number,
                db.manufacture_date,
                db.expiry_date
            FROM drug_order_items doi
            JOIN drugs d ON doi.drug_id = d.id
            JOIN drug_batches db ON doi.batch_id = db.id
            WHERE doi.order_id = ?`,
            [orderId]
        );

        res.json({
            success: true,
            order: {
                ...order,
                items
            }
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết đơn hàng:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết đơn hàng' });
    }
};

/**
 * POST /api/drug-orders - Tạo đơn hàng thuốc mới
 * Body: { items: [{drug_id, batch_id, quantity, price_at_time}, ...], payment_method, delivery_address, notes }
 */
const createOrder = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const patientId = req.user.id;
        const { items, payment_method, delivery_address, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Giỏ hàng trống' });
        }

        if (!['cod', 'vnpay'].includes(payment_method)) {
            return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ' });
        }

        if (!delivery_address) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập địa chỉ giao hàng' });
        }

        await connection.beginTransaction();

        // Tính tổng tiền
        let totalAmount = 0;
        for (const item of items) {
            totalAmount += (item.price_at_time || 0) * (item.quantity || 0);
        }

        // Tạo đơn hàng
        const [insertOrderResult] = await connection.query(
            `INSERT INTO drug_orders 
            (patient_id, total_amount, payment_method, payment_status, order_status, delivery_address, notes) 
            VALUES (?, ?, ?, 'pending', 'pending', ?, ?)`,
            [patientId, totalAmount, payment_method, delivery_address, notes || null]
        );

        const orderId = insertOrderResult.insertId;

        // Thêm các item vào đơn hàng
        for (const item of items) {
            const subtotal = (item.price_at_time || 0) * (item.quantity || 0);
            await connection.query(
                `INSERT INTO drug_order_items 
                (order_id, drug_id, batch_id, quantity, price_at_time, subtotal) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [orderId, item.drug_id, item.batch_id, item.quantity, item.price_at_time, subtotal]
            );

            // Cập nhật tồn kho
            await connection.query(
                'UPDATE drug_batches SET available_quantity = available_quantity - ? WHERE id = ?',
                [item.quantity, item.batch_id]
            );

            // Ghi log inventory
            await connection.query(
                `INSERT INTO inventory_logs 
                (drug_id, batch_id, delta_quantity, action, reference_type, reference_id, note) 
                VALUES (?, ?, ?, 'order', 'drug_order', ?, ?)`,
                [item.drug_id, item.batch_id, -(item.quantity), orderId, `Đặt hàng mua online #${orderId}`]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            orderId,
            totalAmount,
            paymentMethod: payment_method,
            message: 'Tạo đơn hàng thành công'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Lỗi tạo đơn hàng:', error);
        res.status(500).json({ success: false, message: 'Lỗi tạo đơn hàng' });
    } finally {
        connection.release();
    }
};

/**
 * PUT /api/drug-orders/:orderId/cancel - Hủy đơn hàng
 */
const cancelOrder = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { orderId } = req.params;
        const patientId = req.user.id;

        const [orderRows] = await db.query(
            'SELECT * FROM drug_orders WHERE id = ? AND patient_id = ?',
            [orderId, patientId]
        );
        const order = orderRows[0];

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (!['pending', 'confirmed'].includes(order.order_status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Chỉ có thể hủy đơn hàng đang chờ hoặc đã xác nhận' 
            });
        }

        await connection.beginTransaction();

        // Lấy danh sách items để cập nhật tồn kho
        const [items] = await connection.query(
            'SELECT * FROM drug_order_items WHERE order_id = ?',
            [orderId]
        );

        // Hoàn lại tồn kho
        for (const item of items) {
            await connection.query(
                'UPDATE drug_batches SET available_quantity = available_quantity + ? WHERE id = ?',
                [item.quantity, item.batch_id]
            );

            // Ghi log
            await connection.query(
                `INSERT INTO inventory_logs 
                (drug_id, batch_id, delta_quantity, action, reference_type, reference_id, note) 
                VALUES (?, ?, ?, 'cancel', 'drug_order', ?, ?)`,
                [item.drug_id, item.batch_id, item.quantity, orderId, `Hủy đơn hàng #${orderId}`]
            );
        }

        // Cập nhật trạng thái đơn hàng
        await connection.query(
            'UPDATE drug_orders SET order_status = ?, payment_status = ? WHERE id = ?',
            ['cancelled', 'cancelled', orderId]
        );

        await connection.commit();

        res.json({ success: true, message: 'Hủy đơn hàng thành công' });
    } catch (error) {
        await connection.rollback();
        console.error('Lỗi hủy đơn hàng:', error);
        res.status(500).json({ success: false, message: 'Lỗi hủy đơn hàng' });
    } finally {
        connection.release();
    }
};

/**
 * POST /api/drug-orders/:orderId/create-vnpay-payment - Tạo thanh toán VNPay cho đơn hàng thuốc
 */
const createVNPayPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const patientId = req.user.id;

        const [orderRows] = await db.query(
            'SELECT * FROM drug_orders WHERE id = ? AND patient_id = ?',
            [orderId, patientId]
        );
        const order = orderRows[0];

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (order.payment_method !== 'vnpay') {
            return res.status(400).json({ success: false, message: 'Phương thức thanh toán không phải VNPay' });
        }

        if (order.payment_status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Đơn hàng này không thể thanh toán' });
        }

        const ipAddress = (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1').split(',')[0];
        
        const paymentData = await createVNPaymentForDrugOrder(orderId, order.total_amount, ipAddress);

        res.json({
            success: true,
            paymentUrl: paymentData.paymentUrl,
            transactionRef: paymentData.transactionRef
        });
    } catch (error) {
        console.error('Lỗi tạo thanh toán VNPay:', error);
        res.status(500).json({ success: false, message: error.message || 'Lỗi tạo thanh toán VNPay' });
    }
};

/**
 * PUT /api/drug-orders/:orderId/payment-success - Cập nhật trạng thái thanh toán COD thành công
 */
const confirmPayment = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { payment_method } = req.body;
        const patientId = req.user.id;

        const [orderRows] = await db.query(
            'SELECT * FROM drug_orders WHERE id = ? AND patient_id = ?',
            [orderId, patientId]
        );
        const order = orderRows[0];

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        if (payment_method && order.payment_method !== payment_method) {
            return res.status(400).json({ success: false, message: 'Phương thức thanh toán không khớp' });
        }

        // Cập nhật trạng thái thanh toán
        const final_status = order.payment_method === 'cod' ? 'pending' : 'completed';
        await db.query(
            'UPDATE drug_orders SET payment_status = ?, order_status = ? WHERE id = ?',
            [final_status, 'confirmed', orderId]
        );

        res.json({ 
            success: true, 
            message: order.payment_method === 'cod' 
                ? 'Xác nhận đơn hàng thành công. Thanh toán khi nhận hàng'
                : 'Cập nhật thanh toán thành công' 
        });
    } catch (error) {
        console.error('Lỗi cập nhật thanh toán:', error);
        res.status(500).json({ success: false, message: 'Lỗi cập nhật thanh toán' });
    }
};

/**
 * GET /api/drug-orders/:orderId/payment-status - Kiểm tra trạng thái thanh toán
 */
const getPaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const patientId = req.user.id;

        const [rows] = await db.query(
            'SELECT id, order_status, payment_status, payment_method, total_amount FROM drug_orders WHERE id = ? AND patient_id = ?',
            [orderId, patientId]
        );
        const order = rows[0];

        if (!order) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
        }

        res.json({ success: true, order });
    } catch (error) {
        console.error('Lỗi kiểm tra trạng thái thanh toán:', error);
        res.status(500).json({ success: false, message: 'Lỗi kiểm tra trạng thái' });
    }
};

/**
 * GET /api/drug-orders/available-medicines - Lấy danh sách thuốc có sẵn
 */
const getAvailableMedicines = async (req, res) => {
    try {
        const { page = 1, limit = 20, search, batch_filter } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT DISTINCT
                d.id,
                d.name,
                d.generic_name,
                d.unit,
                MIN(db.id) as batch_id,
                MIN(db.available_quantity) as min_available,
                SUM(db.available_quantity) as total_available,
                MIN(db.selling_price) as min_price,
                MAX(db.selling_price) as max_price,
                COUNT(DISTINCT db.id) as batch_count
            FROM drugs d
            LEFT JOIN drug_batches db ON d.id = db.drug_id
            WHERE d.is_active = 1 AND db.available_quantity > 0 AND db.expiry_date > NOW()
        `;

        const params = [];

        if (search) {
            query += ' AND (d.name LIKE ? OR d.generic_name LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ' GROUP BY d.id ORDER BY d.name ASC LIMIT ? OFFSET ?';
        params.push(limitNum, offset);

        const [medicines] = await db.query(query, params);

        // Lấy tổng số thuốc
        let countQuery = `
            SELECT COUNT(DISTINCT d.id) as total
            FROM drugs d
            LEFT JOIN drug_batches db ON d.id = db.drug_id
            WHERE d.is_active = 1 AND db.available_quantity > 0 AND db.expiry_date > NOW()
        `;
        const countParams = [];

        if (search) {
            countQuery += ' AND (d.name LIKE ? OR d.generic_name LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        const [countRows] = await db.query(countQuery, countParams);
        const total = countRows[0]?.total || 0;

        // Lấy chi tiết các batch
        for (const medicine of medicines) {
            const [batches] = await db.query(
                `SELECT 
                    id,
                    batch_number,
                    manufacture_date,
                    expiry_date,
                    selling_price as price,
                    available_quantity
                FROM drug_batches
                WHERE drug_id = ? AND available_quantity > 0 AND expiry_date > NOW()
                ORDER BY expiry_date ASC`,
                [medicine.id]
            );
            medicine.batches = batches;
        }

        res.json({
            success: true,
            medicines,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách thuốc:', error);
        res.status(500).json({ success: false, message: 'Lỗi lấy danh sách thuốc' });
    }
};

module.exports = {
    getMyOrders,
    getOrderDetail,
    createOrder,
    cancelOrder,
    confirmPayment,
    createVNPayPayment,
    getPaymentStatus,
    getAvailableMedicines
};
