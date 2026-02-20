const db = require('../config/db');

// =============================================
// OBTENER MIS CITAS (CLIENTE)
// =============================================
exports.obtenerMisCitas = async (req, res) => {
    try {
        const email = req.usuario.email;

        // Obtener citas futuras y pasadas
        const [citas] = await db.query(`
            SELECT 
                c.id_cita,
                c.fecha,
                c.hora_inicio,
                c.hora_fin,
                c.estado,
                s.nombre as nombre_servicio,
                c.precio,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_manicurista,
                c.email_manicurista
            FROM citas c
            JOIN servicios s ON c.id_servicio = s.id_servicio
            JOIN usuarios u ON c.email_manicurista = u.email
            WHERE c.email_cliente = ?
            ORDER BY c.fecha DESC, c.hora_inicio DESC
        `, [email]);

        res.json({ success: true, citas });
    } catch (error) {
        console.error('Error al obtener mis citas:', error);
        res.status(500).json({ success: false, error: 'Error al obtener mis citas' });
    }
};

// =============================================
// OBTENER TODAS LAS CITAS (Admin)
// =============================================
exports.obtenerCitas = async (req, res) => {
    try {
        const { fecha, estado, manicurista } = req.query;

        // Verificar rol para privacidad
        // req.usuario viene del middleware verificarToken
        const esManicurista = req.usuario && req.usuario.nombre_rol === 'manicurista';
        const campoTelefono = esManicurista ? "NULL as telefono_contacto_visible" : "c.telefono_contacto";
        const campoTelUsuario = esManicurista ? "NULL as telefono_cliente_visible" : "uc.telefono";

        let query = `
            SELECT 
                c.id_cita,
                c.fecha,
                c.hora_inicio,
                c.hora_fin,
                c.estado,
                c.precio,
                c.notas_cliente,
                c.notas_manicurista,
                c.creado_en,
                c.email_cliente,
                ${campoTelefono}, -- Telefono especifico de la cita
                ${esManicurista ? "'Cliente Reservado' as nombre_cliente" : "CONCAT(uc.nombre, ' ', uc.apellido) as nombre_cliente"},
                ${campoTelUsuario} as telefono_cliente, -- Telefono del perfil
                c.email_manicurista,
                CONCAT(um.nombre, ' ', um.apellido) as nombre_manicurista,
                c.id_servicio,
                s.nombre as nombre_servicio,
                s.precio as precio_servicio,
                s.duracion_minutos,
                c.nombre_cliente as nombre_manual,
                -- Subqueries para pagos (manejan múltiples pagos sin duplicar filas)
                (SELECT SUM(monto) FROM pagos WHERE id_cita = c.id_cita) as monto_pagado,
                (SELECT GROUP_CONCAT(DISTINCT metodo_pago_cliente SEPARATOR ', ') FROM pagos WHERE id_cita = c.id_cita AND metodo_pago_cliente IS NOT NULL) as metodo_pago
            FROM citas c
            LEFT JOIN usuarios uc ON c.email_cliente = uc.email
            INNER JOIN usuarios um ON c.email_manicurista = um.email
            INNER JOIN servicios s ON c.id_servicio = s.id_servicio
            WHERE 1=1
        `;

        const params = [];

        if (fecha) {
            query += ` AND c.fecha = ?`;
            params.push(fecha);
        } else if (req.query.fecha_inicio && req.query.fecha_fin) {
            query += ` AND c.fecha BETWEEN ? AND ?`;
            params.push(req.query.fecha_inicio, req.query.fecha_fin);
        }

        if (estado) {
            query += ` AND c.estado = ?`;
            params.push(estado);
        }

        // Si es manicurista, forzar filtro de sus citas (seguridad adicional)
        if (esManicurista) {
            query += ` AND c.email_manicurista = ?`;
            params.push(req.usuario.email);
        } else if (manicurista) {
            query += ` AND c.email_manicurista = ?`;
            params.push(manicurista);
        }

        query += ` ORDER BY c.fecha DESC, c.hora_inicio DESC`;

        const [citas] = await db.query(query, params);

        // Limpieza y logica de nombres
        citas.forEach(c => {
            // Prioridad: 1. Usuario registrado. 2. Nombre manual. 3. "Cliente Anónimo"
            // NOTA: 'nombre_cliente' viene del query original como el CONCAT del usuario
            // Pero ese CONCAT es null si no hay usuario.
            // Vamos a re-mapear para ser claros.

            // En el query de arriba, NO cambiamos la proyección original de 'nombre_cliente' (línea 62 aprox) 
            // para no romper frontends que esperan 'nombre_cliente' como el del usuario.
            // PERO necesitamos inyectar la lógica aquí o en SQL.
            // Haremos un override en JS para flexibilidad.

            // Revisar query original arriba:
            // ${esManicurista ? "'Cliente Reservado' as nombre_cliente" : "CONCAT(uc.nombre, ' ', uc.apellido) as nombre_cliente"},

            // Si el query devuelve NULL en nombre_cliente (porque no hay usuario), usamos nombre_manual.
            if (!c.nombre_cliente && c.nombre_manual) {
                c.nombre_cliente = c.nombre_manual;
            } else if (!c.nombre_cliente) {
                c.nombre_cliente = 'Cliente Anónimo';
            }

            if (esManicurista) {
                if (c.notas_cliente) {
                    c.notas_cliente = c.notas_cliente.replace(/\[Tel: .*?\]/g, '').trim();
                }
                // Manicurista siempre ve "Cliente Reservado" si así lo define la regla, 
                // o ve el nombre si la regla de privacidad lo permite.
                // El código original forzaba 'Cliente Reservado'.
                // Mantendremos esa lógica si es lo deseado, pero el user pidió ver nombres.
                // Asumo que ADMIN quiere ver nombres siempre. Manicurista tal vez.
                // El código original tenía un ternario en SQL.
            }
        });

        res.json({
            success: true,
            citas
        });

    } catch (error) {
        console.error('Error al obtener citas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener las citas'
        });
    }
};

