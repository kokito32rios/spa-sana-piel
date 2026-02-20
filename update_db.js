require('dotenv').config();
const db = require('./config/db');

async function updateDB() {
    try {
        console.log('Adding nombre_cliente column...');
        await db.query("ALTER TABLE citas ADD COLUMN nombre_cliente VARCHAR(255) NULL AFTER email_cliente");
        console.log('✅ Column nombre_cliente added successfully.');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ Column nombre_cliente already exists.');
        } else {
            console.error('❌ Error updating database:', error);
        }
    } finally {
        process.exit();
    }
}

updateDB();
