const db = require('../config/db');

// Crear un nuevo reporte manual
exports.crearReporte = async (req, res) => {
    try {
        const { descripcion, valor } = req.body;
        const email_manicurista = req.usuario.email; // Del token

        if (!descripcion || !valor) {
            return res.status(400).json({
                success: false,
                message: 'Descripción y valor son requeridos'
            });
        }

        // Usar la fecha enviada por el cliente (o hoy si no se envía)
        // Esto corrige el problema de zona horaria y reportes después de medianoche
        const fechaReporte = req.body.fecha || new Date().toISOString().split('T')[0];

        const query = `
            INSERT INTO reportes_manicurista (email_manicurista, fecha, descripcion, valor_reportado, fecha_registro)
            VALUES (?, ?, ?, ?, NOW())
        `;

        await db.query(query, [email_manicurista, fechaReporte, descripcion, valor]);

        // Emitir evento Socket.IO
        if (req.io) {
            req.io.emit('reporte_actualizado', {
                email_manicurista,
                mensaje: 'Nuevo reporte diario'
            });
        }

        res.json({ success: true, message: 'Reporte registrado exitosamente' });

    } catch (error) {
        console.error('Error al crear reporte:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

// Obtener reportes (con filtros de fecha y cálculo de ganancia)
exports.obtenerReportes = async (req, res) => {
    try {
        const email_manicurista = req.usuario.email;
        const { tipo, anio, mes, desde, hasta } = req.query;

        console.log('Consultando reportes:', { email_manicurista, tipo, anio, mes, desde, hasta });

        // 1. Obtener el porcentaje de comisión del manicurista
        const [config] = await db.query(`
            SELECT porcentaje FROM comisiones_manicuristas 
            WHERE email_manicurista = ? AND anio = YEAR(CURDATE())
        `, [email_manicurista]);

        const porcentaje = config.length > 0 ? config[0].porcentaje : 50;

        // 2. Construir Query de Reportes
        let query = `
            SELECT id_reporte, fecha, descripcion, valor_reportado, fecha_registro
            FROM reportes_manicurista
            WHERE email_manicurista = ?
        `;

        const params = [email_manicurista];

        // Filtros (similar a comisiones)
        if (tipo === 'mes') {
            if (anio && mes) {
                query += " AND YEAR(fecha) = ? AND MONTH(fecha) = ?";
                params.push(anio, mes);
            } else if (anio) {
                query += " AND YEAR(fecha) = ?";
                params.push(anio);
            }
        } else if (tipo === 'semana' || tipo === 'rango') {
            if (desde && hasta) {
                query += " AND fecha BETWEEN ? AND ?";
                params.push(desde, hasta);
            }
        } else {
            // Por defecto hoy si no hay filtro explícito o parámetros vacíos
            query += " AND fecha = CURRENT_DATE()";
        }

        query += ' ORDER BY fecha_registro DESC';

        const [reportes] = await db.query(query, params);

        // 3. Procesar datos y calcular totales con comisión
        const reportesProcesados = reportes.map(r => {
            const valor = parseFloat(r.valor_reportado);
            const ganancia = (valor * porcentaje) / 100;
            return {
                ...r,
                valor_reportado: valor,
                porcentaje_aplicado: porcentaje,
                ganancia_estimada: ganancia
            };
        });

        // Calcular totales
        const totalReportado = reportesProcesados.reduce((sum, r) => sum + r.valor_reportado, 0);
        const totalGanancia = reportesProcesados.reduce((sum, r) => sum + r.ganancia_estimada, 0);

        res.json({
            success: true,
            reportes: reportesProcesados,
            totalReportado,
            totalGanancia,
            porcentaje
        });

    } catch (error) {
        console.error('Error al obtener reportes:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

// Eliminar un reporte
exports.eliminarReporte = async (req, res) => {
    try {
        const { id } = req.params;
        const email_manicurista = req.usuario.email;

        // Verificar que sea del usuario
        const checkQuery = `
            SELECT id_reporte FROM reportes_manicurista 
            WHERE id_reporte = ? AND email_manicurista = ?
        `;

        const [rows] = await db.query(checkQuery, [id, email_manicurista]);

        if (rows.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'No puedes eliminar este reporte (no existe o no es tuyo)'
            });
        }

        await db.query('DELETE FROM reportes_manicurista WHERE id_reporte = ?', [id]);

        // Emitir evento Socket.IO
        if (req.io) {
            req.io.emit('reporte_actualizado', {
                email_manicurista,
                mensaje: 'Reporte eliminado'
            });
        }

        res.json({ success: true, message: 'Reporte eliminado' });

    } catch (error) {
        console.error('Error al eliminar reporte:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

// Actualizar un reporte existente
exports.actualizarReporte = async (req, res) => {
    try {
        const { id } = req.params;
        const { descripcion, valor, fecha } = req.body;
        const email_manicurista = req.usuario.email;

        if (!descripcion || !valor || !fecha) {
            return res.status(400).json({
                success: false,
                message: 'Todos los campos son requeridos'
            });
        }

        // Verificar pertenencia (solo el dueño puede editar)
        const checkQuery = `
            SELECT id_reporte FROM reportes_manicurista 
            WHERE id_reporte = ? AND email_manicurista = ?
        `;
        const [rows] = await db.query(checkQuery, [id, email_manicurista]);

        if (rows.length === 0) {
            return res.status(403).json({ success: false, message: 'No autorizado para editar este reporte' });
        }

        const updateQuery = `
            UPDATE reportes_manicurista 
            SET descripcion = ?, valor_reportado = ?, fecha = ?
            WHERE id_reporte = ?
        `;

        await db.query(updateQuery, [descripcion, valor, fecha, id]);

        // Emitir evento Socket.IO
        if (req.io) {
            req.io.emit('reporte_actualizado', {
                email_manicurista,
                mensaje: 'Reporte actualizado'
            });
        }

        res.json({ success: true, message: 'Reporte actualizado exitosamente' });

    } catch (error) {
        console.error('Error al actualizar reporte:', error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
};

// Obtener conciliación (Admin)
// Obtener conciliación (Admin)
exports.obtenerConciliacion = async (req, res) => {
    try {
        const { anio, mes, manicurista, desde, hasta } = req.query;

        // Validar parámetros (Flexibilidad: requerimos anio+mes O desde+hasta)
        if ((!anio || !mes) && (!desde || !hasta)) {
            return res.status(400).json({ success: false, message: 'Se requiere Año/Mes o Rango de Fechas' });
        }

        // Params array for queries
        const params = [];
        let whereFecha = '';
        let whereManicurista = '';

        // Construir filtro de fecha
        if (desde && hasta) {
            whereFecha = 'DATE(fecha) BETWEEN ? AND ?';
            params.push(desde, hasta);
        } else {
            whereFecha = 'YEAR(fecha) = ? AND MONTH(fecha) = ?';
            params.push(anio, mes);
        }

        if (manicurista) {
            whereManicurista = ' AND email_manicurista = ?';
            params.push(manicurista);
        }

        // 1. Obtener Reportes de Manicuristas (Agrupado por día y manicurista)
        const queryReportes = `
            SELECT 
                fecha, 
                email_manicurista, 
                SUM(valor_reportado) as total_reportado
            FROM reportes_manicurista
            WHERE ${whereFecha} ${whereManicurista}
            GROUP BY fecha, email_manicurista
        `;
        // Clonar params para la segunda query
        const paramsReportes = [...params];
        const [reportes] = await db.query(queryReportes, paramsReportes);

        // 2. Obtener Ventas del Sistema (Citas completadas)
        // NOTA: Para el sistema usamos los mismos params
        const querySistema = `
            SELECT 
                DATE(fecha) as fecha, 
                email_manicurista, 
                SUM(precio) as total_sistema,
                (SELECT CONCAT(nombre, ' ', apellido) FROM usuarios u WHERE u.email = c.email_manicurista) as nombre_manicurista
            FROM citas c
            WHERE ${whereFecha} AND estado = 'completada' ${whereManicurista}
            GROUP BY DATE(fecha), email_manicurista
        `;
        const paramsSistema = [...params];
        const [sistema] = await db.query(querySistema, paramsSistema);

        // 3. Unificar datos (Full Outer Join simulado)
        // Crear un mapa único por clave "fecha_email"
        const mapa = new Map();

        // Procesar datos del sistema (Base de verdad)
        sistema.forEach(item => {
            const fechaStr = new Date(item.fecha).toISOString().split('T')[0]; // Asegurar formato YYYY-MM-DD
            const key = `${fechaStr}_${item.email_manicurista}`;

            mapa.set(key, {
                fecha: fechaStr,
                email_manicurista: item.email_manicurista,
                nombre_manicurista: item.nombre_manicurista,
                valor_sistema: parseFloat(item.total_sistema) || 0,
                valor_reportado: 0
            });
        });

        // Procesar reportes (Agregar o actualizar)
        for (const item of reportes) {
            const fechaStr = new Date(item.fecha).toISOString().split('T')[0];
            const key = `${fechaStr}_${item.email_manicurista}`;

            if (mapa.has(key)) {
                // Actualizar existente
                const entry = mapa.get(key);
                entry.valor_reportado = parseFloat(item.total_reportado) || 0;
            } else {
                // Buscar nombre si no existe en el mapa (query adicional o opcional)
                // Para simplificar, si no hay citas completadas pero hubo reporte, mostramos email
                const [user] = await db.query("SELECT CONCAT(nombre, ' ', apellido) as nombre_completo FROM usuarios WHERE email = ?", [item.email_manicurista]);
                const nombre = user.length > 0 ? user[0].nombre_completo : item.email_manicurista;

                mapa.set(key, {
                    fecha: fechaStr,
                    email_manicurista: item.email_manicurista,
                    nombre_manicurista: nombre,
                    valor_sistema: 0,
                    valor_reportado: parseFloat(item.total_reportado) || 0
                });
            }
        }

        // 4. Calcular diferencias y generar array final
        const resultado = Array.from(mapa.values()).map(item => {
            const diff = item.valor_sistema - item.valor_reportado;
            // Estado: ok (verde) si diff es 0, warning (amarillo) si diff > 0 (faltó reportar), danger (rojo) si reportó de más/menos raro
            // Simplificado: Verde si diff == 0, Rojo si diff != 0

            return {
                ...item,
                diferencia: diff,
                estado: Math.abs(diff) < 1 ? 'ok' : 'error' // Tolerancia de 1 peso por redondeo
            };
        });

        // Ordenar por fecha descendente
        resultado.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        res.json({ success: true, data: resultado });

    } catch (error) {
        console.error('Error en conciliación:', error);
        res.status(500).json({ success: false, message: 'Error al obtener conciliación' });
    }
};
