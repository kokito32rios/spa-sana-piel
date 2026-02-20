const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../controllers/auth.controller');
const gastosController = require('../controllers/gastos.controller');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// CRUD
router.get('/', gastosController.obtenerGastos);
router.get('/resumen', gastosController.obtenerResumenGastos);
router.post('/', gastosController.crearGasto);
router.put('/:id', gastosController.actualizarGasto);
router.delete('/:id', gastosController.eliminarGasto);

module.exports = router;
