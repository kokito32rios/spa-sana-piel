const express = require('express');
const router = express.Router();
const horariosController = require('../controllers/horarios.controller');
const { verificarToken, soloAdmin } = require('../middleware/auth.middleware');

// =============================================
// RUTAS DE HORARIOS DE TRABAJO
// =============================================

// GET /api/horarios/:email - Obtener horarios de una manicurista
router.get('/:email', verificarToken, horariosController.obtenerHorarios);

// POST /api/horarios - Crear nuevo horario
router.post('/', verificarToken, soloAdmin, horariosController.crearHorario);

// POST /api/horarios/copiar - Copiar horario de una manicurista a otra
router.post('/copiar', verificarToken, soloAdmin, horariosController.copiarHorario);

// PUT /api/horarios/:id - Actualizar horario
router.put('/:id', verificarToken, soloAdmin, horariosController.actualizarHorario);

// DELETE /api/horarios/:id - Eliminar horario
router.delete('/:id', verificarToken, soloAdmin, horariosController.eliminarHorario);

// =============================================
// RUTAS DE EXCEPCIONES
// =============================================

// GET /api/horarios/excepciones/:email - Obtener excepciones de una manicurista
router.get('/excepciones/:email', verificarToken, horariosController.obtenerExcepciones);

// POST /api/horarios/excepciones - Crear nueva excepción
router.post('/excepciones', verificarToken, soloAdmin, horariosController.crearExcepcion);

// PUT /api/horarios/excepciones/:id - Actualizar excepción
router.put('/excepciones/:id', verificarToken, soloAdmin, horariosController.actualizarExcepcion);

// DELETE /api/horarios/excepciones/:id - Eliminar excepción
router.delete('/excepciones/:id', verificarToken, soloAdmin, horariosController.eliminarExcepcion);

module.exports = router;
