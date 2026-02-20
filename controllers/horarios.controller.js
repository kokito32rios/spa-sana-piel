const db = require('../config/db');

// =============================================
// OBTENER HORARIOS POR MANICURISTA
// =============================================
exports.obtenerHorarios = async (req, res) => {
    try {
        const { email } = req.params;

        const [horarios] = await db.query(`
            SELECT id, email_manicurista, dia_semana, hora_inicio, hora_fin, activo
            FROM horarios_trabajo
            WHERE email_manicurista = ?
            ORDER BY dia_semana ASC
        `, [email]);

        res.json({
            success: true,
            horarios
        });

    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener horarios'
        });
    }
};

// =============================================
// CREAR HORARIO
// =============================================
exports.crearHorario = async (req, res) => {
    try {
        const { email_manicurista, dia_semana, hora_inicio, hora_fin } = req.body;

        if (!email_manicurista || !dia_semana || !hora_inicio || !hora_fin) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos'
            });
        }

        // Verificar solapamiento de horas para el mismo día
        // Lógica: Un horario existe si: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
        const [solapamientos] = await db.query(`
            SELECT id FROM horarios_trabajo
            WHERE email_manicurista = ? 
            AND dia_semana = ?
            AND activo = 1
            AND (hora_inicio < ? AND hora_fin > ?)
        `, [
            email_manicurista,
            dia_semana,
            hora_fin,
            hora_inicio
        ]);

        if (solapamientos.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'El horario se cruza con otro existente para este día'
            });
        }

        const [result] = await db.query(`
            INSERT INTO horarios_trabajo (email_manicurista, dia_semana, hora_inicio, hora_fin, activo)
            VALUES (?, ?, ?, ?, 1)
        `, [email_manicurista, dia_semana, hora_inicio, hora_fin]);

        res.status(201).json({
            success: true,
            message: 'Horario creado exitosamente',
            id: result.insertId
        });

    } catch (error) {
        console.error('Error al crear horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear horario'
        });
    }
};

// =============================================
// ACTUALIZAR HORARIO
// =============================================
exports.actualizarHorario = async (req, res) => {
    try {
        const { id } = req.params;
        const { hora_inicio, hora_fin, activo } = req.body;

        const updates = [];
        const params = [];

        if (hora_inicio) {
            updates.push('hora_inicio = ?');
            params.push(hora_inicio);
        }
        if (hora_fin) {
            updates.push('hora_fin = ?');
            params.push(hora_fin);
        }
        if (activo !== undefined) {
            updates.push('activo = ?');
            params.push(activo ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        params.push(id);

        const [result] = await db.query(`
            UPDATE horarios_trabajo SET ${updates.join(', ')} WHERE id = ?
        `, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Horario actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar horario'
        });
    }
};

// =============================================
// COPIAR HORARIO
// =============================================
exports.copiarHorario = async (req, res) => {
    try {
        const { email_origen, email_destino } = req.body;

        if (!email_origen || !email_destino) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos (origen y destino)'
            });
        }

        if (email_origen === email_destino) {
            return res.status(400).json({
                success: false,
                message: 'El origen y el destino no pueden ser el mismo'
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Obtener horarios del origen
            const [horariosOrigen] = await connection.query(`
                SELECT dia_semana, hora_inicio, hora_fin, activo
                FROM horarios_trabajo
                WHERE email_manicurista = ?
            `, [email_origen]);

            if (horariosOrigen.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    success: false,
                    message: 'La manicurista de origen no tiene horarios configurados'
                });
            }

            // 2. Eliminar horarios del destino
            await connection.query(`
                DELETE FROM horarios_trabajo WHERE email_manicurista = ?
            `, [email_destino]);

            // 3. Insertar nuevos horarios
            for (const h of horariosOrigen) {
                await connection.query(`
                    INSERT INTO horarios_trabajo (email_manicurista, dia_semana, hora_inicio, hora_fin, activo)
                    VALUES (?, ?, ?, ?, ?)
                `, [email_destino, h.dia_semana, h.hora_inicio, h.hora_fin, h.activo]);
            }

            await connection.commit();
            connection.release();

            res.json({
                success: true,
                message: 'Horarios copiados exitosamente'
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Error al copiar horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al copiar horario'
        });
    }
};

