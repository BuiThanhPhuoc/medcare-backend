// Check receptionists data
const db = require('./src/config/db');

async function check() {
    try {
        console.log('\n=== CHECKING RECEPTIONISTS TABLE ===\n');
        
        // 1. Check columns
        const [cols] = await db.execute('DESCRIBE receptionists');
        console.log('✅ Table columns:');
        cols.forEach(col => console.log(`  - ${col.Field}: ${col.Type}`));
        
        // 2. Check data
        const [data] = await db.execute(`
            SELECT r.id, u.username, u.email, r.full_name, r.status 
            FROM receptionists r 
            JOIN users u ON r.user_id = u.id
        `);
        console.log(`\n✅ Receptionists count: ${data.length}`);
        if (data.length > 0) {
            console.log('Data:', data);
        } else {
            console.log('⚠️  No receptionist data found');
        }
        
        // 3. Test the exact query from controller
        console.log('\n=== TESTING CONTROLLER QUERY ===\n');
        const [result] = await db.execute(`
            SELECT u.id, u.username, u.email, u.phone, 
                   r.id as receptionist_id, r.full_name, r.address, r.hire_date, r.status
            FROM users u
            JOIN receptionists r ON u.id = r.user_id
            WHERE u.role = 'receptionist'
            ORDER BY r.full_name ASC
        `);
        console.log('✅ Query result:', result);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

check();
