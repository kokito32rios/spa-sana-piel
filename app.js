require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Declarar io aquí para que el middleware pueda acceder a él por referencia
let io;

// =============================================
// MIDDLEWARES GLOBALES
// =============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =============================================
// RUTAS
// =============================================

// Ruta principal - index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Ruta de login
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Ruta dashboard admin
app.get('/dashboard-admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard-admin.html'));
});

// Ruta dashboard manicurista
app.get('/dashboard-manicurista.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard-manicurista.html'));
});

// Ruta dashboard cliente
app.get('/dashboard-cliente.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard-cliente.html'));
});

// Ruta del catálogo - Página pública
app.get('/catalogo.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'catalogo.html'));
});

// Ruta de prueba de API
app.get('/api/test', (req, res) => {
  res.json({
    message: '✅ API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Importar rutas
const serviciosRoutes = require('./routes/servicios.routes');
const catalogoRoutes = require('./routes/catalogo.routes');
const authRoutes = require('./routes/auth.routes');
const citasRoutes = require('./routes/citas.routes');
const reportesRoutes = require('./routes/reportes.routes');
const horariosRoutes = require('./routes/horarios.routes');

// Middleware para inyectar io en req (DEBE IR ANTES DE LAS RUTAS)
// Middleware para inyectar io en req (DEBE IR ANTES DE LAS RUTAS)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Usar rutas
app.use('/api/servicios', serviciosRoutes);
app.use('/api/catalogo', catalogoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/usuarios', require('./routes/usuarios.routes'));
app.use('/api/comisiones', require('./routes/comisiones.routes'));
app.use('/api/galeria', require('./routes/galeria.routes'));
app.use('/api/gastos', require('./routes/gastos.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));

// TODO: Agregar más rutas aquí
// const authRoutes = require('./routes/auth.routes');
// const citasRoutes = require('./routes/citas.routes');
// app.use('/api/auth', authRoutes);
// app.use('/api/citas', citasRoutes);

// =============================================
// MANEJO DE ERRORES 404
// =============================================
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// =============================================
// MANEJO DE ERRORES GLOBALES
// =============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor'
  });
});

// =============================================
// WEBSOCKETS SETUP
// =============================================
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
io = socketIo(server, {
  cors: {
    origin: "*", // Permitir todas las conexiones por ahora
    methods: ["GET", "POST"]
  }
});



// Eventos de conexión
io.on('connection', (socket) => {
  console.log('🟢 Nuevo cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('🔴 Cliente desconectado:', socket.id);
  });
});

// =============================================
// INICIAR SERVIDOR
// =============================================
// Cambiamos app.listen por server.listen
server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📁 Archivos estáticos: ${path.join(__dirname, 'public')}`);
  console.log(`📸 Uploads: ${path.join(__dirname, 'uploads')}`);
});

module.exports = app;