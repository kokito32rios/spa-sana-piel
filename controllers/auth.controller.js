const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// =============================================
// LOGIN
// =============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validar que vengan los datos
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor ingresa tu correo y contraseña'
            });
        }

        // Buscar usuario por email con su rol (JOIN)
        const query = `
            SELECT u.*, r.nombre_rol 
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.email = ? AND u.activo = 1
        `;
        const [usuarios] = await db.query(query, [email.toLowerCase().trim()]);

        // Usuario no encontrado
        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado',
                tipo: 'usuario_no_existe'
            });
        }

        const usuario = usuarios[0];

        // Verificar contraseña
        const passwordValido = await bcrypt.compare(password, usuario.password_hash);

        if (!passwordValido) {
            return res.status(401).json({
                success: false,
                message: 'Contraseña incorrecta',
                tipo: 'password_incorrecto'
            });
        }

        // Generar JWT
        const token = jwt.sign(
            {
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                nombre_rol: usuario.nombre_rol // Ahora viene del JOIN
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Login exitoso
        res.json({
            success: true,
            message: 'Login exitoso',
            token,
            usuario: {
                email: usuario.email,
                nombre: usuario.nombre,
                apellido: usuario.apellido,
                rol: usuario.nombre_rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error en el servidor'
        });
    }
};

// =============================================
// VERIFICAR TOKEN
// =============================================
exports.verificarToken = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token no proporcionado'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.json({
            success: true,
            usuario: decoded
        });

    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token inválido o expirado'
        });
    }
};

// =============================================
// MIDDLEWARE DE AUTENTICACIÓN (para proteger rutas)
// =============================================
exports.authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token no proporcionado'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded; // Attach user info to request
        next(); // Continue to next handler
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token inválido o expirado'
        });
    }
};