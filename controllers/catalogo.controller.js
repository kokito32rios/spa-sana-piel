const db = require('../config/db');

// =============================================
// OBTENER CATÁLOGO COMPLETO (Agrupado por servicio)
// =============================================
exports.obtenerCatalogo = async (req, res) => {
    try {
        const { servicio } = req.query; // Filtro opcional por ID de servicio

        let query = `
            SELECT 
                s.id_servicio,
                s.nombre as nombre_servicio,
                s.descripcion as descripcion_servicio,
                ti.id_imagen,
                ti.url_imagen,
                ti.descripcion,
                ti.fecha_subida,
                ti.imagen_principal
            FROM servicios s
            INNER JOIN trabajos_imagenes ti ON s.id_servicio = ti.id_servicio
            WHERE s.activo = 1 
            AND ti.activo = 1
        `;

        const params = [];

        // Si hay filtro por servicio específico
        if (servicio) {
            query += ` AND s.id_servicio = ?`;
            params.push(servicio);
        }

        query += ` ORDER BY s.nombre ASC, ti.imagen_principal DESC, ti.orden DESC, ti.fecha_subida DESC`;

        const [imagenes] = await db.query(query, params);

        // Agrupar imágenes por servicio
        const catalogoAgrupado = {};
        
        imagenes.forEach(img => {
            if (!catalogoAgrupado[img.id_servicio]) {
                catalogoAgrupado[img.id_servicio] = {
                    id_servicio: img.id_servicio,
                    nombre_servicio: img.nombre_servicio,
                    descripcion_servicio: img.descripcion_servicio,
                    imagenes: []
                };
            }
            
            catalogoAgrupado[img.id_servicio].imagenes.push({
                id_imagen: img.id_imagen,
                url_imagen: img.url_imagen,
                descripcion: img.descripcion,
                fecha_subida: img.fecha_subida,
                imagen_principal: img.imagen_principal
            });
        });

        // Convertir objeto a array
        const catalogo = Object.values(catalogoAgrupado);

        res.json({
            success: true,
            catalogo,
            total_servicios: catalogo.length,
            total_imagenes: imagenes.length
        });

    } catch (error) {
        console.error('Error al obtener catálogo:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el catálogo'
        });
    }
};

// =============================================
// OBTENER SERVICIOS PARA EL FILTRO
// =============================================
exports.obtenerServiciosFiltro = async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT
                s.id_servicio,
                s.nombre
            FROM servicios s
            INNER JOIN trabajos_imagenes ti ON s.id_servicio = ti.id_servicio
            WHERE s.activo = 1 
            AND ti.activo = 1
            ORDER BY s.nombre ASC
        `;

        const [servicios] = await db.query(query);

        res.json({
            success: true,
            servicios
        });

    } catch (error) {
        console.error('Error al obtener servicios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener servicios'
        });
    }
};