const db = require('./src/config/db');

const addStatusColumn = async () => {
    try {
        console.log("⏳ Kiểm tra và thêm status column vào table users...");
        
        // Kiểm tra xem column đã tồn tại chưa
        const [columns] = await db.execute(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
        `);

        if (columns.length > 0) {
            console.log("✅ Column 'status' đã tồn tại!");
        } else {
            // Thêm column nếu chưa có
            await db.execute(`
                ALTER TABLE users 
                ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active'
            `);
            console.log("✅ Đã thêm column 'status' vào table users!");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Lỗi:", error);
        process.exit(1);
    }
};

addStatusColumn();
