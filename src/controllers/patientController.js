const db = require('../config/db');

const BHYT_REGEX = /^[A-Z]{2}\d{8}$/;

const toNullable = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};

function normalizeBhyt(code) {
    if (code === undefined || code === null) return null;
    const s = String(code).trim().replace(/\s/g, '');
    return s === '' ? null : s.toUpperCase();
}

function digitsOnly(s) {
    return String(s || '').replace(/\D/g, '');
}

function validateIdDocument(idDocType, idNumberRaw) {
    const digits = digitsOnly(idNumberRaw);
    if (!digits && !idDocType) return { ok: true, digits: null };
    if (!idDocType) {
        return { ok: false, message: 'Vui lòng chọn loại giấy tờ (CMND / CCCD).' };
    }
    if (!digits) {
        return { ok: false, message: 'Vui lòng nhập số CCCD/CMND.' };
    }
    if (idDocType === 'CCCD') {
        if (digits.length !== 12) return { ok: false, message: 'CCCD phải gồm 12 chữ số' };
        return { ok: true, digits };
    }
    if (idDocType === 'CMND') {
        if (digits.length !== 9 && digits.length !== 12) {
            return { ok: false, message: 'CMND phải gồm 9 hoặc 12 chữ số' };
        }
        return { ok: true, digits };
    }
    return { ok: true, digits };
}

// Lấy đúng 1 bản ghi patients mới nhất / duy nhất theo user_id
const patientProfileJoin = `
    LEFT JOIN patients p ON p.user_id = u.id AND p.id = (
        SELECT MAX(p2.id) FROM patients p2 WHERE p2.user_id = u.id
    )
`;