// =============================================
// CREAR CITA CON VALIDACIÓN ANTI-SOLAPAMIENTO
// =============================================
exports.crearCita = async (req, res) => {
    try {
        // Si es cliente, asignar email automáticamente desde el token
        // Y buscar su teléfono si no viene en el body
        if (req.usuario && req.usuario.nombre_rol === 'cliente') {
            req.body.email_cliente = req.usuario.email;
        }

        let {
            email_cliente,
            email_manicurista,
            id_servicio,
            fecha,
            hora_inicio,
            notas_cliente,
            telefono_contacto,
            nombre_cliente, // Nuevo campo
            estado // Extraer estado (opcional)
        } = req.body;

        // Validar Estado Inicial (si se envía)
        const estadosValidos = ['pendiente', 'confirmada', 'completada', 'cancelada', 'no_asistio'];
        let estadoFinal = 'pendiente';

        if (estado && estadosValidos.includes(estado)) {
            estadoFinal = estado;
        }

        // Auto-fill telefono si es cliente y no lo envió
        if (req.usuario && req.usuario.nombre_rol === 'cliente' && !telefono_contacto) {
            const [userData] = await db.query('SELECT telefono FROM usuarios WHERE email = ?', [req.usuario.email]);
            if (userData.length > 0) {
                telefono_contacto = userData[0].telefono;
            }
        }

        // Validar campos requeridos
        if (!email_manicurista || !id_servicio || !fecha || !hora_inicio) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos'
            });
        }

        // Validar formato de hora
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(hora_inicio)) {
            return res.status(400).json({
                success: false,
                message: 'Formato de hora inválido'
            });
        }

        // Validar que no sea en el pasado (con zona horaria Colombia)
        // Construimos fecha ISO con offset -05:00 explícito para interpretar correctamente la entrada del usuario
        const fechaCita = new Date(`${fecha}T${hora_inicio}:00-05:00`);
        const ahora = new Date();

        // 10 minutos de gracia para evitar bloqueos por latencia o relojes desincronizados
        // PERMITIR si es ADMIN (para cuadre de caja o auditoría)
        const esAdmin = req.usuario && req.usuario.nombre_rol === 'admin';

        if (!esAdmin && fechaCita < new Date(ahora.getTime() - 10 * 60000)) {
            return res.status(400).json({
                success: false,
                message: `No se pueden crear citas en el pasado. (Hora actual servidor: ${ahora.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })})`
            });
        }

        let duracion;
        if (req.body.duracion) {
            duracion = parseInt(req.body.duracion);
        } else {
            const [servicios] = await db.query(
                'SELECT duracion_minutos FROM servicios WHERE id_servicio = ? AND activo = 1',
                [id_servicio]
            );

            if (servicios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Servicio no encontrado'
                });
            }
            duracion = servicios[0].duracion_minutos;
        }

        // Calcular hora_fin
        const [horas, minutos] = hora_inicio.split(':').map(Number);
        const totalMinutos = horas * 60 + minutos + duracion;
        const horaFin = `${Math.floor(totalMinutos / 60).toString().padStart(2, '0')}:${(totalMinutos % 60).toString().padStart(2, '0')}:00`;

        // VALIDACIÓN ANTI-SOLAPAMIENTO
        const [solapamientos] = await db.query(`
            SELECT COUNT(*) as count
            FROM citas
            WHERE email_manicurista = ?
            AND fecha = ?
            AND estado NOT IN ('cancelada', 'no_asistio')
            AND (
                (hora_inicio < ? AND hora_fin > ?) OR
                (hora_inicio < ? AND hora_fin > ?) OR
                (hora_inicio >= ? AND hora_fin <= ?)
            )
        `, [
            email_manicurista,
            fecha,
            horaFin, hora_inicio,
            horaFin, horaFin,
            hora_inicio, horaFin
        ]);

        if (solapamientos[0].count > 0) {
            return res.status(409).json({
                success: false,
                message: 'La manicurista ya tiene una cita en ese horario',
                tipo: 'solapamiento'
            });
        }

        // Insertar cita
        const [result] = await db.query(`
            INSERT INTO citas (
                email_cliente,
                email_manicurista,
                id_servicio,
                fecha,
                hora_inicio,
                hora_fin,
                estado,
                precio,
                notas_cliente,
                telefono_contacto,
                nombre_cliente
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            email_cliente || null,
            email_manicurista,
            id_servicio,
            fecha,
            hora_inicio,
            horaFin,
            estadoFinal, // Usar variable estadoFinal
            req.body.precio || 0,
            notas_cliente || null,
            telefono_contacto || null,
            nombre_cliente || null
        ]);

        // Emitir evento de Socket.IO
        if (req.io) {
            req.io.emit('calendario_actualizado', {
                accion: 'crear',
                id_cita: result.insertId,
                fecha: fecha,
                manicurista: email_manicurista
            });
        }

        // Si se enviaron pagos, insertarlos con cálculo de comisión
        if (req.body.pagos && Array.isArray(req.body.pagos) && req.body.pagos.length > 0) {

            // 1. Obtener porcentaje de comisión de la manicurista
            const [config] = await db.query(`
                SELECT porcentaje FROM comisiones_manicuristas 
                WHERE email_manicurista = ? AND anio = YEAR(CURDATE())
            `, [email_manicurista]);

            const porcentaje = config.length > 0 ? config[0].porcentaje : 50; // Default 50%

            for (const pago of req.body.pagos) {
                // Calcular comisión proporcional al pago
                const montoPago = parseFloat(pago.monto) || 0;
                const comision = (montoPago * porcentaje) / 100;

                await db.query(`
                    INSERT INTO pagos (id_cita, monto, metodo_pago_cliente, notas, estado_pago_cliente, comision_manicurista)
                    VALUES (?, ?, ?, ?, 'pagado', ?)
                `, [result.insertId, montoPago, pago.metodo, pago.notas || null, comision]);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Cita creada exitosamente',
            id_cita: result.insertId
        });

    } catch (error) {
        console.error('Error al crear cita:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear la cita'
        });
    }
};

// =============================================
// ACTUALIZAR CITA
// =============================================
exports.actualizarCita = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            email_cliente,
            email_manicurista,
            id_servicio,
            fecha,
            hora_inicio,
            estado,
            notas_cliente,
            notas_manicurista,
            telefono_contacto,
            nombre_cliente // Nuevo campo
        } = req.body;

        // Si se cambian datos de horario, recalcular hora_fin
        let horaFin = null;
        if (hora_inicio && (id_servicio || req.body.duracion)) {
            let duracion;

            if (req.body.duracion) {
                duracion = parseInt(req.body.duracion);
            } else if (id_servicio) {
                const [servicios] = await db.query(
                    'SELECT duracion_minutos FROM servicios WHERE id_servicio = ?',
                    [id_servicio]
                );
                if (servicios.length > 0) {
                    duracion = servicios[0].duracion_minutos;
                }
            }

            if (duracion) {
                const [horas, minutos] = hora_inicio.split(':').map(Number);
                const totalMinutos = horas * 60 + minutos + duracion;
                horaFin = `${Math.floor(totalMinutos / 60).toString().padStart(2, '0')}:${(totalMinutos % 60).toString().padStart(2, '0')}:00`;
            }
        }

        // Construir query dinámico
        let query = 'UPDATE citas SET ';
        const params = [];
        const updates = [];

        if (email_cliente !== undefined) {
            updates.push('email_cliente = ?');
            params.push(email_cliente || null);
        }
        if (email_manicurista) {
            updates.push('email_manicurista = ?');
            params.push(email_manicurista);
        }
        if (id_servicio) {
            updates.push('id_servicio = ?');
            params.push(id_servicio);
        }
        if (fecha) {
            updates.push('fecha = ?');
            params.push(fecha);
        }
        if (hora_inicio) {
            updates.push('hora_inicio = ?');
            params.push(hora_inicio);
        }
        if (horaFin) {
            updates.push('hora_fin = ?');
            params.push(horaFin);
        }
        if (estado) {
            updates.push('estado = ?');
            params.push(estado);
        }
        if (req.body.precio !== undefined) {
            updates.push('precio = ?');
            params.push(req.body.precio);
        }
        if (notas_cliente !== undefined) {
            updates.push('notas_cliente = ?');
            params.push(notas_cliente || null);
        }
        if (notas_manicurista !== undefined) {
            updates.push('notas_manicurista = ?');
            params.push(notas_manicurista || null);
        }
        if (telefono_contacto !== undefined) {
            updates.push('telefono_contacto = ?');
            params.push(telefono_contacto || null);
        }
        if (nombre_cliente !== undefined) {
            updates.push('nombre_cliente = ?');
            params.push(nombre_cliente || null);
        }

        query += updates.join(', ') + ' WHERE id_cita = ?';
        params.push(id);

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cita no encontrada'
            });
        }

        // Si es completada, lógica de PAGOS MÚLTIPLES
        // Acepta: req.body.pagos = [{metodo, monto, notas}, ...] O req.body.metodo_pago (legacy)
        if (estado === 'completada') {
            const [citaData] = await db.query(`SELECT c.precio, c.email_manicurista, YEAR(c.fecha) as anio FROM citas c WHERE c.id_cita = ?`, [id]);

            if (citaData.length > 0) {
                const { precio, email_manicurista, anio } = citaData[0];
                const precioTotal = Number(precio) || 0;

                // Calcular comisión de manicurista
                let porcentaje = 0;
                const [comisionConfig] = await db.query(`SELECT porcentaje FROM comisiones_manicuristas WHERE email_manicurista = ? AND anio = ?`, [email_manicurista, anio]);
                if (comisionConfig.length > 0) porcentaje = comisionConfig[0].porcentaje;
                const comision = (precioTotal * porcentaje) / 100;

                // Determinar pagos a registrar
                let pagosArray = [];

                if (req.body.pagos && Array.isArray(req.body.pagos) && req.body.pagos.length > 0) {
                    // NUEVO: Múltiples pagos
                    pagosArray = req.body.pagos;
                } else if (req.body.metodo_pago) {
                    // LEGACY: Un solo pago
                    pagosArray = [{ metodo: req.body.metodo_pago, monto: precioTotal, notas: null }];
                }

                if (pagosArray.length > 0) {
                    // Validar suma EXACTA
                    const sumaPagos = pagosArray.reduce((sum, p) => sum + Number(p.monto || 0), 0);

                    if (Math.abs(sumaPagos - precioTotal) > 0.01) { // Tolerancia de 1 centavo por redondeo
                        return res.status(400).json({
                            success: false,
                            message: `La suma de los pagos ($${sumaPagos.toLocaleString()}) debe ser igual al valor de la cita ($${precioTotal.toLocaleString()})`
                        });
                    }

                    // Eliminar pagos anteriores (si existían)
                    await db.query('DELETE FROM pagos WHERE id_cita = ?', [id]);

                    // Insertar nuevos pagos
                    for (let i = 0; i < pagosArray.length; i++) {
                        const pago = pagosArray[i];
                        // Solo el primer pago lleva la comisión calculada
                        const comisionPago = (i === 0) ? comision : 0;

                        await db.query(`
                            INSERT INTO pagos (id_cita, monto, comision_manicurista, estado_pago_cliente, metodo_pago_cliente, notas, fecha_pago_cliente) 
                            VALUES (?, ?, ?, 'pagado', ?, ?, NOW())
                        `, [id, pago.monto, comisionPago, pago.metodo, pago.notas || null]);
                    }
                }
            }
        }

        // Emitir evento de Socket.IO
        if (req.io) {
            req.io.emit('calendario_actualizado', {
                accion: 'actualizar',
                id_cita: id
            });
        }

        res.json({
            success: true,
            message: 'Cita actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar la cita'
        });
    }
};

// =============================================
// ELIMINAR CITA (DELETE real de la BD)
// =============================================
exports.eliminarCita = async (req, res) => {
    // ... (sin cambios)
    try {
        const { id } = req.params;
        const [result] = await db.query(`DELETE FROM citas WHERE id_cita = ?`, [id]);
        if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Cita no encontrada' });

        // Emitir evento de Socket.IO
        if (req.io) {
            req.io.emit('calendario_actualizado', {
                accion: 'eliminar',
                id_cita: id
            });
        }

        res.json({ success: true, message: 'Cita eliminada exitosamente' });
    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar la cita' });
    }
};

// =============================================
// OBTENER PAGOS DE UNA CITA
// =============================================
exports.obtenerPagosCita = async (req, res) => {
    try {
        const { id } = req.params;
        const [pagos] = await db.query(`
            SELECT metodo_pago_cliente as metodo, monto, notas
            FROM pagos
            WHERE id_cita = ?
            ORDER BY id_pago ASC
        `, [id]);

        res.json({
            success: true,
            pagos
        });
    } catch (error) {
        console.error('Error al obtener pagos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener los pagos de la cita'
        });
    }
};

// ... (helpers de manicuristas/clientes/horarios sin cambios requeridos, omitidos en replace si no toco intervalo)
// Pero `obtenerCitasAgenda` SI requiere cambios. Y está MAS ABAJO (fuera del rango 1-450).
// Así que necesito OTRA llamada para obtenerCitasAgenda.
// Esta llamada cubre hasta linea 400 aprox.



// =============================================
// OBTENER MANICURISTAS DISPONIBLES
// =============================================
exports.obtenerManicuristasDisponibles = async (req, res) => {
    try {
        const [manicuristas] = await db.query(`
            SELECT u.email, CONCAT(u.nombre, ' ', COALESCE(u.apellido, '')) as nombre_completo, u.nombre as nombre_simple, u.apellido
            FROM usuarios u
            WHERE u.id_rol = 2 AND u.activo = 1
            ORDER BY u.nombre ASC
        `);

        res.json({
            success: true,
            manicuristas
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener manicuristas'
        });
    }
};

// =============================================
// OBTENER HORARIOS DISPONIBLES
// =============================================
exports.obtenerHorariosDisponibles = async (req, res) => {
    try {
        const { manicurista, fecha, id_servicio, id_cita_excluir } = req.query;

        console.log('📅 Solicitud de horarios:', { manicurista, fecha, id_servicio, id_cita_excluir });

        if (!manicurista || !fecha || !id_servicio) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos'
            });
        }

        let duracion;

        if (req.query.duracion) {
            duracion = parseInt(req.query.duracion);
            console.log('⏱️ Duración manual:', duracion, 'minutos');
        } else {
            // Obtener duración del servicio
            const [servicios] = await db.query(
                'SELECT duracion_minutos FROM servicios WHERE id_servicio = ?',
                [id_servicio]
            );

            if (servicios.length === 0) {
                console.log('❌ Servicio no encontrado:', id_servicio);
                return res.status(404).json({
                    success: false,
                    message: 'Servicio no encontrado'
                });
            }

            duracion = servicios[0].duracion_minutos;
            console.log('⏱️ Duración del servicio:', duracion, 'minutos');
        }

        // Obtener día de la semana (1=lunes, 7=domingo)
        const fechaObj = new Date(fecha + 'T00:00:00');
        const diaSemana = fechaObj.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
        const diaAjustado = diaSemana === 0 ? 7 : diaSemana; // Convertir domingo de 0 a 7

        console.log('📆 Día de la semana:', diaAjustado, '(1=Lun, 7=Dom)');

        // Obtener horario laboral de la manicurista para ese día (PUEDE HABER MÚLTIPLES TURNOS)
        const [horarios] = await db.query(`
            SELECT hora_inicio, hora_fin
            FROM horarios_trabajo
            WHERE email_manicurista = ?
            AND dia_semana = ?
                AND activo = 1
            ORDER BY hora_inicio ASC
        `, [manicurista, diaAjustado]);

        console.log('🕐 Horarios encontrados en BD:', horarios);

        if (horarios.length === 0) {
            console.log('⚠️ No hay horarios laborales para este día');
            return res.json({
                success: true,
                horarios: [],
                mensaje: 'La manicurista no trabaja este día'
            });
        }

        // Verificar excepciones (día completo)
        const [excepciones] = await db.query(`
            SELECT todo_el_dia, hora_inicio, hora_fin
            FROM excepciones_horario
            WHERE email_manicurista = ?
            AND fecha = ?
        `, [manicurista, fecha]);

        if (excepciones.some(e => e.todo_el_dia)) {
            console.log('🚫 Hay excepción de horario (día completo bloqueado)');
            return res.json({
                success: true,
                horarios: [],
                mensaje: 'La manicurista no está disponible este día'
            });
        }

        // Obtener citas existentes
        let queryExcluir = '';
        const params = [manicurista, fecha];

        if (id_cita_excluir) {
            queryExcluir = ' AND id_cita != ?';
            params.push(id_cita_excluir);
        }

        const [citasDB] = await db.query(`
            SELECT hora_inicio, hora_fin
            FROM citas
            WHERE email_manicurista = ?
            AND fecha = ?
                AND estado NOT IN('cancelada', 'no_asistio')
            ${queryExcluir}
            ORDER BY hora_inicio
        `, params);

        // Combinar citas y excepciones parciales
        const citasOcupadas = [
            ...citasDB,
            ...excepciones.map(e => ({ hora_inicio: e.hora_inicio, hora_fin: e.hora_fin }))
        ];

        // Obtener hora actual si es hoy
        // Obtener hora actual si es hoy (Ajustado a Zona Horaria Colombia)
        const hoy = new Date();
        const formatter = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(hoy);
        const getPart = (type) => parts.find(p => p.type === type).value;

        const anioCO = getPart('year');
        const mesCO = getPart('month');
        const diaCO = getPart('day');
        const horaCO = parseInt(getPart('hour'));
        const minCO = parseInt(getPart('minute'));

        const fechaHoyCO = `${anioCO}-${mesCO}-${diaCO}`;
        const esHoy = fecha === fechaHoyCO;
        const horaActualMinutos = esHoy ? (horaCO * 60 + minCO) : 0;

        const horariosDisponibles = [];
        const intervalo = 30;

        // ITERAR SOBRE CADA TURNO ENCONTRADO (Mañana, Tarde, etc.)
        for (const turno of horarios) {
            const [horaInicioH, horaInicioM] = turno.hora_inicio.split(':').map(Number);
            const [horaFinH, horaFinM] = turno.hora_fin.split(':').map(Number);
            const minutosInicio = horaInicioH * 60 + horaInicioM;
            const minutosFin = horaFinH * 60 + horaFinM;

            for (let minutos = minutosInicio; minutos < minutosFin; minutos += intervalo) {
                const esAdmin = req.usuario && req.usuario.nombre_rol === 'admin';
                // PERMITIR si es ADMIN (para todos los casos)
                // BLOQUEAR solo si es usuario normal y la hora ya pasó
                if (esHoy && minutos <= horaActualMinutos && !esAdmin) {
                    continue;
                }

                const hora = Math.floor(minutos / 60);
                const min = minutos % 60;
                const horaStr = `${hora.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;

                const minutosFinCita = minutos + duracion;

                if (minutosFinCita > minutosFin) continue;

                const horaFinCita = `${Math.floor(minutosFinCita / 60).toString().padStart(2, '0')}:${(minutosFinCita % 60).toString().padStart(2, '0')}:00`;

                const haySolapamiento = citasOcupadas.some(cita => {
                    // Check overlap logic is (StartA < EndB) and (EndA > StartB)
                    return (horaStr < cita.hora_fin && horaFinCita > cita.hora_inicio);
                });

                if (!haySolapamiento) {
                    horariosDisponibles.push({
                        hora: horaStr.substring(0, 5),
                        disponible: true
                    });
                }
            }
        }

        console.log('✅ Horarios disponibles generados:', horariosDisponibles.length);

        res.json({
            success: true,
            horarios: horariosDisponibles
        });

    } catch (error) {
        console.error('❌ Error en obtenerHorariosDisponibles:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener horarios disponibles'
        });
    }
};

