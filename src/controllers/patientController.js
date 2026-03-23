const db = require('../config/db');

// Get patient profile
const getPatientProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        // Lấy thông tin bệnh nhân từ `users`, và ghép thêm thông tin chi tiết nếu có trong `patients`
        // (LEFT JOIN để tránh 404 khi người dùng đã có role patient nhưng chưa có bản ghi trong `patients`)
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
                u.status
            FROM users u
            LEFT JOIN patients p ON p.user_id = u.id
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
            allergies
        } = req.body;
        const avatarProvided = String(req.body.avatarProvided || '0') === '1';

        const toNullable = (v) => {
            if (v === undefined || v === null) return null;
            const s = String(v).trim();
            return s === '' ? null : s;
        };

        const dob = toNullable(date_of_birth);
        const genderValue = toNullable(gender);
        const addressValue = toNullable(address);
        const medicalHistoryValue = toNullable(medical_history);
        const allergiesValue = toNullable(allergies);

        if (!email || !phone || !full_name) {
            return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
        }

        // Check email not duplicate (excluding current user)
        const [emailCheck] = await db.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );
        if (emailCheck.length > 0) {
            return res.status(409).json({ message: "Email này đã được sử dụng!" });
        }

        // Update email/phone trong bảng users
        const [userUpdateResult] = await db.execute(
            'UPDATE users SET email = ?, phone = ? WHERE id = ? AND role = "patient"',
            [email, phone, userId]
        );

        if (userUpdateResult.affectedRows === 0) {
            return res.status(404).json({ message: "Không thể cập nhật thông tin bệnh nhân!" });
        }

        // Update/upsert thông tin chi tiết trong bảng patients
        const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;

        // Nếu frontend đã chọn avatar nhưng multer không nhận được file => coi như upload thất bại
        if (avatarProvided && !avatarPath) {
            return res.status(400).json({ message: 'Không nhận được file avatar từ request!' });
        }

        if (avatarPath) {
            await db.execute(
                `
                INSERT INTO patients (user_id, full_name, avatar, date_of_birth, gender, address, medical_history, allergies)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    full_name = VALUES(full_name),
                    avatar = VALUES(avatar),
                    date_of_birth = VALUES(date_of_birth),
                    gender = VALUES(gender),
                    address = VALUES(address),
                    medical_history = VALUES(medical_history),
                    allergies = VALUES(allergies)
                `,
                [
                    userId,
                    full_name,
                    avatarPath,
                    dob,
                    genderValue,
                    addressValue,
                    medicalHistoryValue,
                    allergiesValue
                ]
            );
        } else {
            await db.execute(
                `
                INSERT INTO patients (user_id, full_name, date_of_birth, gender, address, medical_history, allergies)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    full_name = VALUES(full_name),
                    date_of_birth = VALUES(date_of_birth),
                    gender = VALUES(gender),
                    address = VALUES(address),
                    medical_history = VALUES(medical_history),
                    allergies = VALUES(allergies)
                `,
                [
                    userId,
                    full_name,
                    dob,
                    genderValue,
                    addressValue,
                    medicalHistoryValue,
                    allergiesValue
                ]
            );
        }

        // Fetch updated data (tương tự getPatientProfile)
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
                u.status
            FROM users u
            LEFT JOIN patients p ON p.user_id = u.id
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

module.exports = { getPatientProfile, updatePatientProfile };
