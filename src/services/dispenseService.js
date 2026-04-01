/**
 * Cấp thuốc FEFO sau thanh toán (dùng chung cash + VNPay).
 * @param {import('mysql2/promise').PoolConnection} connection
 * @param {number} appointmentId
 * @param {number} paymentId
 * @throws {Error} thông điệp tiếng Việt cho lỗi nghiệp vụ
 */
async function dispenseForAppointment(connection, appointmentId, paymentId) {
    const [prescriptions] = await connection.execute(
        `SELECT id
         FROM prescriptions
         WHERE appointment_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [appointmentId]
    );

    if (prescriptions.length === 0) {
        return;
    }

    const prescriptionId = prescriptions[0].id;

    const [alreadyDispensed] = await connection.execute(
        'SELECT id FROM dispense_transactions WHERE appointment_id = ? LIMIT 1',
        [appointmentId]
    );
    if (alreadyDispensed.length > 0) {
        throw new Error('Lịch khám này đã cấp thuốc trước đó.');
    }

    const [rxItems] = await connection.execute(
        `SELECT id, drug_id, quantity, price_at_time
         FROM prescription_items
         WHERE prescription_id = ?
         ORDER BY id ASC`,
        [prescriptionId]
    );

    if (rxItems.length === 0) {
        return;
    }

    const [txResult] = await connection.execute(
        `INSERT INTO dispense_transactions
        (appointment_id, prescription_id, payment_id, status)
        VALUES (?, ?, ?, 'completed')`,
        [appointmentId, prescriptionId, paymentId]
    );
    const transactionId = txResult.insertId;

    const affectedDrugIds = new Set();

    for (const item of rxItems) {
        let remaining = Number(item.quantity);
        if (!Number.isFinite(remaining) || remaining <= 0) {
            throw new Error(`Số lượng kê đơn không hợp lệ cho prescription_item=${item.id}`);
        }

        const [batches] = await connection.execute(
            `SELECT id, quantity
             FROM drug_batches
             WHERE drug_id = ? AND is_deleted = 0 AND quantity > 0
             ORDER BY expiry_date ASC, id ASC`,
            [item.drug_id]
        );

        const available = batches.reduce((sum, b) => sum + Number(b.quantity || 0), 0);
        if (available < remaining) {
            throw new Error(
                `Không đủ tồn kho cho drug_id=${item.drug_id}. Cần ${remaining}, hiện có ${available}.`
            );
        }

        for (const batch of batches) {
            if (remaining <= 0) break;
            const batchQty = Number(batch.quantity || 0);
            if (batchQty <= 0) continue;

            const take = Math.min(batchQty, remaining);
            await connection.execute(
                'UPDATE drug_batches SET quantity = quantity - ? WHERE id = ?',
                [take, batch.id]
            );

            await connection.execute(
                `INSERT INTO dispense_items
                (transaction_id, prescription_item_id, drug_id, batch_id, quantity, price_at_time)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [transactionId, item.id, item.drug_id, batch.id, take, item.price_at_time || 0]
            );

            await connection.execute(
                `INSERT INTO inventory_logs
                (drug_id, batch_id, delta_quantity, action, reference_type, reference_id, note, created_by)
                VALUES (?, ?, ?, 'dispense', 'appointment', ?, ?, NULL)`,
                [item.drug_id, batch.id, -take, appointmentId, `Dispense từ payment #${paymentId}`]
            );

            remaining -= take;
        }

        affectedDrugIds.add(item.drug_id);
    }

    for (const drugId of affectedDrugIds) {
        const [batchSumResult] = await connection.execute(
            `SELECT COALESCE(SUM(quantity), 0) as total_qty
             FROM drug_batches
             WHERE drug_id = ? AND is_deleted = 0`,
            [drugId]
        );
        const totalQty = Number(batchSumResult[0]?.total_qty || 0);

        const [medRows] = await connection.execute(
            'SELECT id FROM medicines WHERE drug_id = ? LIMIT 1',
            [drugId]
        );

        if (medRows.length > 0) {
            await connection.execute(
                'UPDATE medicines SET quantity = ? WHERE drug_id = ?',
                [totalQty, drugId]
            );
        }
    }
}

module.exports = { dispenseForAppointment };