// =============================================
// OBTENER CLIENTES
// =============================================
exports.obtenerClientes = async (req, res) => {
    try {
        const [clientes] = await db.query(`
            SELECT u.email, CONCAT(u.nombre, ' ', u.apellido) as nombre_completo, u.telefono
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE r.nombre_rol = 'cliente' AND u.activo = 1
            ORDER BY u.nombre ASC
        `);

        res.json({
            success: true,
            clientes
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener clientes'
        });
    }
};

// =============================================
// OBTENER COMISIONES MANICURISTA
// =============================================
// =============================================
// OBTENER COMISIONES MANICURISTA
// =============================================
exports.obtenerComisionesManicurista = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;
        // El email se toma del token para seguridad
        const email_manicurista = req.usuario.email;

        if (!fecha_inicio || !fecha_fin) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren fecha_inicio y fecha_fin'
            });
        }

        // Query robusto: Basado en citas completadas, no solo en pagos registrados
        // Si no hay pago registrado, se estima la comisión basada en la configuración
        const query = `
            SELECT 
                c.fecha,
                c.hora_inicio,
                s.nombre as nombre_servicio,
                c.precio as valor_servicio,
                COALESCE(
                    p.comision_manicurista, 
                    (c.precio * (
                        SELECT COALESCE(porcentaje, 0) 
                        FROM comisiones_manicuristas cm 
                        WHERE cm.email_manicurista = c.email_manicurista 
                        AND cm.anio = YEAR(c.fecha) 
                        LIMIT 1
                    ) / 100)
                ) as ganancia
            FROM citas c
            JOIN servicios s ON c.id_servicio = s.id_servicio
            LEFT JOIN pagos p ON p.id_cita = c.id_cita
            WHERE c.email_manicurista = ?
            AND c.fecha BETWEEN ? AND ?
            AND c.estado = 'completada'
            ORDER BY c.fecha DESC, c.hora_inicio DESC
        `;

        const [comisiones] = await db.query(query, [email_manicurista, fecha_inicio, fecha_fin]);

        // Calcular totales de comisiones
        const totalComisiones = comisiones.reduce((sum, item) => sum + Number(item.ganancia || 0), 0);

        // OBTENER DEDUCCIONES
        const queryDeducciones = `
            SELECT 
                fecha,
                descripcion,
                monto
            FROM gastos
            WHERE tipo = 'deduccion_manicurista'
            AND (
                usuario_asociado = ? 
                OR (usuario_asociado IS NULL AND descripcion LIKE CONCAT('%', (SELECT nombre FROM usuarios WHERE email = ?), '%'))
            )
            AND fecha BETWEEN ? AND ?
            ORDER BY fecha DESC
        `;

        // Nota: usuario_asociado debería ser el email o ID. Asumimos que se guarda algo que vincula.
        // Si no hay 'usuario_asociado', la lógica actual de gastos podría ser precaria.
        // Revisando el modal de gastos en dashboard-admin.js, al guardar gasto tipo 'deduccion_manicurista', 
        // se envía 'manicurista' (email) en el body.
        // Asumimos que en la tabla gastos existe una columna 'usuario_asociado' o 'email_manicurista'.
        // Verificando estructura de gastos en dashboard-admin.js (guardarGasto):
        // const datos = { descripcion, monto, fecha, tipo, usuario_asociado: manicurista };
        // Sí, se        // OBTENER DEDUCCIONES
        const [deducciones] = await db.query(`
            SELECT id_gasto, fecha_gasto as fecha, descripcion, monto
            FROM gastos
            WHERE tipo = 'deduccion_manicurista'
            AND email_manicurista = ?
            AND DATE(fecha_gasto) BETWEEN ? AND ?
            ORDER BY fecha_gasto DESC
        `, [email_manicurista, fecha_inicio, fecha_fin]);

        const totalDeducciones = deducciones.reduce((sum, item) => sum + Number(item.monto || 0), 0);
        const totalPagar = totalComisiones - totalDeducciones;

        res.json({
            success: true,
            comisiones,
            deducciones,
            totales: {
                comisiones: totalComisiones,
                deducciones: totalDeducciones,
                pagar: totalPagar
            }
        });

    } catch (error) {
        console.error('Error al obtener comisiones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener comisiones'
        });
    }
};

