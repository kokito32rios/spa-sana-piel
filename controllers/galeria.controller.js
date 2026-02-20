const db = require('../config/db');
const fs = require('fs');
const path = require('path');

// =============================================
// OBTENER GALERÍA (ADMIN)
// =============================================
exports.obtenerGaleriaAdmin = async (req, res) => {
    try {
        const query = `
            SELECT 
                ti.id_imagen,
                ti.url_imagen,
                ti.descripcion,
                ti.fecha_subida,
                ti.imagen_principal,
                s.nombre as nombre_servicio,
                s.id_servicio
            FROM trabajos_imagenes ti
            LEFT JOIN servicios s ON ti.id_servicio = s.id_servicio
            WHERE ti.activo = 1
            ORDER BY ti.fecha_subida DESC
        `;
        const [imagenes] = await db.query(query);
        console.log('Galeria logs - Imagenes retrieved:', imagenes);
        // Ensure imagenes is an array, defaults to empty if undefined (though db.query should return array)
        res.json({ success: true, imagenes: imagenes || [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al obtener galería' });
    }
};

// =============================================
// SUBIR IMAGEN
// =============================================
exports.subirImagen = async (req, res) => {
    try {
        console.log('DEBUG: Hit subirImagen');
        console.log('DEBUG: req.file:', req.file);
        console.log('DEBUG: req.body:', req.body);

        if (!req.file) {
            console.log('DEBUG: No file received');
            return res.status(400).json({ success: false, message: 'No se ha subido ninguna imagen' });
        }

        const { id_servicio, descripcion } = req.body;
        // Con Cloudinary, req.file.path ya es la URL (https://res.cloudinary...)
        const url_imagen = req.file.path;

        const query = `
            INSERT INTO trabajos_imagenes (id_servicio, url_imagen, descripcion, activo)
            VALUES (?, ?, ?, 1)
        `;

        await db.query(query, [id_servicio, url_imagen, descripcion]);

        res.json({ success: true, message: 'Imagen subida correctamente', url: url_imagen });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al subir imagen' });
    }
};

// =============================================
// ELIMINAR IMAGEN
// =============================================
exports.eliminarImagen = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener la URL de la imagen para borrar el archivo
        const [rows] = await db.query('SELECT url_imagen FROM trabajos_imagenes WHERE id_imagen = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Imagen no encontrada' });
        }

        const urlImagen = rows[0].url_imagen;

        // 2. Eliminar de la base de datos (soft delete o hard delete? El plan decía delete record)
        // Haremos hard delete para limpiar, o soft delete update activo=0. 
        // El controller catalogo filtra por activo=1.
        // Hagamos delete real para no acumular basura si borramos el archivo.

        await db.query('DELETE FROM trabajos_imagenes WHERE id_imagen = ?', [id]);

        // 3. Borrar archivo físico
        // url_imagen es algo como /uploads/galeria/file.jpg
        // Necesitamos path absoluto: public/uploads/galeria/file.jpg
        const relativePath = urlImagen.startsWith('/') ? urlImagen.substring(1) : urlImagen;
        const absolutePath = path.join(__dirname, '../public', relativePath);

        if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
        }

        res.json({ success: true, message: 'Imagen eliminada correctamente' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al eliminar imagen' });
    }
};

// =============================================
// TOGGLE PRINCIPAL
// =============================================
exports.togglePrincipal = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_servicio } = req.body; // Necesitamos saber el servicio para resetear otros

        // 1. Resetear principal para este servicio
        await db.query('UPDATE trabajos_imagenes SET imagen_principal = 0 WHERE id_servicio = ?', [id_servicio]);

        // 2. Marcar esta como principal
        await db.query('UPDATE trabajos_imagenes SET imagen_principal = 1 WHERE id_imagen = ?', [id]);

        res.json({ success: true, message: 'Imagen principal actualizada' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al actualizar imagen principal' });
    }
};
