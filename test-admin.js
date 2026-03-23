const db = require('./src/config/db');

(async () => {
  try {
    const [users] = await db.execute('SELECT id, username, email, role, status FROM users WHERE role = ?', ['admin']);
    console.log('Admin users in DB:');
    console.log(users);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
