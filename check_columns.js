
require('dotenv').config();
const db = require('./config/db');

async function checkColumns() {
    try {
        const [rows] = await db.query('DESCRIBE citas');
        console.log('Columnas en tabla citas:');
        rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

checkColumns();
