const db = require('./src/config/db');

async function test() {
    try {
        console.log('\n=== DIAGNOSTIC ===\n');
        
        // Step 1: Check if receptionists table exists
        const [tables] = await db.execute(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'receptionists'
        `);
        console.log('✅ Receptionists table exists:', tables.length > 0);
        
        // Step 2: Describe table
        const [cols] = await db.execute('SHOW COLUMNS FROM receptionists');
        console.log('✅ Columns in receptionists:', cols.map(c => c.Field));
        
        // Step 3: Check receptionists count
        const [[{count}]] = await db.execute('SELECT COUNT(*) as count FROM receptionists');
        console.log(`✅ Receptionists count: ${count}`);
        
        // Step 4: Check users with role receptionist
        const [[{ucount}]] = await db.execute(`
            SELECT COUNT(*) as ucount FROM users WHERE role = 'receptionist'
        `);
        console.log(`✅ Users with role='receptionist': ${ucount}`);
        
        // Step 5: Try the exact query
        console.log('\n=== TESTING QUERY ===\n');
        const [result] = await db.execute(`
            SELECT u.id, u.username, u.email, u.phone, 
                   r.id as receptionist_id, r.full_name, r.address, r.hire_date, r.status
            FROM users u
            JOIN receptionists r ON u.id = r.user_id
            WHERE u.role = 'receptionist'
            ORDER BY r.full_name ASC
        `);
        console.log(`✅ Query returned ${result.length} rows`);
        if (result.length > 0) {
            console.log('Sample:', result[0]);
        }
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

test();
