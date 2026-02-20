
require('dotenv').config();
const db = require('./config/db');

async function testPersistence() {
    try {
        console.log('🧪 Testing nombre_cliente persistence...');

        // 0. Obtener IDs válidos
        const [manicuristas] = await db.query('SELECT email FROM usuarios WHERE id_rol=2 LIMIT 1');
        const [servicios] = await db.query('SELECT id_servicio FROM servicios LIMIT 1');

        if (manicuristas.length === 0 || servicios.length === 0) {
            throw new Error('No hay manicuristas o servicios para probar');
        }

        const validManicurista = manicuristas[0].email;
        const validServicio = servicios[0].id_servicio;

        // 1. Insertar Cita de Prueba
        const testName = 'Test Client ' + Date.now();
        console.log(`📝 Inserting appointment with name: "${testName}"`);

        const [result] = await db.query(`
            INSERT INTO citas (
                email_manicurista, id_servicio, fecha, hora_inicio, hora_fin, estado, precio, nombre_cliente
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [validManicurista, validServicio, '2026-12-31', '10:00:00', '11:00:00', 'pendiente', 0, testName]);

        const id = result.insertId;
        console.log(`✅ Inserted ID: ${id}`);

        // 2. Leer Cita
        const [rows] = await db.query('SELECT * FROM citas WHERE id_cita = ?', [id]);
        const savedName = rows[0].nombre_cliente;

        console.log(`🔍 Retrieved name: "${savedName}"`);

        if (savedName === testName) {
            console.log('🎉 SUCCESS: Persistence is working!');
        } else {
            console.error('❌ FAILURE: Name did not persist correctly. (Value: ' + savedName + ')');
        }

        // 3. Limpiar
        await db.query('DELETE FROM citas WHERE id_cita = ?', [id]);
        console.log('🧹 Cleaned up test data.');

    } catch (e) {
        console.error('💥 Error:', e);
    } finally {
        process.exit();
    }
}

testPersistence();
