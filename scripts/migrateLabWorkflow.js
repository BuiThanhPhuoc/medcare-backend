/**
 * Role lab_technician + cột thanh toán xét nghiệm + luồng lab trên appointments.
 * Chạy: node scripts/migrateLabWorkflow.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function columnExists(conn, table, col) {
    const [r] = await conn.execute(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
    );
    return r[0].c > 0;
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
        await conn.execute(`
            ALTER TABLE users MODIFY COLUMN role ENUM('patient','doctor','receptionist','admin','lab_technician') DEFAULT 'patient'
        `);
        console.log('users.role: đã thêm lab_technician');
    } catch (e) {
        if (String(e.message).includes('Duplicate')) console.log('users.role: đã có');
        else console.warn('users.role:', e.message);
    }

    if (!(await columnExists(conn, 'test_orders', 'payment_status'))) {
        await conn.execute(`
            ALTER TABLE test_orders
            ADD COLUMN payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid' AFTER quantity
        `);
        console.log('test_orders.payment_status: đã thêm');
    } else {
        console.log('test_orders.payment_status: đã có');
    }

    if (!(await columnExists(conn, 'appointments', 'lab_workflow_status'))) {
        await conn.execute(`
            ALTER TABLE appointments
            ADD COLUMN lab_workflow_status ENUM(
                'none',
                'awaiting_lab_payment',
                'in_lab',
                'awaiting_doctor_lab',
                'closed'
            ) NOT NULL DEFAULT 'none' AFTER payment_status
        `);
        console.log('appointments.lab_workflow_status: đã thêm');
    } else {
        console.log('appointments.lab_workflow_status: đã có');
    }

    if (!(await columnExists(conn, 'appointments', 'admission_requested'))) {
        await conn.execute(`
            ALTER TABLE appointments
            ADD COLUMN admission_requested TINYINT(1) NOT NULL DEFAULT 0 AFTER lab_workflow_status
        `);
        console.log('appointments.admission_requested: đã thêm');
    } else {
        console.log('appointments.admission_requested: đã có');
    }

    if (!(await columnExists(conn, 'appointments', 'lab_review_notes'))) {
        await conn.execute(`
            ALTER TABLE appointments
            ADD COLUMN lab_review_notes TEXT NULL AFTER admission_requested
        `);
        console.log('appointments.lab_review_notes: đã thêm');
    } else {
        console.log('appointments.lab_review_notes: đã có');
    }

    console.log('Hoàn tất migrate lab workflow.');
    await conn.end();
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
