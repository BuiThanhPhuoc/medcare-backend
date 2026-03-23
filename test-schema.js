const db = require('./src/config/db');

(async () => {
  try {
    const [cols] = await db.execute("DESCRIBE receptionists");
    console.log('=== RECEPTIONISTS TABLE SCHEMA ===');
    console.log(cols);
    process.exit(0);
  } catch (error) {
    console.error('❌ Bảng receptionists không tồn tại hoặc lỗi:', error.message);
    process.exit(0);
  }
})();
