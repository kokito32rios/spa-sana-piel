const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogo.controller');

// =============================================
// RUTAS PÚBLICAS DEL CATÁLOGO
// =============================================

// GET /api/catalogo - Obtener catálogo completo o filtrado
router.get('/', catalogoController.obtenerCatalogo);

// GET /api/catalogo/servicios - Obtener lista de servicios para filtro
router.get('/servicios', catalogoController.obtenerServiciosFiltro);

module.exports = router;