const db = require('../config/db');
const fs = require('fs');
const xlsx = require('xlsx');

const normalizeHeader = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ');
    return str;
};

const parseNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;

    // Remove currency symbols and spaces, keep digits, dot, comma, minus
    let cleaned = raw.replace(/[^0-9.,-]/g, '');
    if (!cleaned) return null;

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    // If comma is the decimal separator (common in VN: 1.234,56)
    if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, ''); // remove thousands '.'
        cleaned = cleaned.replace(',', '.'); // comma -> dot
    } else {
        // Assume dot is decimal separator, remove commas as thousands separators
        cleaned = cleaned.replace(/,/g, '');
    }

    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
};

const pad2 = (n) => String(n).padStart(2, '0');

const dateToYMD = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    return `${y}-${m}-${d}`;
};

const parseExcelDateToYMD = (value) => {
    if (value === null || value === undefined || value === '') return null;

    // If xlsx gives JS Date
    if (value instanceof Date) return dateToYMD(value);

    // Excel serial date (number)
    if (typeof value === 'number') {
        const parsed = xlsx.SSF.parse_date_code(value);
        if (!parsed) return null;
        // Avoid timezone shifting by using parsed y/m/d directly
        return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
    }

    if (typeof value === 'string') {
        const s = value.trim();
        if (!s) return null;

        // YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

        // DD/MM/YYYY or DD-MM-YYYY
        if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(s)) {
            const parts = s.split(/[/-]/).map((p) => parseInt(p, 10));
            const [dd, mm, yyyy] = parts;
            if (!yyyy || !mm || !dd) return null;
            return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
        }

        const dt = new Date(s);
        return dateToYMD(dt);
    }

    return null;
};

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