exports.eliminarHorario = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(`
            DELETE FROM horarios_trabajo WHERE id = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Horario no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Horario eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar horario'
        });
    }
};

// =============================================
// OBTENER EXCEPCIONES POR MANICURISTA
// =============================================
exports.obtenerExcepciones = async (req, res) => {
    try {
        const { email } = req.params;

        const [excepciones] = await db.query(`
            SELECT id, email_manicurista, fecha, todo_el_dia, hora_inicio, hora_fin, motivo
            FROM excepciones_horario
            WHERE email_manicurista = ?
            ORDER BY fecha DESC
        `, [email]);

        res.json({
            success: true,
            excepciones
        });

    } catch (error) {
        console.error('Error al obtener excepciones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener excepciones'
        });
    }
};

// =============================================
// CREAR EXCEPCIÓN
// =============================================
exports.crearExcepcion = async (req, res) => {
    try {
        const { email_manicurista, fecha, todo_el_dia, hora_inicio, hora_fin, motivo } = req.body;

        if (!email_manicurista || !fecha) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos requeridos'
            });
        }

        // Verificar que no exista ya una excepción para esa fecha
        const [existente] = await db.query(`
            SELECT id FROM excepciones_horario
            WHERE email_manicurista = ? AND fecha = ?
        `, [email_manicurista, fecha]);

        if (existente.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una excepción para esta fecha'
            });
        }

        const [result] = await db.query(`
            INSERT INTO excepciones_horario (email_manicurista, fecha, todo_el_dia, hora_inicio, hora_fin, motivo)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            email_manicurista,
            fecha,
            todo_el_dia ? 1 : 0,
            todo_el_dia ? null : hora_inicio,
            todo_el_dia ? null : hora_fin,
            motivo || null
        ]);

        res.status(201).json({
            success: true,
            message: 'Excepción creada exitosamente',
            id: result.insertId
        });

    } catch (error) {
        console.error('Error al crear excepción:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear excepción'
        });
    }
};

// =============================================
// ACTUALIZAR EXCEPCIÓN
// =============================================
exports.actualizarExcepcion = async (req, res) => {
    try {
        const { id } = req.params;
        const { fecha, todo_el_dia, hora_inicio, hora_fin, motivo } = req.body;

        const updates = [];
        const params = [];

        if (fecha) {
            updates.push('fecha = ?');
            params.push(fecha);
        }

        // todo_el_dia es booleano, siempre se actualiza si viene
        if (todo_el_dia !== undefined) {
            updates.push('todo_el_dia = ?');
            params.push(todo_el_dia ? 1 : 0);

            // Si es todo el día, limpiamos horas logicamente
            if (todo_el_dia) {
                updates.push('hora_inicio = NULL');
                updates.push('hora_fin = NULL');
            } else {
                if (hora_inicio) {
                    updates.push('hora_inicio = ?');
                    params.push(hora_inicio);
                }
                if (hora_fin) {
                    updates.push('hora_fin = ?');
                    params.push(hora_fin);
                }
            }
        } else {
            // Si no cambia todo_el_dia, pero cambian horas
            if (hora_inicio) {
                updates.push('hora_inicio = ?');
                params.push(hora_inicio);
            }
            if (hora_fin) {
                updates.push('hora_fin = ?');
                params.push(hora_fin);
            }
        }

        if (motivo !== undefined) {
            updates.push('motivo = ?');
            params.push(motivo);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay campos para actualizar'
            });
        }

        params.push(id);

        const [result] = await db.query(`
            UPDATE excepciones_horario SET ${updates.join(', ')} WHERE id = ?
        `, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Excepción no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Excepción actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar excepción:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar excepción'
        });
    }
};

// =============================================
// ELIMINAR EXCEPCIÓN
// =============================================
exports.eliminarExcepcion = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(`
            DELETE FROM excepciones_horario WHERE id = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Excepción no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Excepción eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar excepción:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar excepción'
        });
    }
};
