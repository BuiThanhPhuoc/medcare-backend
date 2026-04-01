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
        const { calculatePagination, createPaginatedResponse } = require('../utils/paginationUtils');
        const pagination = calculatePagination(req.query.page, req.query.limit);
        const { search, category } = req.query;

        // Prefer compatibility view if present, otherwise use actual table
        const getEffectiveTable = async (viewName, tableName) => {
            try {
                const [[{ cnt }]] = await db.query(
                    'SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
                    [process.env.DB_NAME, viewName]
                );
                return cnt > 0 ? viewName : tableName;
            } catch (e) {
                return tableName;
            }
        };

        const medicinesSource = await getEffectiveTable('medicines_compat', 'medicines');
        const usingCompat = medicinesSource === 'medicines_compat';

        // Build WHERE clause
        let whereClause = 'WHERE 1=1';
        let params = [];

        if (search) {
            if (usingCompat) {
                whereClause += ' AND (medicine_name LIKE ? OR dosage LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            } else {
                whereClause += ' AND (name LIKE ?)';
                params.push(`%${search}%`);
            }
        }

        if (category) {
            if (usingCompat) {
                whereClause += ' AND category_id = ?';
                params.push(category);
            } else {
                // No category column in current medicines table; ignore filter
            }
        }

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM ${medicinesSource} ${whereClause}`;
        const [[{ total }]] = await db.query(countQuery, params);

        // Get paginated data
        const orderBy = usingCompat ? 'medicine_name' : 'name';
        const dataQuery = `
            SELECT * FROM ${medicinesSource}
            ${whereClause}
            ORDER BY ${orderBy} ASC
            LIMIT ? OFFSET ?
        `;
        const [medicines] = await db.query(dataQuery, [...params, pagination.limit, pagination.offset]);

        // Return shape expected by frontend: { success, medicines, pagination }
        res.status(200).json({
            success: true,
            medicines,
            pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total,
                hasNextPage: pagination.page * pagination.limit < total,
                hasPrevPage: pagination.page > 1
            }
        });
    } catch (error) {
        console.error("Lỗi lấy danh sách thuốc:", error);
        res.status(500).json({ success: false, message: "Lỗi server!", error: error.message });
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

// =============================
// Stage 1: drugs + drug_batches
// =============================
const getDrugsWithStock = async (req, res) => {
    try {
        const searchRaw = req.query.search ? String(req.query.search).trim() : '';
        const search = searchRaw ? `%${searchRaw}%` : null;
        const limitRaw = req.query.limit ? Number(req.query.limit) : null;
        const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : null;

        const params = [];
        let whereClause = 'WHERE d.is_deleted = 0';
        if (search) {
            whereClause += ' AND (d.name LIKE ? OR d.generic_name LIKE ?)';
            params.push(search, search);
        }

        const hasSearch = Boolean(search);
        const orderBy = limit
            ? // Nếu gọi autocomplete (có limit) -> ưu tiên sắp gần hết hạn / còn hàng
              'ORDER BY (MIN(CASE WHEN b.is_deleted = 0 AND b.quantity > 0 THEN b.expiry_date END) IS NULL) ASC, MIN(CASE WHEN b.is_deleted = 0 AND b.quantity > 0 THEN b.expiry_date END) ASC, total_quantity DESC, d.name ASC'
            : hasSearch
              ? 'ORDER BY d.name ASC'
              : 'ORDER BY d.name ASC';

        const limitClause = limit ? ' LIMIT ?' : '';
        if (limit) params.push(limit);

        const sql = `
            SELECT
                d.id,
                d.name,
                d.generic_name,
                d.strength,
                d.dosage_form,
                d.prescription_required,
                d.is_active,
                d.is_deleted,
                COALESCE(SUM(CASE WHEN b.is_deleted = 0 THEN b.quantity ELSE 0 END), 0) AS total_quantity,
                MIN(CASE WHEN b.is_deleted = 0 AND b.quantity > 0 THEN b.expiry_date END) AS nearest_expiry
            FROM drugs d
            LEFT JOIN drug_batches b ON b.drug_id = d.id
            ${whereClause}
            GROUP BY d.id
            ${orderBy}
            ${limitClause}
        `;

        const [rows] = await db.execute(sql, params);
        return res.status(200).json({ drugs: rows });
    } catch (error) {
        console.error('Lỗi lấy danh sách drugs:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const createDrug = async (req, res) => {
    try {
        const {
            name,
            generic_name,
            strength,
            dosage_form,
            description,
            prescription_required
        } = req.body;

        if (!name) return res.status(400).json({ message: 'Tên thuốc là bắt buộc.' });

        const [exists] = await db.execute(
            'SELECT id FROM drugs WHERE name = ? AND is_deleted = 0 LIMIT 1',
            [name.trim()]
        );
        if (exists.length > 0) {
            return res.status(409).json({ message: 'Thuốc đã tồn tại trong danh mục.' });
        }

        const [result] = await db.execute(
            `INSERT INTO drugs
            (name, generic_name, strength, dosage_form, prescription_required)
            VALUES (?, ?, ?, ?, ?)`,
            [
                name.trim(),
                generic_name || null,
                strength || null,
                dosage_form || null,
                prescription_required ? 1 : 0
            ]
        );

        return res.status(201).json({ message: 'Tạo thuốc thành công!', id: result.insertId });
    } catch (error) {
        console.error('Lỗi tạo drug:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getDrugBatches = async (req, res) => {
    try {
        const { drugId } = req.params;
        const [rows] = await db.execute(
            `SELECT id, drug_id, batch_number, manufacture_date, expiry_date, quantity, import_price, selling_price, created_at
             FROM drug_batches
             WHERE drug_id = ? AND is_deleted = 0
             ORDER BY expiry_date ASC, id ASC`,
            [drugId]
        );
        return res.status(200).json({ batches: rows });
    } catch (error) {
        console.error('Lỗi lấy batches:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const addDrugBatch = async (req, res) => {
    try {
        const { drugId } = req.params;
        const { batch_number, manufacture_date, expiry_date, quantity, import_price, selling_price } = req.body;

        if (!batch_number || !expiry_date) {
            return res.status(400).json({ message: 'batch_number và expiry_date là bắt buộc.' });
        }

        const qty = Number(quantity ?? 0);
        const importPriceNum = Number(import_price ?? 0);
        let sellingPriceNum = Number(selling_price ?? 0);
        if (!Number.isFinite(sellingPriceNum) || sellingPriceNum < 0) sellingPriceNum = 0;
        if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ message: 'quantity không hợp lệ.' });
        if (!Number.isFinite(importPriceNum) || importPriceNum < 0) return res.status(400).json({ message: 'import_price không hợp lệ.' });

        const [drugs] = await db.execute('SELECT id, name FROM drugs WHERE id = ? AND is_deleted = 0', [drugId]);
        if (drugs.length === 0) return res.status(404).json({ message: 'Không tìm thấy thuốc.' });

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Insert vào drug_batches
            const [result] = await connection.execute(
                `INSERT INTO drug_batches
                (drug_id, batch_number, manufacture_date, expiry_date, quantity, import_price, selling_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [drugId, batch_number.trim(), manufacture_date || null, expiry_date, qty, importPriceNum, sellingPriceNum]
            );

            // 2. Tính tổng quantity từ tất cả batch của drug này
            const [batchSum] = await connection.execute(
                `SELECT COALESCE(SUM(quantity), 0) as total_qty FROM drug_batches 
                 WHERE drug_id = ? AND is_deleted = 0`,
                [drugId]
            );
            const totalQty = batchSum[0]?.total_qty || 0;

            // 3. Cập nhật hoặc tạo mới medicines record
            const [existsMed] = await connection.execute(
                `SELECT id FROM medicines WHERE drug_id = ? LIMIT 1`,
                [drugId]
            );

            if (existsMed.length > 0) {
                await connection.execute(
                    `UPDATE medicines SET quantity = ? WHERE drug_id = ?`,
                    [totalQty, drugId]
                );
            } else {
                // Tạo medicines entry mới
                const drugName = drugs[0].name;
                await connection.execute(
                    `INSERT INTO medicines (drug_id, name, quantity, price, import_price, expiry_date)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [drugId, drugName, totalQty, importPriceNum, importPriceNum, expiry_date]
                );
            }

            await connection.commit();
            return res.status(201).json({ message: 'Thêm lô thuốc thành công! Kho đã được cập nhật.', id: result.insertId });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        if (error && error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Số lô đã tồn tại cho thuốc này.' });
        }
        console.error('Lỗi thêm batch:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getExpiringBatches = async (req, res) => {
    try {
        const days = Math.min(Math.max(parseInt(req.query.days ?? '90', 10) || 90, 1), 365);
        const [rows] = await db.execute(
            `SELECT
                b.id, b.drug_id, d.name AS drug_name, b.batch_number, b.expiry_date, b.quantity
             FROM drug_batches b
             JOIN drugs d ON d.id = b.drug_id
             WHERE b.is_deleted = 0
               AND d.is_deleted = 0
               AND b.quantity > 0
               AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
             ORDER BY b.expiry_date ASC`,
            [days]
        );
        return res.status(200).json({ warnings: rows });
    } catch (error) {
        console.error('Lỗi cảnh báo hết hạn:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const downloadBatchTemplate = async (req, res) => {
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
        ['drug_name', 'batch_number', 'manufacture_date', 'expiry_date', 'quantity', 'import_price'],
        ['Paracetamol 500mg', 'PCT-2026-001', '2026-01-01', '2028-12-31', 1000, 500]
    ]);
    ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
    xlsx.utils.book_append_sheet(wb, ws, 'DrugBatches');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=drug_batches_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
};

const importDrugBatchesFromExcel = async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Chưa nhận được file upload!' });
    const filePath = file.path;
    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) return res.status(400).json({ message: 'Không tìm thấy sheet trong file Excel!' });
        const sheet = workbook.Sheets[sheetName];
        const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const headerRow = aoa?.[0] ?? [];
        const dataRows = aoa?.slice(1) ?? [];
        const headers = headerRow.map(normalizeHeader);

        const iDrugName = headers.findIndex((h) => h.includes('drug_name') || h.includes('ten thuoc') || h === 'name');
        const iBatch = headers.findIndex((h) => h.includes('batch_number') || h.includes('so lo') || h.includes('batch'));
        const iMfg = headers.findIndex((h) => h.includes('manufacture_date') || h.includes('ngay san xuat'));
        const iExp = headers.findIndex((h) => h.includes('expiry_date') || h.includes('han su dung') || h.includes('expiry'));
        const iQty = headers.findIndex((h) => h.includes('quantity') || h.includes('so luong'));
        const iImport = headers.findIndex((h) => h.includes('import_price') || h.includes('gia nhap'));
        if ([iDrugName, iBatch, iExp, iQty, iImport].some((i) => i < 0)) {
            return res.status(400).json({ message: 'Thiếu cột. Cần: drug_name, batch_number, expiry_date, quantity, import_price.' });
        }

        const errors = [];
        const rows = [];
        dataRows.forEach((r, idx) => {
            const rowNo = idx + 2;
            const drugName = String(r[iDrugName] ?? '').trim();
            const batchNumber = String(r[iBatch] ?? '').trim();
            const manufactureDate = iMfg >= 0 ? parseExcelDateToYMD(r[iMfg]) : null;
            const expiryDate = parseExcelDateToYMD(r[iExp]);
            const quantity = parseNumber(r[iQty]);
            const importPrice = parseNumber(r[iImport]);
            const rowErr = [];
            if (!drugName) rowErr.push('drug_name trống');
            if (!batchNumber) rowErr.push('batch_number trống');
            if (!expiryDate) rowErr.push('expiry_date không hợp lệ');
            if (!Number.isFinite(quantity) || quantity < 0 || Math.floor(quantity) !== quantity) rowErr.push('quantity không hợp lệ');
            if (!Number.isFinite(importPrice) || importPrice < 0) rowErr.push('import_price không hợp lệ');
            if (rowErr.length > 0) {
                errors.push({ row: rowNo, message: rowErr.join('; ') });
                return;
            }
            rows.push({ drugName, batchNumber, manufactureDate, expiryDate, quantity, importPrice });
        });

        if (rows.length === 0) return res.status(400).json({ message: 'Không có dòng hợp lệ để import.', errors });

        const connection = await db.getConnection();
        await connection.beginTransaction();
        let insertedDrugs = 0;
        let insertedBatches = 0;
        let updatedBatches = 0;
        try {
            for (const item of rows) {
                let drugId;
                const [existsDrug] = await connection.execute(
                    'SELECT id FROM drugs WHERE name = ? AND is_deleted = 0 LIMIT 1',
                    [item.drugName]
                );
                if (existsDrug.length > 0) {
                    drugId = existsDrug[0].id;
                } else {
                    const [insDrug] = await connection.execute('INSERT INTO drugs (name) VALUES (?)', [item.drugName]);
                    drugId = insDrug.insertId;
                    insertedDrugs += 1;
                }

                const [existsBatch] = await connection.execute(
                    'SELECT id, quantity FROM drug_batches WHERE drug_id = ? AND batch_number = ? AND is_deleted = 0 LIMIT 1',
                    [drugId, item.batchNumber]
                );
                if (existsBatch.length > 0) {
                    await connection.execute(
                        'UPDATE drug_batches SET manufacture_date = ?, expiry_date = ?, quantity = ?, import_price = ?, selling_price = ? WHERE id = ?',
                        [item.manufactureDate, item.expiryDate, item.quantity, item.importPrice, item.importPrice, existsBatch[0].id]
                    );
                    updatedBatches += 1;
                } else {
                    await connection.execute(
                        `INSERT INTO drug_batches
                        (drug_id, batch_number, manufacture_date, expiry_date, quantity, import_price, selling_price)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [drugId, item.batchNumber, item.manufactureDate, item.expiryDate, item.quantity, item.importPrice, item.importPrice]
                    );
                    insertedBatches += 1;
                }

                // ★ SYNC medicines table
                const [batchSum] = await connection.execute(
                    `SELECT COALESCE(SUM(quantity), 0) as total_qty FROM drug_batches 
                     WHERE drug_id = ? AND is_deleted = 0`,
                    [drugId]
                );
                const totalQty = batchSum[0]?.total_qty || 0;

                const [existsMed] = await connection.execute(
                    `SELECT id FROM medicines WHERE drug_id = ? LIMIT 1`,
                    [drugId]
                );

                if (existsMed.length > 0) {
                    await connection.execute(
                        `UPDATE medicines SET quantity = ? WHERE drug_id = ?`,
                        [totalQty, drugId]
                    );
                } else {
                    await connection.execute(
                        `INSERT INTO medicines (drug_id, name, quantity, price, import_price, expiry_date)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [drugId, item.drugName, totalQty, item.importPrice, item.importPrice, item.expiryDate]
                    );
                }
            }
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            console.error('Lỗi import drug batches:', err);
            return res.status(500).json({ message: 'Lỗi server khi import batch.' });
        } finally {
            connection.release();
        }

        return res.status(200).json({
            message: 'Import batch thành công! Kho đã được cập nhật.',
            summary: { inserted_drugs: insertedDrugs, inserted_batches: insertedBatches, updated_batches: updatedBatches, errors: errors.length },
            errors: errors.slice(0, 30)
        });
    } catch (e) {
        console.error('Lỗi xử lý Excel batch:', e);
        return res.status(500).json({ message: 'Lỗi server khi xử lý Excel batch.' });
    } finally {
        try { fs.unlinkSync(filePath); } catch (e) {}
    }
};

// =============================
// APIs phục vụ vận hành/test 100% qua API
// =============================
const getPrescriptionByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const [presRows] = await db.execute(
            `SELECT p.id, p.appointment_id, p.patient_id, p.doctor_id, p.diagnosis, p.notes, p.created_at
             FROM prescriptions p
             WHERE p.appointment_id = ?
             ORDER BY p.id DESC
             LIMIT 1`,
            [appointmentId]
        );
        
        // Nếu không tìm thấy prescription, return empty data thay vì 404
        if (presRows.length === 0) {
            return res.status(200).json({ prescription: null, items: [] });
        }

        const prescription = presRows[0];
        const [items] = await db.execute(
            `SELECT
                pi.id, pi.drug_id, d.name AS drug_name, pi.dosage, pi.quantity, pi.duration, pi.instructions, pi.price_at_time
             FROM prescription_items pi
             JOIN drugs d ON d.id = pi.drug_id
             WHERE pi.prescription_id = ?
             ORDER BY pi.id ASC`,
            [prescription.id]
        );
        return res.status(200).json({ prescription, items });
    } catch (error) {
        console.error('Lỗi lấy prescription theo appointment:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getDispenseByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const [txRows] = await db.execute(
            `SELECT id, appointment_id, prescription_id, payment_id, status, created_at
             FROM dispense_transactions
             WHERE appointment_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [appointmentId]
        );
        
        // Nếu không tìm thấy dispense, return empty data thay vì 404
        if (txRows.length === 0) {
            return res.status(200).json({ transaction: null, items: [] });
        }

        const transaction = txRows[0];
        const [items] = await db.execute(
            `SELECT
                di.id,
                di.prescription_item_id,
                di.drug_id,
                d.name AS drug_name,
                di.batch_id,
                b.batch_number,
                b.expiry_date,
                di.quantity,
                di.price_at_time
             FROM dispense_items di
             JOIN drugs d ON d.id = di.drug_id
             JOIN drug_batches b ON b.id = di.batch_id
             WHERE di.transaction_id = ?
             ORDER BY di.id ASC`,
            [transaction.id]
        );
        return res.status(200).json({ transaction, items });
    } catch (error) {
        console.error('Lỗi lấy dispense theo appointment:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

const getInventoryLogs = async (req, res) => {
    try {
        const limitRaw = parseInt(req.query.limit ?? '100', 10);
        const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 100, 1), 500);
        const drugId = req.query.drug_id ? Number(req.query.drug_id) : null;
        const action = req.query.action ? String(req.query.action).trim() : null;

        let sql = `
            SELECT
                il.id,
                il.drug_id,
                d.name AS drug_name,
                il.batch_id,
                b.batch_number,
                il.delta_quantity,
                il.action,
                il.reference_type,
                il.reference_id,
                il.note,
                il.created_by,
                il.created_at
            FROM inventory_logs il
            JOIN drugs d ON d.id = il.drug_id
            JOIN drug_batches b ON b.id = il.batch_id
            WHERE 1=1
        `;
        const params = [];
        if (drugId && Number.isFinite(drugId)) {
            sql += ' AND il.drug_id = ?';
            params.push(drugId);
        }
        if (action) {
            sql += ' AND il.action = ?';
            params.push(action);
        }
        sql += ' ORDER BY il.id DESC LIMIT ?';
        params.push(limit);

        const [rows] = await db.execute(sql, params);
        return res.status(200).json({ logs: rows });
    } catch (error) {
        console.error('Lỗi lấy inventory logs:', error);
        return res.status(500).json({ message: 'Lỗi server!' });
    }
};

module.exports = {
    getAllMedicines,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    importMedicinesFromExcel,
    downloadMedicineTemplate,
    getDrugsWithStock,
    createDrug,
    getDrugBatches,
    addDrugBatch,
    getExpiringBatches,
    downloadBatchTemplate,
    importDrugBatchesFromExcel,
    getPrescriptionByAppointment,
    getDispenseByAppointment,
    getInventoryLogs
};