// Get patient profile
const getPatientProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const [patients] = await db.execute(
            `
            SELECT
                p.id as patient_id,
                u.id as user_id,
                u.username,
                u.email,
                u.phone,
                COALESCE(p.full_name, '') as full_name,
                p.avatar,
                p.date_of_birth,
                p.gender,
                p.address,
                p.medical_history,
                p.allergies,
                p.blood_type,
                p.height,
                p.weight,
                p.chronic_disease,
                p.current_medications,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                p.emergency_contact_relationship,
                p.id_document_type,
                p.id_number,
                p.health_insurance_code,
                p.current_health_status,
                p.notes,
                p.occupation,
                p.hobbies,
                u.status
            FROM users u
            ${patientProfileJoin}
            WHERE u.id = ? AND u.role = 'patient'
            `,
            [userId]
        );

        if (patients.length === 0) return res.status(404).json({ message: "Không tìm thấy thông tin bệnh nhân!" });

        return res.status(200).json({ patient: patients[0] });
    } catch (error) {
        console.error('Lỗi lấy thông tin bệnh nhân:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// Update patient profile with avatar upload
const updatePatientProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            email,
            phone,
            full_name,
            date_of_birth,
            gender,
            address,
            medical_history,
            allergies,
            blood_type,
            height,
            weight,
            chronic_disease,
            current_medications,
            emergency_contact_name,
            emergency_contact_phone,
            emergency_contact_relationship,
            id_number,
            health_insurance_code,
            current_health_status,
            notes,
            occupation,
            hobbies
        } = req.body;
        const id_document_type = req.body.id_document_type;
        const avatarProvided = String(req.body.avatarProvided || '0') === '1';

        if (!email || !phone || !full_name) {
            return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
        }

        const idVal = validateIdDocument(id_document_type, id_number);
        if (!idVal.ok) {
            return res.status(400).json({ message: idVal.message });
        }

        const bhytNorm = normalizeBhyt(health_insurance_code);
        if (bhytNorm && !BHYT_REGEX.test(bhytNorm)) {
            return res.status(400).json({ message: 'Mã BHYT không hợp lệ' });
        }

        const [emailCheck] = await db.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );
        if (emailCheck.length > 0) {
            return res.status(409).json({ message: "Email này đã được sử dụng!" });
        }

        const [userUpdateResult] = await db.execute(
            'UPDATE users SET email = ?, phone = ? WHERE id = ? AND role = "patient"',
            [email, phone, userId]
        );

        if (userUpdateResult.affectedRows === 0) {
            return res.status(404).json({ message: "Không thể cập nhật thông tin bệnh nhân!" });
        }

        const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;

        if (avatarProvided && !avatarPath) {
            return res.status(400).json({ message: 'Không nhận được file avatar từ request!' });
        }

        const idDigitsStored = idVal.digits != null ? idVal.digits : toNullable(id_number);
        const idTypeStored = toNullable(id_document_type);

        const [existing] = await db.execute(
            'SELECT id FROM patients WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [userId]
        );

        const commonFields = [
            full_name,
            toNullable(date_of_birth),
            toNullable(gender),
            toNullable(address),
            toNullable(medical_history),
            toNullable(allergies),
            toNullable(blood_type),
            toNullable(height),
            toNullable(weight),
            toNullable(chronic_disease),
            toNullable(current_medications),
            toNullable(emergency_contact_name),
            toNullable(emergency_contact_phone),
            toNullable(emergency_contact_relationship),
            idTypeStored,
            idDigitsStored,
            bhytNorm,
            toNullable(current_health_status),
            toNullable(notes),
            toNullable(occupation),
            toNullable(hobbies)
        ];

        if (existing.length > 0) {
            let sql = `
                UPDATE patients SET
                    full_name = ?,
                    date_of_birth = ?,
                    gender = ?,
                    address = ?,
                    medical_history = ?,
                    allergies = ?,
                    blood_type = ?,
                    height = ?,
                    weight = ?,
                    chronic_disease = ?,
                    current_medications = ?,
                    emergency_contact_name = ?,
                    emergency_contact_phone = ?,
                    emergency_contact_relationship = ?,
                    id_document_type = ?,
                    id_number = ?,
                    health_insurance_code = ?,
                    current_health_status = ?,
                    notes = ?,
                    occupation = ?,
                    hobbies = ?
            `;
            const params = [...commonFields];
            if (avatarPath) {
                sql += `, avatar = ?`;
                params.push(avatarPath);
            }
            sql += ` WHERE user_id = ?`;
            params.push(userId);
            await db.execute(sql, params);
        } else {
            const cols = ['user_id', 'full_name'];
            const insertVals = [userId, full_name];
            if (avatarPath) {
                cols.push('avatar');
                insertVals.push(avatarPath);
            }
            cols.push(
                'date_of_birth', 'gender', 'address', 'medical_history', 'allergies',
                'blood_type', 'height', 'weight', 'chronic_disease', 'current_medications',
                'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
                'id_document_type', 'id_number', 'health_insurance_code',
                'current_health_status', 'notes', 'occupation', 'hobbies'
            );
            insertVals.push(
                toNullable(date_of_birth),
                toNullable(gender),
                toNullable(address),
                toNullable(medical_history),
                toNullable(allergies),
                toNullable(blood_type),
                toNullable(height),
                toNullable(weight),
                toNullable(chronic_disease),
                toNullable(current_medications),
                toNullable(emergency_contact_name),
                toNullable(emergency_contact_phone),
                toNullable(emergency_contact_relationship),
                idTypeStored,
                idDigitsStored,
                bhytNorm,
                toNullable(current_health_status),
                toNullable(notes),
                toNullable(occupation),
                toNullable(hobbies)
            );
            const placeholders = cols.map(() => '?').join(', ');
            await db.execute(
                `INSERT INTO patients (${cols.join(', ')}) VALUES (${placeholders})`,
                insertVals
            );
        }

        const [updated] = await db.execute(
            `
            SELECT
                p.id as patient_id,
                u.id as user_id,
                u.username,
                u.email,
                u.phone,
                COALESCE(p.full_name, '') as full_name,
                p.avatar,
                p.date_of_birth,
                p.gender,
                p.address,
                p.medical_history,
                p.allergies,
                p.blood_type,
                p.height,
                p.weight,
                p.chronic_disease,
                p.current_medications,
                p.emergency_contact_name,
                p.emergency_contact_phone,
                p.emergency_contact_relationship,
                p.id_document_type,
                p.id_number,
                p.health_insurance_code,
                p.current_health_status,
                p.notes,
                p.occupation,
                p.hobbies,
                u.status
            FROM users u
            ${patientProfileJoin}
            WHERE u.id = ? AND u.role = 'patient'
            `,
            [userId]
        );

        return res.status(200).json({
            message: "Cập nhật thông tin thành công!",
            patient: updated[0]
        });
    } catch (error) {
        console.error('Lỗi cập nhật thông tin bệnh nhân:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// Get patient stats
const getPatientStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const [patients] = await db.execute(
            'SELECT id FROM patients WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [userId]
        );

        if (patients.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy thông tin bệnh nhân!" });
        }

        const patientId = patients[0].id;

        const [upcomingAppointments] = await db.execute(
            `SELECT COUNT(*) as count FROM appointments 
             WHERE patient_id = ? AND status NOT IN ('completed', 'cancelled') 
             AND CONCAT(appointment_date, ' ', appointment_time) > NOW()`,
            [patientId]
        );

        const [totalRecords] = await db.execute(
            `SELECT COUNT(*) as count FROM medical_records 
             WHERE appointment_id IN (
                SELECT id FROM appointments WHERE patient_id = ?
             )`,
            [patientId]
        );

        const [totalPrescriptions] = await db.execute(
            `SELECT COUNT(*) as count FROM prescriptions 
             WHERE appointment_id IN (
                SELECT id FROM appointments WHERE patient_id = ?
             )`,
            [patientId]
        );

        const [completedAppointments] = await db.execute(
            `SELECT COUNT(*) as count FROM appointments 
             WHERE patient_id = ? AND status = 'completed'`,
            [patientId]
        );

        return res.status(200).json({
            stats: {
                upcomingAppointments: upcomingAppointments[0]?.count || 0,
                totalRecords: totalRecords[0]?.count || 0,
                totalPrescriptions: totalPrescriptions[0]?.count || 0,
                completedAppointments: completedAppointments[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Lỗi lấy stats bệnh nhân:', error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { getPatientProfile, updatePatientProfile, getPatientStats };
