const db = require('../config/db');

const examinePatient = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const userId = req.user.id; 
        const { appointment_id, diagnosis, prescription, note, prescription_items } = req.body;

        if (!appointment_id || !diagnosis) {
            return res.status(400).json({ message: "Vui lòng nhập mã lịch khám và chẩn đoán bệnh!" });
        }

        // 0. Lấy doctor_id từ user_id
        const [doctorRows] = await db.execute('SELECT id FROM doctors WHERE user_id = ?', [userId]);
        if (doctorRows.length === 0) {
            return res.status(404).json({ message: "Bác sĩ chưa có hồ sơ thông tin!" });
        }
        
        const doctorId = doctorRows[0].id;

        // 1. Kiểm tra lịch khám có tồn tại, có đúng của bác sĩ này và đang ở trạng thái "checked-in" không?
        const [appointments] = await db.execute(
            'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?',
            [appointment_id, doctorId]
        );

        if (appointments.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy lịch khám này hoặc bạn không phụ trách ca này!" });
        }

        const appointment = appointments[0];

        // Áp dụng đúng luật bạn vạch ra: Chỉ khám khi đã check-in
        if (appointment.status !== 'checked-in') {
            return res.status(400).json({ message: "Bệnh nhân chưa check-in hoặc ca khám đã kết thúc!" });
        }

        await connection.beginTransaction();

        // 2) Chuẩn hóa đơn thuốc theo bảng prescriptions + prescription_items (Stage 2)
        // Đồng thời vẫn lưu prescription dạng text để tương thích UI cũ/lịch sử cũ.
        let normalizedPrescriptionText = prescription || '';
        const items = Array.isArray(prescription_items) ? prescription_items : [];
        if (items.length > 0) {
            const [prescriptionResult] = await connection.execute(
                'INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, notes) VALUES (?, ?, ?, ?, ?)',
                [appointment_id, appointment.patient_id, doctorId, diagnosis, note || null]
            );
            const prescriptionId = prescriptionResult.insertId;

            const lines = [];
            for (const rawItem of items) {
                const drugId = Number(rawItem.drug_id);
                const quantity = Number(rawItem.quantity);
                const dosage = String(rawItem.dosage || '').trim();
                const duration = rawItem.duration ? String(rawItem.duration).trim() : null;
                const instructions = rawItem.instructions ? String(rawItem.instructions).trim() : null;

                if (!Number.isFinite(drugId) || drugId <= 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: "drug_id không hợp lệ trong đơn thuốc." });
                }
                if (!Number.isFinite(quantity) || quantity <= 0) {
                    await connection.rollback();
                    return res.status(400).json({ message: "quantity phải > 0 trong đơn thuốc." });
                }
                if (!dosage) {
                    await connection.rollback();
                    return res.status(400).json({ message: "dosage là bắt buộc trong đơn thuốc." });
                }

                const [drugRows] = await connection.execute(
                    'SELECT id, name FROM drugs WHERE id = ? AND is_deleted = 0',
                    [drugId]
                );
                if (drugRows.length === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: `Không tìm thấy thuốc drug_id=${drugId}.` });
                }

                // Chụp giá tại thời điểm kê: ưu tiên FEFO batch còn tồn, fallback 0.
                let priceAtTime = Number(rawItem.price_at_time);
                if (!Number.isFinite(priceAtTime) || priceAtTime < 0) {
                    const [priceRows] = await connection.execute(
                        `SELECT selling_price
                         FROM drug_batches
                         WHERE drug_id = ? AND is_deleted = 0 AND quantity > 0
                         ORDER BY expiry_date ASC, id ASC
                         LIMIT 1`,
                        [drugId]
                    );
                    priceAtTime = priceRows.length > 0 ? Number(priceRows[0].selling_price || 0) : 0;
                }

                await connection.execute(
                    `INSERT INTO prescription_items
                    (prescription_id, drug_id, dosage, quantity, duration, instructions, price_at_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [prescriptionId, drugId, dosage, quantity, duration, instructions, priceAtTime]
                );

                const line = `${drugRows[0].name} - ${dosage} - SL ${quantity}${duration ? ` - ${duration}` : ''}`;
                lines.push(line);
            }
            normalizedPrescriptionText = lines.join('\n');
        }

        // 3. Lưu hồ sơ khám bệnh vào bảng medical_records
        await connection.execute(
            'INSERT INTO medical_records (appointment_id, diagnosis, prescription, note) VALUES (?, ?, ?, ?)',
            [appointment_id, diagnosis, normalizedPrescriptionText, note || 'Không có ghi chú']
        );

        // 4. Cập nhật trạng thái lịch khám thành "completed" (Đã khám xong)
        await connection.execute(
            'UPDATE appointments SET status = "completed" WHERE id = ?',
            [appointment_id]
        );

        await connection.commit();

        res.status(201).json({ message: "Hoàn thành khám bệnh và lưu hồ sơ thành công!" });

    } catch (error) {
        try { await connection.rollback(); } catch (e) {}
        console.error("Lỗi khám bệnh:", error);
        res.status(500).json({ message: "Lỗi server khi lưu hồ sơ bệnh án!" });
    } finally {
        connection.release();
    }
};


const getPatientHistory = async (req, res) => {
    try {
        const patientId = req.user.id; // Lấy ID bệnh nhân từ token

        // Query kết hợp bảng: appointments, doctors, users, medical_records
        const [history] = await db.execute(`
            SELECT 
                a.id AS appointment_id,
                a.appointment_date,
                a.appointment_time,
                u.username AS doctor_name,
                mr.diagnosis,
                mr.prescription,
                mr.note,
                a.payment_status
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            LEFT JOIN medical_records mr ON a.id = mr.appointment_id
            WHERE p.user_id = ? AND a.status = 'completed'
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
        `, [patientId]);

        if (history.length === 0) {
            return res.status(200).json({ message: "Bạn chưa có lịch sử khám bệnh nào.", history: [] });
        }

        res.status(200).json({ history });

    } catch (error) {
        console.error("Lỗi lấy lịch sử khám:", error);
        res.status(500).json({ message: "Lỗi server khi lấy hồ sơ bệnh án!" });
    }
};

// API: Bệnh nhân xem lịch sử khám và toa thuốc của chính mình
const getMyMedicalRecords = async (req, res) => {
    try {
        const patientId = req.user.id; 
        
        // Nối bảng: Bệnh án + Lịch khám + Bác sĩ + User để lấy đủ thông tin
        const [records] = await db.execute(`
            SELECT m.id, m.diagnosis, m.prescription, m.note, a.appointment_date, u.username AS doctor_name
            FROM medical_records m
            JOIN appointments a ON m.appointment_id = a.id
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            JOIN users u ON d.user_id = u.id
            WHERE p.user_id = ?
            ORDER BY a.appointment_date DESC
        `, [patientId]);

        res.status(200).json({ records });
    } catch (error) {
        console.error("Lỗi lấy bệnh án:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { examinePatient, getPatientHistory, getMyMedicalRecords };