// =============================================
// OBTENER COMISIONES GLOBALES (ADMIN)
// =============================================
exports.obtenerComisionesGlobales = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, manicurista } = req.query;

        // Default: mes actual si no hay fechas
        let fInicio = fecha_inicio;
        let fFin = fecha_fin;

        if (!fInicio || !fFin) {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();
            fInicio = new Date(y, m, 1).toISOString().split('T')[0];
            fFin = new Date(y, m + 1, 0).toISOString().split('T')[0];
        }

        let query = `
            SELECT 
                c.fecha,
                c.hora_inicio,
                c.email_manicurista,
                (SELECT CONCAT(nombre, ' ', apellido) FROM usuarios u WHERE u.email = c.email_manicurista) as nombre_manicurista,
                s.nombre as nombre_servicio,
                c.precio as valor_servicio,
                COALESCE(
                    p.comision_manicurista, 
                    (c.precio * (
                        SELECT COALESCE(porcentaje, 0) 
                        FROM comisiones_manicuristas cm 
                        WHERE cm.email_manicurista = c.email_manicurista 
                        AND cm.anio = YEAR(c.fecha) 
                        LIMIT 1
                    ) / 100)
                ) as ganancia,
                c.estado
            FROM citas c
            JOIN servicios s ON c.id_servicio = s.id_servicio
            LEFT JOIN pagos p ON p.id_cita = c.id_cita
            WHERE c.fecha BETWEEN ? AND ?
            AND c.estado = 'completada'
        `;

        const params = [fInicio, fFin];

        if (manicurista) {
            query += ' AND c.email_manicurista = ?';
            params.push(manicurista);
        }

        query += ' ORDER BY c.fecha DESC, c.hora_inicio DESC';

        const [comisiones] = await db.query(query, params);

        // Calcular totales
        const total = comisiones.reduce((sum, item) => sum + Number(item.ganancia || 0), 0);
        const totalServicios = comisiones.reduce((sum, item) => sum + Number(item.valor_servicio || 0), 0);

        res.json({
            success: true,
            comisiones,
            total,
            totalServicios
        });

    } catch (error) {
        console.error('Error al obtener comisiones globales:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener comisiones globales'
        });
    }
};

