-- =========================================================
-- SCRIPT COMPLETO DE BASE DE DATOS - SPA SANA PIEL
-- Consolidado con todos los parches y ajustes
-- =========================================================

-- 1. CREAR BASE DE DATOS
CREATE DATABASE IF NOT EXISTS spa_sana_piel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE spa_sana_piel;

-- =========================================================
-- 2. TABLAS PRINCIPALES (MODIFICADAS)
-- =========================================================

-- ROLES (Versión final con ID)
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL,
    descripcion VARCHAR(150) DEFAULT NULL,
    UNIQUE KEY idx_nombre_rol (nombre_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USUARIOS (Versión final con id_rol y sin nombre_rol string)
CREATE TABLE IF NOT EXISTS usuarios (
    email VARCHAR(100) PRIMARY KEY,
    id_rol INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) DEFAULT NULL,
    foto_perfil VARCHAR(255),
    activo TINYINT(1) DEFAULT 1,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SERVICIOS
CREATE TABLE IF NOT EXISTS servicios (
    id_servicio INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL UNIQUE,
    precio DECIMAL(10, 2) NOT NULL,
    duracion_minutos SMALLINT NOT NULL CHECK (duracion_minutos > 0),
    descripcion TEXT DEFAULT NULL,
    activo TINYINT(1) DEFAULT 1,
    INDEX idx_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HORARIOS DE TRABAJO (Sin restricción única para permitir turnos partidos)
CREATE TABLE IF NOT EXISTS horarios_trabajo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_manicurista VARCHAR(100) NOT NULL,
    dia_semana TINYINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 7), -- 1=lunes
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    activo TINYINT(1) DEFAULT 1,
    FOREIGN KEY (email_manicurista) REFERENCES usuarios(email) ON DELETE CASCADE,
    INDEX idx_manicurista (email_manicurista)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- EXCEPCIONES DE HORARIO
CREATE TABLE IF NOT EXISTS excepciones_horario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_manicurista VARCHAR(100) NOT NULL,
    fecha DATE NOT NULL,
    todo_el_dia TINYINT(1) DEFAULT 1,
    hora_inicio TIME DEFAULT NULL,
    hora_fin TIME DEFAULT NULL,
    motivo VARCHAR(150) DEFAULT NULL,
    FOREIGN KEY (email_manicurista) REFERENCES usuarios(email) ON DELETE CASCADE,
    UNIQUE KEY uk_excepcion (email_manicurista, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 3. CITAS Y OPERACIONES
-- =========================================================

-- CITAS
CREATE TABLE IF NOT EXISTS citas (
    id_cita INT AUTO_INCREMENT PRIMARY KEY,
    email_cliente VARCHAR(100) NULL,
    nombre_cliente VARCHAR(255) NULL,
    email_manicurista VARCHAR(100) NOT NULL,
    id_servicio INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    telefono_contacto VARCHAR(20) DEFAULT NULL,
    estado ENUM('pendiente', 'confirmada', 'completada', 'cancelada', 'no_asistio') DEFAULT 'pendiente',
    precio DECIMAL(10, 2) NOT NULL,
    notas_cliente TEXT,
    notas_manicurista TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_cliente) REFERENCES usuarios(email),
    FOREIGN KEY (email_manicurista) REFERENCES usuarios(email),
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio),
    INDEX idx_fecha_estado (fecha, estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- COMISIONES (Configuración anual)
CREATE TABLE IF NOT EXISTS comisiones_manicuristas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_manicurista VARCHAR(100) NOT NULL,
    anio YEAR NOT NULL,
    porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
    FOREIGN KEY (email_manicurista) REFERENCES usuarios(email) ON DELETE CASCADE,
    UNIQUE KEY uk_comision_anio (email_manicurista, anio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PAGOS
CREATE TABLE IF NOT EXISTS pagos (
    id_pago INT AUTO_INCREMENT PRIMARY KEY,
    id_cita INT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    comision_manicurista DECIMAL(10, 2) NOT NULL,
    estado_pago_cliente ENUM('pendiente', 'pagado', 'reembolsado') DEFAULT 'pendiente',
    estado_pago_manicurista ENUM('pendiente', 'pagado') DEFAULT 'pendiente',
    metodo_pago_cliente VARCHAR(50),
    notas VARCHAR(150) DEFAULT NULL,
    fecha_pago_manicurista DATETIME,
    fecha_pago_cliente DATETIME,
    FOREIGN KEY (id_cita) REFERENCES citas(id_cita) ON DELETE CASCADE,
    INDEX idx_id_cita (id_cita)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 4. COSTOS Y REPORTES
-- =========================================================

-- GASTOS
CREATE TABLE IF NOT EXISTS gastos (
    id_gasto INT AUTO_INCREMENT PRIMARY KEY,
    descripcion VARCHAR(255) NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    tipo ENUM('gasto_local', 'deduccion_manicurista', 'insumo', 'personal', 'otro') DEFAULT 'otro',
    email_manicurista VARCHAR(100),
    fecha_gasto DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_manicurista) REFERENCES usuarios(email) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CIERRES DE CAJA
CREATE TABLE IF NOT EXISTS cierres_caja (
    id_cierre INT AUTO_INCREMENT PRIMARY KEY,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    total_ingresos_efectivo DECIMAL(10, 2) DEFAULT 0,
    total_ingresos_transferencia DECIMAL(10, 2) DEFAULT 0,
    total_gastos DECIMAL(10, 2) DEFAULT 0,
    total_pagado_manicuristas DECIMAL(10, 2) DEFAULT 0,
    balance_final DECIMAL(10, 2) DEFAULT 0,
    observaciones TEXT DEFAULT NULL,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fechas (fecha_inicio, fecha_fin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- REPORTES_MANICURISTA (Conciliación)
CREATE TABLE IF NOT EXISTS reportes_manicurista (
    id_reporte BIGINT AUTO_INCREMENT PRIMARY KEY,
    email_manicurista VARCHAR(100) NOT NULL,
    fecha DATE NOT NULL,
    descripcion TEXT NOT NULL,
    valor_reportado DECIMAL(10, 2) NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (email_manicurista) REFERENCES usuarios(email) ON DELETE CASCADE,
    INDEX idx_manicurista_fecha (email_manicurista, fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- GALERÍA
CREATE TABLE IF NOT EXISTS trabajos_imagenes (
    id_imagen INT AUTO_INCREMENT PRIMARY KEY,
    id_servicio INT NOT NULL,
    url_imagen VARCHAR(500) NOT NULL,
    descripcion TEXT,
    activo TINYINT(1) DEFAULT 1,
    imagen_principal TINYINT(1) DEFAULT 0,
    orden SMALLINT DEFAULT 0,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =========================================================
-- 5. SEEDER (DATOS INICIALES)
-- =========================================================

-- Roles
INSERT IGNORE INTO roles (id_rol, nombre_rol, descripcion) VALUES 
(1, 'admin', 'Administrador del sistema'),
(2, 'lashista', 'Profesional de servicios'),
(3, 'cliente', 'Usuario final');

-- Servicios Iniciales
INSERT IGNORE INTO servicios (nombre, precio, duracion_minutos, descripcion) VALUES
('Manicura Tradicional', 35000, 60, 'Limado, cutícula, esmaltado y crema hidratante'),
('Manicura en Gel', 55000, 60, 'Esmalte semipermanente, duración 3 semanas'),
('Pedicura Spa', 45000, 60, 'Exfoliación, masaje y esmaltado'),
('Uñas Acrílicas', 80000, 120, 'Extensión y diseño básico'),
('Diseño de Uñas', 15000, 30, 'Arte adicional por uña o set'),
('Kapping Gel', 70000, 90, 'Recubrimiento fortalecedor');
