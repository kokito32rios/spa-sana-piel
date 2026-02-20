const db = require('../config/db');
const bcrypt = require('bcrypt');

// =============================================
// OBTENER ROLES
// =============================================
exports.obtenerRoles = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM roles ORDER BY id_rol ASC');
        res.json({ success: true, roles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al obtener roles' });
    }
};

// =============================================
// OBTENER TODOS LOS USUARIOS
// =============================================
exports.obtenerUsuarios = async (req, res) => {
    try {
        const query = `
            SELECT u.email, u.nombre, u.apellido, r.nombre_rol as rol, u.activo, u.fecha_registro, u.id_rol
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            ORDER BY u.nombre ASC
        `;
        const [usuarios] = await db.query(query);

        res.json({
            success: true,
            usuarios
        });

    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener usuarios'
        });
    }
};

// =============================================
// OBTENER USUARIO POR ID
// =============================================
exports.obtenerUsuarioPorId = async (req, res) => {
    try {
        const { id } = req.params; // id es el email ahora
        const query = `
            SELECT u.email, u.nombre, u.apellido, u.id_rol, r.nombre_rol as rol, u.activo 
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.email = ?
        `;
        const [usuarios] = await db.query(query, [id]);

        if (usuarios.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ success: true, usuario: usuarios[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al obtener usuario' });
    }
};

// =============================================
// CREAR USUARIO
// =============================================
exports.crearUsuario = async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        if (!nombre || !email || !password || !rol) {
            return res.status(400).json({ success: false, message: 'Todos los campos son obligatorios' });
        }

        // Verificar si existe email
        const [existe] = await db.query('SELECT email FROM usuarios WHERE email = ?', [email]);
        if (existe.length > 0) {
            return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
        }

        // Encriptar password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const query = `
            INSERT INTO usuarios (nombre, apellido, email, password_hash, id_rol, activo)
            VALUES (?, ?, ?, ?, ?, 1)
        `;

        // Asumiendo que "nombre" viene completo o el frontend envía apellido aparte.
        // Por compatibilidad simple, usaremos nombre para ambos si no hay apellido, o ajustamos el frontend.
        // Ajuste: Separar nombre si viene junto, o pedir apellido. 
        // Para simplificar ahora: apellido = ''
        // Ajuste: Separar nombre y apellido explícitamente
        const apellido = req.body.apellido || '';

        await db.query(query, [nombre, apellido, email, passwordHash, rol]);

        res.status(201).json({
            success: true,
            message: 'Usuario creado exitosamente'
        });

    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ success: false, error: 'Error al crear usuario' });
    }
};

// =============================================
// ACTUALIZAR USUARIO
// =============================================
exports.actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, email, rol, password } = req.body;

        // Validar cambio de email (que es el ID)
        if (email && email !== id) {
            return res.status(400).json({ success: false, message: 'No se puede cambiar el email (es el identificador)' });
        }

        const fieldsToUpdate = [];
        const params = [];

        if (nombre) {
            fieldsToUpdate.push('nombre = ?');
            params.push(nombre);
        }

        if (apellido !== undefined) {
            fieldsToUpdate.push('apellido = ?');
            params.push(apellido);
        }

        // Solo actualizar rol si se envía
        if (rol) {
            fieldsToUpdate.push('id_rol = ?');
            params.push(rol);
        }

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            fieldsToUpdate.push('password_hash = ?');
            params.push(passwordHash);
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).json({ success: false, message: 'No se enviaron datos para actualizar' });
        }

        // Agregar ID al final de params
        params.push(id);

        const query = `UPDATE usuarios SET ${fieldsToUpdate.join(', ')} WHERE email = ?`;

        const [result] = await db.query(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ success: true, message: 'Usuario actualizado exitosamente' });

    } catch (error) {
        console.error('Error actualizarUsuario:', error);
        res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
};

// =============================================
// CAMBIAR ESTADO
// =============================================
exports.toggleEstadoUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;

        await db.query('UPDATE usuarios SET activo = ? WHERE email = ?', [activo, id]);

        res.json({ success: true, message: `Usuario ${activo ? 'activado' : 'desactivado'}` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Error al cambiar estado' });
    }
};

// =============================================
// ELIMINAR USUARIO
// =============================================
exports.eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar dependencias (ej: citas asignadas si es manicurista)
        // Por ahora eliminamos directo, o podríamos marcar como inactivo permanente
        // Check if user has appointments ? (Optional future safety check)

        const [result] = await db.query('DELETE FROM usuarios WHERE email = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ success: true, message: 'Usuario eliminado correctamente' });

    } catch (error) {
        console.error(error);

        // Error de llave foránea (1451 en MySQL)
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar el usuario porque tiene datos asociados (citas, horarios, pagos). Intenta desactivarlo en su lugar.'
            });
        }

        res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
};
