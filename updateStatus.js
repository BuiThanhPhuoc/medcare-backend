const db = require('./src/config/db');

const updateDoctorStatus = async () => {
    try {
        const [result] = await db.execute(
            `UPDATE users SET status='inactive' WHERE username='NguyenManhHung'`
        );
        console.log(`✅ Updated ${result.affectedRows} row(s)`);

        const [doctor] = await db.execute(
            `SELECT id, username, status FROM users WHERE username='NguyenManhHung'`
        );
        console.log('📋 Doctor status after update:', doctor[0]);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

updateDoctorStatus();
