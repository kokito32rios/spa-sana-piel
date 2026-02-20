const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../controllers/auth.controller');
const dashboardController = require('../controllers/dashboard.controller');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Endpoints
router.get('/metricas', dashboardController.obtenerMetricas);
router.get('/grafico', dashboardController.obtenerDatosGrafico);
router.get('/manicuristas', dashboardController.obtenerResumenManicuristas);
router.get('/cuadre', dashboardController.obtenerCuadreCaja);
router.get('/detalle-pagos', dashboardController.obtenerDetallePagos);

// Ruta para dashboard de cliente
router.get('/cliente', dashboardController.renderDashboardCliente);

module.exports = router;
