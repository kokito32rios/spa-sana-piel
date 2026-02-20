const express = require('express');
const router = express.Router();
const comisionesController = require('../controllers/comisiones.controller');
const { verificarToken, soloAdmin } = require('../middleware/auth.middleware');

// GET /api/comisiones/resumen
router.get('/resumen', verificarToken, soloAdmin, comisionesController.obtenerResumen);

// GET /api/comisiones/detalle/:email
router.get('/detalle/:email', verificarToken, soloAdmin, comisionesController.obtenerDetalle);

// POST /api/comisiones/configurar
router.post('/configurar', verificarToken, soloAdmin, comisionesController.configurarComision);

// POST /api/comisiones/pagar
router.post('/pagar', verificarToken, soloAdmin, comisionesController.registrarPago);

// POST /api/comisiones/revertir
router.post('/revertir', verificarToken, soloAdmin, comisionesController.revertirPago);

module.exports = router;
