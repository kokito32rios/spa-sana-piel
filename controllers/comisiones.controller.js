const db = require('../config/db');

// =============================================
// OBTENER RESUMEN DE COMISIONES (Por Manicurista)
// =============================================
exports.obtenerResumen = async (req, res) => {
    try {
        const { tipo, anio, mes, desde, hasta, manicurista } = req.query;

        // 1. Obtener lista de manicuristas (filtrar por email si se proporciona)
        let manicuristaQuery = `
            SELECT u.email, u.nombre, u.apellido, 
                   COALESCE(cm.porcentaje, 50) as porcentaje_comision
            FROM usuarios u
            LEFT JOIN comisiones_manicuristas cm ON u.email = cm.email_manicurista AND cm.anio = YEAR(CURDATE())
            WHERE u.id_rol = (SELECT id_rol FROM roles WHERE nombre_rol = 'manicurista')
            AND u.activo = 1
        `;

        const manicuristaParams = [];
        if (manicurista) {
            manicuristaQuery += ' AND u.email = ?';
            manicuristaParams.push(manicurista);
        }

        const [manicuristas] = await db.query(manicuristaQuery, manicuristaParams);


        const resumen = [];

        for (const m of manicuristas) {
            // 2. Construir WHERE clause dinámicamente según el tipo de filtro
            let whereClause = "WHERE email_manicurista = ? AND estado = 'completada'";
            const params = [m.email];

            if (tipo === 'mes') {
                if (anio && mes) {
                    whereClause += " AND YEAR(fecha) = ? AND MONTH(fecha) = ?";
                    params.push(anio, mes);
                } else if (anio) {
                    whereClause += " AND YEAR(fecha) = ?";
                    params.push(anio);
                }
            } else if (tipo === 'semana' || tipo === 'rango') {
                if (desde && hasta) {
                    whereClause += " AND fecha BETWEEN ? AND ?";
                    params.push(desde, hasta);
                }
            }


            const [ventas] = await db.query(`
                SELECT SUM(precio) as total_ventas, COUNT(*) as num_citas
                FROM citas
                ${whereClause}
            `, params);


            const totalVentas = ventas[0].total_ventas || 0;
            const totalComision = (totalVentas * m.porcentaje_comision) / 100;

            // 3. Calcular lo ya pagado (mismo filtro de fechas)
            let wherePagos = "WHERE c.email_manicurista = ? AND p.estado_pago_manicurista = 'pagado'";
            const paramsPagos = [m.email];

            if (tipo === 'mes') {
                if (anio && mes) {
                    wherePagos += " AND YEAR(c.fecha) = ? AND MONTH(c.fecha) = ?";
                    paramsPagos.push(anio, mes);
                } else if (anio) {
                    wherePagos += " AND YEAR(c.fecha) = ?";
                    paramsPagos.push(anio);
                }
            } else if (tipo === 'semana' || tipo === 'rango') {
                if (desde && hasta) {
                    wherePagos += " AND c.fecha BETWEEN ? AND ?";
                    paramsPagos.push(desde, hasta);
                }
            }

            const [pagos] = await db.query(`
                SELECT SUM(p.comision_manicurista) as total_pagado
                FROM pagos p
                JOIN citas c ON p.id_cita = c.id_cita
                ${wherePagos}
            `, paramsPagos);

            const totalPagado = pagos[0].total_pagado || 0;
            const pendiente = totalComision - totalPagado;

            resumen.push({
                email: m.email,
                nombre_completo: `${m.nombre} ${m.apellido}`,
                porcentaje: m.porcentaje_comision,
                total_ventas: totalVentas,
                total_comision: totalComision,
                total_pagado: totalPagado,
                pendiente: pendiente
            });
        }


        res.json({ success: true, resumen });

    } catch (error) {
        console.error('❌ Error al obtener resumen de comisiones:', error);
        res.status(500).json({ success: false, error: 'Error al obtener resumen' });
    }
};

// =============================================
// OBTENER DETALLE (Citas de una manicurista)
// =============================================
exports.obtenerDetalle = async (req, res) => {
    try {
        const { email } = req.params;
        const { tipo, anio, mes, desde, hasta } = req.query;



        let query = `
            SELECT c.id_cita, c.fecha, s.nombre as servicio, c.precio,
                   COALESCE(MAX(p.comision_manicurista), 0) as comision_pagada,
                   COALESCE(MAX(p.estado_pago_manicurista), 'pendiente') as estado_pago,
                   COALESCE(u.nombre, 'Cliente') as cliente_nombre, 
                   COALESCE(u.apellido, 'Anónimo') as cliente_apellido
            FROM citas c
            JOIN servicios s ON c.id_servicio = s.id_servicio
            LEFT JOIN usuarios u ON c.email_cliente = u.email
            LEFT JOIN pagos p ON c.id_cita = p.id_cita
            WHERE c.email_manicurista = ? AND c.estado = 'completada'
        `;

        const params = [email];

        // Aplicar filtros según el tipo
        if (tipo === 'mes') {
            if (anio && mes) {
                query += " AND YEAR(c.fecha) = ? AND MONTH(c.fecha) = ?";
                params.push(anio, mes);
            } else if (anio) {
                query += " AND YEAR(c.fecha) = ?";
                params.push(anio);
            }
        } else if (tipo === 'semana' || tipo === 'rango') {
            if (desde && hasta) {
                query += " AND c.fecha BETWEEN ? AND ?";
                params.push(desde, hasta);
            }
        }

        // GROUP BY to avoid duplicates from multiple payments
        query += " GROUP BY c.id_cita, c.fecha, s.nombre, c.precio, u.nombre, u.apellido";
        query += " ORDER BY c.fecha DESC";

        const [citas] = await db.query(query, params);


        // Necesitamos el % actual para calcular la comisión estimada de las pendientes
        const [config] = await db.query(`
            SELECT porcentaje FROM comisiones_manicuristas 
            WHERE email_manicurista = ? AND anio = YEAR(CURDATE())
        `, [email]);

        const porcentaje = config.length > 0 ? config[0].porcentaje : 50;


        const detalle = citas.map(c => ({
            ...c,
            comision_estimada: (c.precio * porcentaje) / 100
        }));


        res.json({ success: true, detalle, porcentaje_actual: porcentaje });

    } catch (error) {
        console.error('❌ Error al obtener detalle de comisiones:', error);
        res.status(500).json({ success: false, error: 'Error al obtener detalle' });
    }
};

