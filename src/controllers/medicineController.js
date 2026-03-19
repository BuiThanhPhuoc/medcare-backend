const db = require('../config/db');

// 1. Lấy danh sách toàn bộ thuốc trong kho
const getAllMedicines = async (req, res) => {
    try {
        const [medicines] = await db.execute('SELECT * FROM medicines ORDER BY name ASC');
        res.status(200).json({ medicines });
    } catch (error) {
        console.error("Lỗi lấy danh sách thuốc:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 2. Thêm thuốc mới (Nhập kho)
const addMedicine = async (req, res) => {
    try {
        const { name, quantity, price, import_price, expiry_date } = req.body;

        if (!name || !price || !import_price || !expiry_date) {
            return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin thuốc!" });
        }

        await db.execute(
            'INSERT INTO medicines (name, quantity, price, import_price, expiry_date) VALUES (?, ?, ?, ?, ?)',
            [name, quantity || 0, price, import_price, expiry_date]
        );

        res.status(201).json({ message: "Thêm thuốc vào kho thành công!" });
    } catch (error) {
        console.error("Lỗi thêm thuốc:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 3. Cập nhật thông tin thuốc (Sửa giá, Cập nhật số lượng)
const updateMedicine = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, quantity, price, import_price, expiry_date } = req.body;

        await db.execute(
            'UPDATE medicines SET name = ?, quantity = ?, price = ?, import_price = ?, expiry_date = ? WHERE id = ?',
            [name, quantity, price, import_price, expiry_date, id]
        );

        res.status(200).json({ message: "Cập nhật thông tin thuốc thành công!" });
    } catch (error) {
        console.error("Lỗi cập nhật thuốc:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

// 4. Xóa thuốc
const deleteMedicine = async (req, res) => {
    try {
        const { id } = req.params;

        await db.execute('DELETE FROM medicines WHERE id = ?', [id]);

        res.status(200).json({ message: "Xóa thuốc thành công!" });
    } catch (error) {
        console.error("Lỗi xóa thuốc:", error);
        res.status(500).json({ message: "Lỗi server!" });
    }
};

module.exports = { getAllMedicines, addMedicine, updateMedicine, deleteMedicine };