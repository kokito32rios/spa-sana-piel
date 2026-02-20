const db = require('../config/db');

// =============================================
// OBTENER TODOS LOS SERVICIOS ACTIVOS CON IMAGEN
// =============================================
exports.obtenerServicios = async (req, res) => {
    try {
        const { includeAll } = req.query; // For admin to fetch all services
        const whereClause = includeAll === 'true' ? '' : 'WHERE s.activo = 1';

        const query = `
            SELECT 
                s.id_servicio,
                s.nombre,
                s.precio,
                s.duracion_minutos,
                s.descripcion,
                s.activo,
                (
                    SELECT ti.url_imagen 
                    FROM trabajos_imagenes ti 
                    WHERE ti.id_servicio = s.id_servicio 
                    AND ti.activo = 1 
                    AND ti.imagen_principal = 1
                    LIMIT 1
                ) as url_imagen,
                (
                    SELECT COUNT(*) 
                    FROM trabajos_imagenes ti 
                    WHERE ti.id_servicio = s.id_servicio 
                    AND ti.activo = 1
                ) as total_imagenes
            FROM servicios s
            ${whereClause}
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
            error: 'Error al obtener los servicios'
        });
    }
};

// =============================================
// OBTENER UN SERVICIO POR ID
// =============================================
exports.obtenerServicioPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                s.id_servicio,
                s.nombre,
                s.precio,
                s.duracion_minutos,
                s.descripcion,
                s.activo
            FROM servicios s
            WHERE s.id_servicio = ?
        `;

        const [servicios] = await db.query(query, [id]);

        if (servicios.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Servicio no encontrado'
            });
        }

        res.json({
            success: true,
            servicio: servicios[0]
        });

    } catch (error) {
        console.error('Error al obtener servicio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener el servicio'
        });
    }
};

// =============================================
// CREAR NUEVO SERVICIO
// =============================================
exports.crearServicio = async (req, res) => {
    try {
        const { nombre, precio, duracion, descripcion, observaciones } = req.body;

        // Validaciones básicas
        if (!nombre || !precio || !duracion) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos obligatorios'
            });
        }

        const query = `
            INSERT INTO servicios (nombre, precio, duracion_minutos, descripcion, activo)
            VALUES (?, ?, ?, ?, 1)
        `;

        const [result] = await db.query(query, [nombre, precio, duracion, descripcion]);

        res.status(201).json({
            success: true,
            message: 'Servicio creado exitosamente',
            id_servicio: result.insertId
        });

    } catch (error) {
        console.error('Error al crear servicio:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un servicio con este nombre'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Error al crear el servicio'
        });
    }
};

// =============================================
// ACTUALIZAR SERVICIO
// =============================================
exports.actualizarServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, duracion, descripcion, observaciones } = req.body;

        const query = `
            UPDATE servicios 
            SET nombre = ?, precio = ?, duracion_minutos = ?, descripcion = ?
            WHERE id_servicio = ?
        `;

        const [result] = await db.query(query, [nombre, precio, duracion, descripcion, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Servicio no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Servicio actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar servicio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar el servicio'
        });
    }
};

// =============================================
// CAMBIAR ESTADO (ACTIVAR/DESACTIVAR)
// =============================================
exports.toggleEstadoServicio = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body; // 1 o 0

        const query = 'UPDATE servicios SET activo = ? WHERE id_servicio = ?';
        const [result] = await db.query(query, [activo, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Servicio no encontrado'
            });
        }

        res.json({
            success: true,
            message: `Servicio ${activo ? 'activado' : 'desactivado'} exitosamente`
        });

    } catch (error) {
        console.error('Error al cambiar estado del servicio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al cambiar estado'
        });
    }
};

// =============================================
// ELIMINAR SERVICIO (PERMANENTE)
// =============================================
exports.eliminarServicio = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if there are appointments using this service
        const [citas] = await db.query(
            'SELECT COUNT(*) as total FROM citas WHERE id_servicio = ?',
            [id]
        );

        if (citas[0].total > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar: hay ${citas[0].total} cita(s) asociadas. Desactívalo en su lugar.`
            });
        }

        const [result] = await db.query('DELETE FROM servicios WHERE id_servicio = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Servicio no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Servicio eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar servicio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar el servicio'
        });
    }
};