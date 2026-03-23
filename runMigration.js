// Migration runner
const fs = require('fs');
const db = require('./src/config/db');

async function runMigration() {
    try {
        const connection = await db.getConnection();
        const sql = fs.readFileSync('./receptionistProfileMigration.sql', 'utf8');
        const queries = sql.split(';').filter(q => q.trim());
        
        for (let query of queries) {
            if (query.trim()) {
                console.log(`Executing: ${query.substring(0, 50)}...`);
                await connection.execute(query);
            }
        }
        
        connection.release();
        console.log('✅ Migration completed successfully!');
        
        // Verify
        const [cols] = await db.execute('DESCRIBE receptionists');
        console.log('\n✅ Receptionists table columns:');
        cols.forEach(col => console.log(`  - ${col.Field}: ${col.Type}`));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
