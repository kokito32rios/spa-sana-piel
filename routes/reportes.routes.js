const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { verificarToken } = require('../middleware/auth.middleware'); // Corregido: desestructuración

// Todas las rutas requieren autenticación
router.use(verificarToken);

// Crear reporte
router.post('/', reportesController.crearReporte);

// Obtener conciliación (Admin)
router.get('/admin/conciliacion', reportesController.obtenerConciliacion);

// Obtener reportes (query param ?fecha=YYYY-MM-DD opcional)
router.get('/', reportesController.obtenerReportes);

// Eliminar reporte
router.delete('/:id', reportesController.eliminarReporte);

// Editar reporte
router.put('/:id', reportesController.actualizarReporte);

module.exports = router;
