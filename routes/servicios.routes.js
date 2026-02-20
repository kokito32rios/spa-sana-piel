const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');

// =============================================
// RUTAS PÚBLICAS
// =============================================

// GET /api/servicios - Obtener todos los servicios activos
router.get('/', serviciosController.obtenerServicios);

// GET /api/servicios/:id - Obtener un servicio específico
router.get('/:id', serviciosController.obtenerServicioPorId);

// POST /api/servicios - Crear nuevo servicio (Admin)
router.post('/', serviciosController.crearServicio);

// PUT /api/servicios/:id - Actualizar servicio (Admin)
router.put('/:id', serviciosController.actualizarServicio);

// PATCH /api/servicios/:id/estado - Cambiar estado (Admin)
router.patch('/:id/estado', serviciosController.toggleEstadoServicio);

// DELETE /api/servicios/:id - Eliminar servicio (Admin)
router.delete('/:id', serviciosController.eliminarServicio);

module.exports = router;