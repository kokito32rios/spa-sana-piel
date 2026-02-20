const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// =============================================
// RUTAS PÚBLICAS
// =============================================

// POST /api/auth/login - Iniciar sesión
router.post('/login', authController.login);

// GET /api/auth/verificar - Verificar token válido
router.get('/verificar', authController.verificarToken);

module.exports = router;