// =============================================
// OBTENER CITAS PARA AGENDA (Calendario)
// =============================================
exports.obtenerCitasAgenda = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, manicurista } = req.query;

        // Verificar rol para privacidad
        const esManicurista = req.usuario && req.usuario.nombre_rol === 'manicurista';
        const campoTelefono = esManicurista ? "NULL" : "c.telefono_contacto";
        const campoTelUsuario = esManicurista ? "NULL" : "uc.telefono";

        if (!fecha_inicio || !fecha_fin) {
            return res.status(400).json({
                success: false,
                message: 'Se requieren fecha_inicio y fecha_fin'
            });
        }

        // Query base para citas
        let queryCitas = `
            SELECT
            c.id_cita,
            c.fecha,
            c.hora_inicio,
            c.hora_fin,
            c.estado,
            c.notas_cliente,
            c.email_cliente,
            ${esManicurista ? "'Cliente Reservado' as nombre_cliente" : "CONCAT(uc.nombre, ' ', uc.apellido) as nombre_cliente"},
            c.nombre_cliente as nombre_manual,
            ${campoTelUsuario} as telefono_cliente,
            ${campoTelefono} as telefono_contacto,
            c.email_manicurista,
            CONCAT(um.nombre, ' ', um.apellido) as nombre_manicurista,
            c.id_servicio,
            s.nombre as nombre_servicio,
            s.precio,
            s.duracion_minutos
            FROM citas c
            LEFT JOIN usuarios uc ON c.email_cliente = uc.email
            INNER JOIN usuarios um ON c.email_manicurista = um.email
            INNER JOIN servicios s ON c.id_servicio = s.id_servicio
            WHERE c.fecha BETWEEN ? AND ?
        `;

        const paramsCitas = [fecha_inicio, fecha_fin];

        if (esManicurista) {
            queryCitas += ` AND c.email_manicurista = ? `;
            paramsCitas.push(req.usuario.email);
        } else if (manicurista) {
            queryCitas += ` AND c.email_manicurista = ? `;
            paramsCitas.push(manicurista);
        }

        queryCitas += ` ORDER BY c.fecha, c.hora_inicio`;

        const [citas] = await db.query(queryCitas, paramsCitas);

        // Procesar citas para extraer nombres... y limpiar teléfonos en notas
        const citasProcesadas = citas.map(cita => {
            // Lógica de prioridad de nombre: 1. Usuario Registrado  2. Nombre Manual  3. Legacy Notas  4. Anónimo/Reservado

            // Si es manicurista, SIEMPRE ocultamos nombres (excepto si queremos permitir ver manuales? No, el usuario dijo "restriccion solo para manicuristas")
            // Así que si es manicurista, mantenemos 'Cliente Reservado' (que ya viene de la query como nombre_cliente).
            // Pero si es ADMIN (no esManicurista):

            if (!esManicurista) {
                if (!cita.nombre_cliente && cita.nombre_manual) {
                    cita.nombre_cliente = cita.nombre_manual;
                }
            }

            if (!cita.nombre_cliente && cita.notas_cliente) {
                const match = cita.notas_cliente.match(/\[Cliente: (.*?)\]/);
                if (match) {
                    // Si es manicurista, NO mostramos el nombre extraído de la nota
                    cita.nombre_cliente = esManicurista ? 'Cliente Reservado' : match[1];
                } else if (!cita.nombre_cliente) { // Solo si aun es null
                    cita.nombre_cliente = esManicurista ? 'Cliente Reservado' : 'Cliente Anónimo';
                }
            } else if (!cita.nombre_cliente) {
                cita.nombre_cliente = esManicurista ? 'Cliente Reservado' : 'Cliente Anónimo';
            } else if (esManicurista) {
                // Seguridad extra: si por alguna razón vino con nombre, lo pisamos
                cita.nombre_cliente = 'Cliente Reservado';
            }

            // Normalizar el retorno del telefono (usar el que exista)
            if (!esManicurista) {
                cita.telefono_cliente = cita.telefono_contacto || cita.telefono_cliente;
            }

            // Limpiar notas si es manicurista
            if (esManicurista && cita.notas_cliente) {
                cita.notas_cliente = cita.notas_cliente.replace(/\[Tel: .*?\]/g, '').trim();
            }

            return cita;
        });

        // Obtener manicuristas activas... (sin cambios)
        let queryManicuristas = `
            SELECT u.email, CONCAT(u.nombre, ' ', u.apellido) as nombre_completo
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE r.nombre_rol = 'manicurista' AND u.activo = 1
            `;

        const paramsManicuristas = [];
        if (manicurista) { // Logica original, aunque si es manicurista viendo agenda, tal vez solo deba verse a si misma? 
            // El frontend ya filtra, pero el helper manda todas. 
            // Lo dejo por compatibilidad con el selector, visualmente se maneja en front.
            queryManicuristas += ` AND email = ? `;
            paramsManicuristas.push(manicurista);
        }

        queryManicuristas += ` ORDER BY nombre ASC`;

        const [manicuristas] = await db.query(queryManicuristas, paramsManicuristas);

        // ... (resto sin cambios)
        // Obtener horarios de trabajo de las manicuristas
        const emailsManicuristas = manicuristas.map(m => m.email);

        let horariosResult = [];
        if (emailsManicuristas.length > 0) {
            const placeholders = emailsManicuristas.map(() => '?').join(',');
            const [horarios] = await db.query(`
                SELECT email_manicurista, dia_semana, hora_inicio, hora_fin
                FROM horarios_trabajo
                WHERE email_manicurista IN(${placeholders})
                AND activo = 1
                ORDER BY email_manicurista, dia_semana
            `, emailsManicuristas);
            horariosResult = horarios;
        }

        // Obtener excepciones de horario para el rango de fechas
        let excepcionesResult = [];
        if (emailsManicuristas.length > 0) {
            const placeholders = emailsManicuristas.map(() => '?').join(',');
            const [excepciones] = await db.query(`
                SELECT email_manicurista, fecha, todo_el_dia, hora_inicio, hora_fin
                FROM excepciones_horario
                WHERE email_manicurista IN(${placeholders})
                AND fecha BETWEEN ? AND ?
            `, [...emailsManicuristas, fecha_inicio, fecha_fin]);
            excepcionesResult = excepciones;
        }

        res.json({
            success: true,
            citas: citasProcesadas, // Return processed
            manicuristas,
            horarios_trabajo: horariosResult,
            excepciones: excepcionesResult
        });

    } catch (error) {
        console.error('Error en obtenerCitasAgenda:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener datos de la agenda'
        });
    }
};