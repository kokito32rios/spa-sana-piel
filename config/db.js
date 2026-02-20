const mysql = require('mysql2');

// =============================================
// CONFIGURACIÓN DE LA CONEXIÓN
// =============================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'spa_sana_piel',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Configuración SSL para Aiven/Render
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Convertir a promesas para usar async/await
const promisePool = pool.promise();

// =============================================
// PROBAR CONEXIÓN AL INICIO
// =============================================
(async () => {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Conexión a MySQL exitosa');
    console.log(`📊 Base de datos: ${process.env.DB_NAME}`);
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar con MySQL:', error.message);
    process.exit(1);
  }
})();

// =============================================
// EXPORTAR POOL DE CONEXIONES
// =============================================
module.exports = promisePool;