/**
 * Tạo bảng dispense_items, inventory_logs và FK (nếu DB chỉ import bản cũ).
 * Chạy: node scripts/migrateDispenseTables.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function tableExists(conn, name) {
    const [rows] = await conn.execute(
        `SELECT COUNT(*) AS c FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [name]
    );
    return rows[0].c > 0;
}

async function constraintExists(conn, table, name) {
    const [rows] = await conn.execute(
        `SELECT COUNT(*) AS c FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
        [table, name]
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
        if (!(await tableExists(conn, 'dispense_items'))) {
            await conn.execute(`
                CREATE TABLE dispense_items (
                  id int(11) NOT NULL AUTO_INCREMENT,
                  transaction_id int(11) NOT NULL,
                  prescription_item_id int(11) NOT NULL,
                  drug_id int(11) NOT NULL,
                  batch_id int(11) NOT NULL,
                  quantity int(11) NOT NULL,
                  price_at_time decimal(12,2) NOT NULL DEFAULT 0.00,
                  created_at timestamp NOT NULL DEFAULT current_timestamp(),
                  PRIMARY KEY (id),
                  KEY transaction_id (transaction_id),
                  KEY prescription_item_id (prescription_item_id),
                  KEY drug_id (drug_id),
                  KEY batch_id (batch_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
            console.log('Đã tạo bảng dispense_items');
        } else {
            console.log('dispense_items: đã tồn tại');
        }

        if (!(await tableExists(conn, 'inventory_logs'))) {
            await conn.execute(`
                CREATE TABLE inventory_logs (
                  id int(11) NOT NULL AUTO_INCREMENT,
                  drug_id int(11) NOT NULL,
                  batch_id int(11) NOT NULL,
                  delta_quantity int(11) NOT NULL,
                  action varchar(50) NOT NULL,
                  reference_type varchar(50) DEFAULT NULL,
                  reference_id int(11) DEFAULT NULL,
                  note text DEFAULT NULL,
                  created_by int(11) DEFAULT NULL,
                  created_at timestamp NOT NULL DEFAULT current_timestamp(),
                  PRIMARY KEY (id),
                  KEY drug_id (drug_id),
                  KEY batch_id (batch_id),
                  KEY action (action)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
            `);
            console.log('Đã tạo bảng inventory_logs');
        } else {
            console.log('inventory_logs: đã tồn tại');
        }

        const fks = [
            {
                table: 'dispense_items',
                name: 'fk_dispense_items_transaction',
                sql: 'ALTER TABLE dispense_items ADD CONSTRAINT fk_dispense_items_transaction FOREIGN KEY (transaction_id) REFERENCES dispense_transactions (id) ON DELETE CASCADE'
            },
            {
                table: 'dispense_items',
                name: 'fk_dispense_items_prescription_item',
                sql: 'ALTER TABLE dispense_items ADD CONSTRAINT fk_dispense_items_prescription_item FOREIGN KEY (prescription_item_id) REFERENCES prescription_items (id) ON DELETE CASCADE'
            },
            {
                table: 'dispense_items',
                name: 'fk_dispense_items_drug',
                sql: 'ALTER TABLE dispense_items ADD CONSTRAINT fk_dispense_items_drug FOREIGN KEY (drug_id) REFERENCES drugs (id) ON DELETE CASCADE'
            },
            {
                table: 'dispense_items',
                name: 'fk_dispense_items_batch',
                sql: 'ALTER TABLE dispense_items ADD CONSTRAINT fk_dispense_items_batch FOREIGN KEY (batch_id) REFERENCES drug_batches (id) ON DELETE CASCADE'
            },
            {
                table: 'inventory_logs',
                name: 'fk_inventory_logs_drug',
                sql: 'ALTER TABLE inventory_logs ADD CONSTRAINT fk_inventory_logs_drug FOREIGN KEY (drug_id) REFERENCES drugs (id) ON DELETE CASCADE'
            },
            {
                table: 'inventory_logs',
                name: 'fk_inventory_logs_batch',
                sql: 'ALTER TABLE inventory_logs ADD CONSTRAINT fk_inventory_logs_batch FOREIGN KEY (batch_id) REFERENCES drug_batches (id) ON DELETE CASCADE'
            },
            {
                table: 'dispense_transactions',
                name: 'fk_dispense_transactions_payment',
                sql: 'ALTER TABLE dispense_transactions ADD CONSTRAINT fk_dispense_transactions_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE CASCADE'
            }
        ];

        for (const fk of fks) {
            if (!(await tableExists(conn, fk.table))) continue;
            if (await constraintExists(conn, fk.table, fk.name)) {
                console.log(`${fk.name}: đã có`);
                continue;
            }
            try {
                await conn.execute(fk.sql);
                console.log(`Đã thêm ${fk.name}`);
            } catch (e) {
                console.warn(`${fk.name}: bỏ qua — ${e.message}`);
            }
        }

        console.log('Hoàn tất migrate dispense/inventory.');
    } finally {
        await conn.end();
    }
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