// =============================================
// CONFIGURAR PORCENTAJE
// =============================================
exports.configurarComision = async (req, res) => {
    try {
        const { email_manicurista, porcentaje } = req.body;
        const anio = new Date().getFullYear();

        if (!email_manicurista || porcentaje === undefined) {
            return res.status(400).json({ success: false, message: 'Faltan datos' });
        }

        // Upsert (Insert or Update)
        await db.query(`
            INSERT INTO comisiones_manicuristas (email_manicurista, anio, porcentaje)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE porcentaje = VALUES(porcentaje)
        `, [email_manicurista, anio, porcentaje]);

        res.json({ success: true, message: 'Comisión actualizada correctamente' });

    } catch (error) {
        console.error('Error al configurar comisión:', error);
        res.status(500).json({ success: false, error: 'Error al configurar comisión' });
    }
};

// =============================================
// REGISTRAR PAGO (De Citas Seleccionadas)
// =============================================
exports.registrarPago = async (req, res) => {
    try {
        const { ids_citas, email_manicurista } = req.body; // ids_citas es un array

        if (!ids_citas || !Array.isArray(ids_citas) || ids_citas.length === 0) {
            return res.status(400).json({ success: false, message: 'No se seleccionaron citas para pagar' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Obtener el % actual para calcular cuánto pagar exactamente
            const [config] = await connection.query(`
                SELECT porcentaje FROM comisiones_manicuristas 
                WHERE email_manicurista = ? AND anio = YEAR(CURDATE())
            `, [email_manicurista]);
            const porcentaje = config.length > 0 ? config[0].porcentaje : 50;

            for (const idCita of ids_citas) {
                // Verificar si ya tiene pago
                const [pagoExistente] = await connection.query('SELECT id_pago FROM pagos WHERE id_cita = ?', [idCita]);

                // Obtener precio de la cita
                const [cita] = await connection.query('SELECT precio FROM citas WHERE id_cita = ?', [idCita]);
                if (cita.length === 0) continue;

                const montoComision = (cita[0].precio * porcentaje) / 100;

                if (pagoExistente.length > 0) {
                    // Actualizar pago existente
                    await connection.query(`
                        UPDATE pagos SET 
                            comision_manicurista = ?,
                            estado_pago_manicurista = 'pagado',
                            fecha_pago_manicurista = NOW()
                        WHERE id_cita = ?
                    `, [montoComision, idCita]);
                } else {
                    // Crear nuevo pago
                    // Nota: Si no hay pago del cliente registrado, asumimos que el pago del cliente es independiente o 'pendiente'
                    await connection.query(`
                        INSERT INTO pagos (id_cita, monto, comision_manicurista, estado_pago_manicurista, fecha_pago_manicurista)
                        VALUES (?, ?, ?, 'pagado', NOW())
                    `, [idCita, cita[0].precio, montoComision]);
                }
            }

            await connection.commit();
            connection.release();

            // Emitir evento Socket.IO
            if (req.io) {
                req.io.emit('comisiones_actualizadas', {
                    email_manicurista,
                    mensaje: 'Pago registrado'
                });
            }

            res.json({ success: true, message: 'Pago registrado exitosamente' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error al registrar pago:', error);
        res.status(500).json({ success: false, error: 'Error al registrar pago' });
    }
};

// =============================================
// REVERTIR PAGO (Dejar en pendiente)
// =============================================
exports.revertirPago = async (req, res) => {
    try {
        const { id_cita } = req.body;

        if (!id_cita) {
            return res.status(400).json({ success: false, message: 'Falta ID de cita' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Actualizar estado a pendiente
            await connection.query(`
                UPDATE pagos SET 
                    estado_pago_manicurista = 'pendiente',
                    fecha_pago_manicurista = NULL,
                    comision_manicurista = 0
                WHERE id_cita = ?
            `, [id_cita]);

            await connection.commit();
            connection.release();

            // Emitir evento Socket.IO
            if (req.io) {
                req.io.emit('comisiones_actualizadas', {
                    mensaje: 'Pago revertido'
                });
            }

            res.json({ success: true, message: 'Pago revertido correctamente' });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error al revertir pago:', error);
        res.status(500).json({ success: false, error: 'Error al revertir pago' });
    }
};
