const express = require('express');
const router = express.Router();
const citasController = require('../controllers/citas.controller');
const { verificarToken, soloAdmin } = require('../middleware/auth.middleware');

// =============================================
// RUTAS PROTEGIDAS (requieren autenticación)
// =============================================

// GET /api/citas/mis-citas - Obtener citas del cliente (Nuevo)
router.get('/mis-citas', verificarToken, citasController.obtenerMisCitas);

// GET /api/citas - Obtener todas las citas
router.get('/', verificarToken, citasController.obtenerCitas);

// POST /api/citas - Crear nueva cita
router.post('/', verificarToken, citasController.crearCita);

// POST /api/citas/agendar - Alias para crear nueva cita (Semántica cliente)
router.post('/agendar', verificarToken, citasController.crearCita);

// PUT /api/citas/:id - Actualizar cita
router.put('/:id', verificarToken, citasController.actualizarCita);

// DELETE /api/citas/:id - Eliminar cita
router.delete('/:id', verificarToken, citasController.eliminarCita);

// GET /api/citas/:id/pagos - Obtener pagos de una cita
router.get('/:id/pagos', verificarToken, citasController.obtenerPagosCita);

// GET /api/citas/manicuristas - Obtener manicuristas disponibles
router.get('/helpers/manicuristas', verificarToken, citasController.obtenerManicuristasDisponibles);

// GET /api/citas/clientes - Obtener clientes
router.get('/helpers/clientes', verificarToken, citasController.obtenerClientes);

// GET /api/citas/horarios-disponibles - Obtener horarios disponibles
router.get('/helpers/horarios-disponibles', verificarToken, citasController.obtenerHorariosDisponibles);

// GET /api/citas/helpers/agenda - Obtener citas para el calendario
router.get('/helpers/agenda', verificarToken, citasController.obtenerCitasAgenda);

// GET /api/citas/helpers/mis-comisiones - Obtener mis comisiones
router.get('/helpers/mis-comisiones', verificarToken, citasController.obtenerComisionesManicurista);

// GET /api/citas/helpers/admin/comisiones - Obtener comisiones globales (Admin)
router.get('/helpers/admin/comisiones', verificarToken, soloAdmin, citasController.obtenerComisionesGlobales);

module.exports = router;