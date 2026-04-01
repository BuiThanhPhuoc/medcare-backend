/**
 * Thêm các cột drug_batches mà backend cần (DB cũ thường chỉ có batch_number, expiry_date, quantity, is_deleted).
 * Chạy: node scripts/migrateDrugBatchesColumns.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const alters = [
    'ADD COLUMN manufacture_date date DEFAULT NULL',
    'ADD COLUMN import_price decimal(12,2) NOT NULL DEFAULT 0.00',
    'ADD COLUMN selling_price decimal(12,2) NOT NULL DEFAULT 0.00',
    'ADD COLUMN created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP'
];

async function columnExists(conn, columnName) {
    const [rows] = await conn.execute(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drug_batches' AND COLUMN_NAME = ?`,
        [columnName]
    );
    return rows[0].c > 0;
}

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME
    });

    try {
        const map = {
            manufacture_date: alters[0],
            import_price: alters[1],
            selling_price: alters[2],
            created_at: alters[3]
        };
        for (const [name, clause] of Object.entries(map)) {
            if (await columnExists(conn, name)) {
                console.log(` drug_batches.${name}: đã có, bỏ qua`);
                continue;
            }
            await conn.execute(`ALTER TABLE drug_batches ${clause}`);
            console.log(` drug_batches.${name}: đã thêm`);
        }
        console.log('Hoàn tất migration.');
    } finally {
        await conn.end();
    }
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
