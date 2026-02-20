const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');

// Obtener todos
router.get('/', usuariosController.obtenerUsuarios);

// Obtener roles (Helper)
router.get('/helpers/roles', usuariosController.obtenerRoles);

// Obtener uno
router.get('/:id', usuariosController.obtenerUsuarioPorId);

// Crear
router.post('/', usuariosController.crearUsuario);

// Actualizar
router.put('/:id', usuariosController.actualizarUsuario);

// Cambiar estado
router.patch('/:id/estado', usuariosController.toggleEstadoUsuario);

// Eliminar
router.delete('/:id', usuariosController.eliminarUsuario);

module.exports = router;
