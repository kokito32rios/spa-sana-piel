const db = require('../config/db');

// =============================================
// OBTENER GASTOS (con filtros)
// =============================================
exports.obtenerGastos = async (req, res) => {
    try {
        const { mes, anio, tipo, fecha_inicio, fecha_fin } = req.query;

        let query = `
            SELECT 
                g.id_gasto,
                g.descripcion,
                g.monto,
                g.tipo,
                g.email_manicurista,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_manicurista,
                g.fecha_gasto
            FROM gastos g
            LEFT JOIN usuarios u ON g.email_manicurista = u.email
            WHERE 1=1
        `;
        const params = [];

        if (fecha_inicio && fecha_fin) {
            query += ` AND DATE(g.fecha_gasto) BETWEEN ? AND ?`;
            params.push(fecha_inicio, fecha_fin);
        } else {
            // Legacy filters
            if (mes && anio) {
                query += ` AND MONTH(g.fecha_gasto) = ? AND YEAR(g.fecha_gasto) = ?`;
                params.push(mes, anio);
            } else if (anio) {
                query += ` AND YEAR(g.fecha_gasto) = ?`;
                params.push(anio);
            }
        }

        if (tipo) {
            query += ` AND g.tipo = ?`;
            params.push(tipo);
        }

        query += ` ORDER BY g.fecha_gasto DESC`;

        const [gastos] = await db.query(query, params);

        res.json({ success: true, gastos });

    } catch (error) {
        console.error('Error al obtener gastos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener gastos' });
    }
};

// =============================================
// CREAR GASTO
// =============================================
exports.crearGasto = async (req, res) => {
    try {
        const { descripcion, monto, tipo, email_manicurista, fecha_gasto } = req.body;

        if (!descripcion || !monto || !tipo) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos (descripcion, monto, tipo)'
            });
        }

        // Validar tipo
        if (!['gasto_local', 'deduccion_manicurista'].includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de gasto inválido'
            });
        }

        // Si es deducción, debe tener manicurista
        if (tipo === 'deduccion_manicurista' && !email_manicurista) {
            return res.status(400).json({
                success: false,
                message: 'Debe seleccionar una manicurista para la deducción'
            });
        }

        const [result] = await db.query(`
            INSERT INTO gastos (descripcion, monto, tipo, email_manicurista, fecha_gasto)
            VALUES (?, ?, ?, ?, ?)
        `, [descripcion, monto, tipo, email_manicurista || null, fecha_gasto || new Date()]);

        // Emitir evento Socket.IO
        if (req.io) {
            req.io.emit('gastos_actualizados', {
                email_manicurista: email_manicurista || null,
                mensaje: 'Nuevo gasto registrado'
            });
        }

        res.json({
            success: true,
            message: 'Gasto registrado correctamente',
            id_gasto: result.insertId
        });

    } catch (error) {
        console.error('Error al crear gasto:', error);
        res.status(500).json({ success: false, error: 'Error al crear gasto' });
    }
};

// =============================================
// ACTUALIZAR GASTO
// =============================================
exports.actualizarGasto = async (req, res) => {
    try {
        const { id } = req.params;
        const { descripcion, monto, tipo, email_manicurista, fecha_gasto } = req.body;

        const updates = [];
        const params = [];

        if (descripcion) {
            updates.push('descripcion = ?');
            params.push(descripcion);
        }
        if (monto !== undefined) {
            updates.push('monto = ?');
            params.push(monto);
        }
        if (tipo) {
            updates.push('tipo = ?');
            params.push(tipo);
        }
        if (email_manicurista !== undefined) {
            updates.push('email_manicurista = ?');
            params.push(email_manicurista || null);
        }
        if (fecha_gasto) {
            updates.push('fecha_gasto = ?');
            params.push(fecha_gasto);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Nada que actualizar' });
        }

        params.push(id);

        const [result] = await db.query(
            `UPDATE gastos SET ${updates.join(', ')} WHERE id_gasto = ?`,
            params
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Gasto no encontrado' });
        }

        // Emitir evento Socket.IO
        if (req.io) {
            req.io.emit('gastos_actualizados', {
                email_manicurista: email_manicurista || null,
                mensaje: 'Gasto actualizado'
            });
        }

        res.json({ success: true, message: 'Gasto actualizado correctamente' });

    } catch (error) {
        console.error('Error al actualizar gasto:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar gasto' });
    }
};

// =============================================
// ELIMINAR GASTO
// =============================================
exports.eliminarGasto = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query('DELETE FROM gastos WHERE id_gasto = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Gasto no encontrado' });
        }

        // Emitir evento Socket.IO
        if (req.io) {
            req.io.emit('gastos_actualizados', {
                mensaje: 'Gasto eliminado'
            });
        }

        res.json({ success: true, message: 'Gasto eliminado correctamente' });

    } catch (error) {
        console.error('Error al eliminar gasto:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar gasto' });
    }
};

// =============================================
// OBTENER RESUMEN DE GASTOS (para dashboard)
// =============================================
exports.obtenerResumenGastos = async (req, res) => {
    try {
        const { mes, anio } = req.query;

        let whereClause = '';
        const params = [];

        if (mes && anio) {
            whereClause = 'WHERE MONTH(fecha_gasto) = ? AND YEAR(fecha_gasto) = ?';
            params.push(mes, anio);
        } else if (anio) {
            whereClause = 'WHERE YEAR(fecha_gasto) = ?';
            params.push(anio);
        }

        const [resumen] = await db.query(`
            SELECT 
                SUM(CASE WHEN tipo = 'gasto_local' THEN monto ELSE 0 END) as gastos_local,
                SUM(CASE WHEN tipo = 'deduccion_manicurista' THEN monto ELSE 0 END) as deducciones,
                SUM(monto) as total_gastos,
                COUNT(*) as cantidad_registros
            FROM gastos
            ${whereClause}
        `, params);

        res.json({ success: true, resumen: resumen[0] });

    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({ success: false, error: 'Error al obtener resumen' });
    }
};