<<<<<<< HEAD
// 5) Import thuốc từ file Excel
// Expected columns (header): name, quantity, import_price, price, expiry_date
// mode: merge (default), replace, skip
const importMedicinesFromExcel = async (req, res) => {
    const file = req.file;
    const modeRaw = req.body?.mode;
    const mode = ['merge', 'replace', 'skip'].includes(modeRaw) ? modeRaw : 'merge';

    if (!file) return res.status(400).json({ message: "Chưa nhận được file upload!" });

    const filePath = file.path;
    let workbook;
    try {
        workbook = xlsx.readFile(filePath);
    } catch (e) {
        return res.status(400).json({ message: "File Excel không hợp lệ hoặc không đọc được!" });
    }

    try {
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) return res.status(400).json({ message: "Không tìm thấy sheet trong file Excel!" });

        const sheet = workbook.Sheets[sheetName];

        // Read as 2D array: first row is header
        const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headerRow = aoa?.[0] ?? [];
        const dataRows = aoa?.slice(1) ?? [];

        const headersNormalized = headerRow.map((h) => normalizeHeader(h));

        const idxName = headersNormalized.findIndex((h) => h.includes('name') || h.includes('ten thuoc') || h === 'ten thuoc');
        const idxQuantity = headersNormalized.findIndex((h) => h.includes('quantity') || h.includes('so luong') || h === 'so luong');
        const idxImportPrice = headersNormalized.findIndex((h) => h.includes('import_price') || h.includes('gia nhap') || h.includes('giá nhap'));
        const idxPrice = headersNormalized.findIndex((h) => h === 'price' || h.includes('gia ban') || h.includes('gia ban') || h.includes('giá ban'));
        const idxExpiryDate = headersNormalized.findIndex((h) => h.includes('expiry_date') || h.includes('han su dung') || h.includes('hansudung') || h.includes('expiry'));

        if (idxName < 0 || idxQuantity < 0 || idxImportPrice < 0 || idxPrice < 0 || idxExpiryDate < 0) {
            return res.status(400).json({
                message: "Thiếu cột trong Excel. Yêu cầu: name, quantity, import_price, price, expiry_date."
            });
        }

        // Group by medicine name (normalized key) to handle duplicates in the same file
        const grouped = new Map();
        const errors = [];

        const pushError = (rowIndex1Based, message) => {
            errors.push({ row: rowIndex1Based, message });
        };

        dataRows.forEach((row, i) => {
            const rowIndex1Based = i + 2; // +1 header row
            const rawName = String(row[idxName] ?? '').trim();
            if (!rawName) return;

            const quantity = parseNumber(row[idxQuantity]);
            const import_price = parseNumber(row[idxImportPrice]);
            const price = parseNumber(row[idxPrice]);
            const expiry_date = parseExcelDateToYMD(row[idxExpiryDate]);

            const nameKey = rawName.toLowerCase();

            const rowErrors = [];
            if (!Number.isFinite(quantity) || quantity < 0 || Math.floor(quantity) !== quantity) rowErrors.push("quantity phải là số nguyên >= 0");
            if (!Number.isFinite(import_price) || import_price < 0) rowErrors.push("import_price phải là số >= 0");
            if (!Number.isFinite(price) || price < 0) rowErrors.push("price phải là số >= 0");
            if (!expiry_date) rowErrors.push("expiry_date không hợp lệ (YYYY-MM-DD)");

            if (rowErrors.length > 0) {
                pushError(rowIndex1Based, rowErrors.join('; '));
                return;
            }

            if (!grouped.has(nameKey)) {
                grouped.set(nameKey, {
                    nameKey,
                    name: rawName,
                    quantity: 0,
                    import_price,
                    price,
                    expiry_date
                });
            }

            const item = grouped.get(nameKey);
            if (mode === 'merge') {
                item.quantity += quantity;
                // keep last valid prices/dates from the file
                item.import_price = import_price;
                item.price = price;
                item.expiry_date = expiry_date;
            } else if (mode === 'replace') {
                // overwrite: just take the last row's values
                item.quantity = quantity;
                item.import_price = import_price;
                item.price = price;
                item.expiry_date = expiry_date;
            } else if (mode === 'skip') {
                // keep first
                // do nothing
            }
        });

        if (grouped.size === 0) {
            return res.status(400).json({ message: "Không có dữ liệu thuốc hợp lệ để import." });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        try {
            for (const [, item] of grouped.entries()) {
                const { name, quantity, import_price, price, expiry_date } = item;

                const [existing] = await connection.execute(
                    'SELECT id, quantity FROM medicines WHERE name = ? ORDER BY id ASC',
                    [name]
                );

                if (!existing || existing.length === 0) {
                    if (mode === 'skip') {
                        skipped += 1;
                        continue;
                    }
                    await connection.execute(
                        'INSERT INTO medicines (name, quantity, price, import_price, expiry_date) VALUES (?, ?, ?, ?, ?)',
                        [name, quantity, price, import_price, expiry_date]
                    );
                    inserted += 1;
                    continue;
                }

                if (mode === 'skip') {
                    skipped += 1;
                    continue;
                }

                const first = existing[0];
                const otherIds = existing.slice(1).map((r) => r.id);

                let newQuantity = quantity;
                if (mode === 'merge') {
                    const sumExistingQty = existing.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
                    newQuantity = sumExistingQty + quantity;
                }

                await connection.execute(
                    'UPDATE medicines SET quantity = ?, price = ?, import_price = ?, expiry_date = ? WHERE id = ?',
                    [newQuantity, price, import_price, expiry_date, first.id]
                );

                if (otherIds.length > 0) {
                    const placeholders = otherIds.map(() => '?').join(',');
                    await connection.execute(`DELETE FROM medicines WHERE id IN (${placeholders})`, otherIds);
                }

                updated += 1;
            }

            await connection.commit();
        } catch (dbErr) {
            await connection.rollback();
            console.error("Lỗi import medicine:", dbErr);
            return res.status(500).json({ message: "Lỗi server khi import dữ liệu." });
        } finally {
            connection.release();
        }

        return res.status(200).json({
            message: "Import thuốc thành công!",
            summary: { inserted, updated, skipped, errors: errors.length },
            errors: errors.slice(0, 30) // hạn chế payload
        });
    } catch (e) {
        console.error("Lỗi import excel:", e);
        return res.status(500).json({ message: "Lỗi server khi xử lý Excel." });
    } finally {
        // Cleanup uploaded file
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            // ignore
        }
    }
};

// 6) Tải mẫu Excel import thuốc
const downloadMedicineTemplate = async (req, res) => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
        ['name', 'quantity', 'import_price', 'price', 'expiry_date'],
        ['Paracetamol 500mg', 1000, 500, 2000, '2028-12-31'],
        ['Amoxicillin 500mg', 200, 800, 1500, '2027-06-15']
    ]);

    ws['!cols'] = [
        { wch: 30 },
        { wch: 12 },
        { wch: 14 },
        { wch: 10 },
        { wch: 14 }
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Medicines');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=medicine_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
};

module.exports = {
    getAllMedicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    importMedicinesFromExcel,
    downloadMedicineTemplate
};
=======
module.exports = { getAllMedicines, addMedicine, updateMedicine, deleteMedicine };
>>>>>>> 6c7f697c9d77efeae9874b188addb03cfb6d5a99
