const express = require('express');
const router = express.Router();
const galeriaController = require('../controllers/galeria.controller');
const { authMiddleware } = require('../controllers/auth.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// =============================================
// CONFIGURACIÓN MULTER
// =============================================
// =============================================
// CONFIGURACIÓN CLOUDINARY
// =============================================
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'unas_spa_galeria', // Folder in Cloudinary
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Resize for optimization
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// =============================================
// RUTAS
// =============================================

// Obtener galería (Admin)
router.get('/', authMiddleware, galeriaController.obtenerGaleriaAdmin);

// Subir imagen
router.post('/subir', (req, res, next) => {
    console.log('DEBUG: Route /subir hit');
    next();
}, authMiddleware, upload.single('imagen'), galeriaController.subirImagen);

// Eliminar imagen
router.delete('/:id', authMiddleware, galeriaController.eliminarImagen);

// Toggle principal
router.patch('/:id/principal', authMiddleware, galeriaController.togglePrincipal);

module.exports = router;
