const jwt = require('jsonwebtoken');

// =============================================
// VERIFICAR TOKEN JWT
// =============================================
exports.verificarToken = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token no proporcionado'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Token inválido o expirado'
        });
    }
};

// =============================================
// VERIFICAR ROL ESPECÍFICO
// =============================================
exports.verificarRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: 'No autenticado'
            });
        }

        if (!rolesPermitidos.includes(req.usuario.nombre_rol)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para realizar esta acción'
            });
        }

        next();
    };
};

// =============================================
// VERIFICAR QUE SEA ADMIN
// =============================================
exports.soloAdmin = (req, res, next) => {
    if (req.usuario?.nombre_rol !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Solo administradores pueden realizar esta acción'
        });
    }
    next();
};