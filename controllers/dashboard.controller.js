const db = require('../config/db');

// =============================================
// MÉTRICAS DEL DASHBOARD
// =============================================
exports.obtenerMetricas = async (req, res) => {
    try {
        const { mes, anio, fecha_inicio, fecha_fin, email_manicurista } = req.query;

        let dateFilter, params;

        // Soporte para rango de fechas
        if (fecha_inicio && fecha_fin) {
            dateFilter = 'DATE(c.fecha) BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        } else {
            // Legacy: mes/año
            const year = anio || new Date().getFullYear();
            const month = mes || null;

            if (month) {
                dateFilter = 'YEAR(c.fecha) = ? AND MONTH(c.fecha) = ?';
                params = [year, month];
            } else {
                dateFilter = 'YEAR(c.fecha) = ?';
                params = [year];
            }
        }

        // Agregar filtro de manicurista si se proporciona
        let manicuristaFilter = '';
        if (email_manicurista) {
            manicuristaFilter = ' AND c.email_manicurista = ?';
            params.push(email_manicurista);
        }


        // Ingresos totales (pagos de clientes) - usar fecha de CITA
        const [ingresos] = await db.query(`
            SELECT 
                COALESCE(SUM(p.monto), 0) as total_ingresos,
                COUNT(*) as cantidad_pagos
            FROM pagos p
            INNER JOIN citas c ON p.id_cita = c.id_cita
            WHERE p.estado_pago_cliente = 'pagado' AND ${dateFilter}${manicuristaFilter}
        `, params);

        // Comisiones pagadas a manicuristas - usar fecha de CITA
        const [comisiones] = await db.query(`
            SELECT COALESCE(SUM(p.comision_manicurista), 0) as total_comisiones
            FROM pagos p
            INNER JOIN citas c ON p.id_cita = c.id_cita
            WHERE p.estado_pago_cliente = 'pagado' AND ${dateFilter}${manicuristaFilter}
        `, params);

        // Gastos totales - filtrar solo deducciones si hay manicurista
        let gastosParams = params.slice(0, params.length - (email_manicurista ? 1 : 0));
        let gastosQuery = `
            SELECT 
                COALESCE(SUM(monto), 0) as total_gastos,
                COALESCE(SUM(CASE WHEN tipo = 'gasto_local' THEN monto ELSE 0 END), 0) as gastos_local,
                COALESCE(SUM(CASE WHEN tipo = 'deduccion_manicurista' THEN monto ELSE 0 END), 0) as deducciones
            FROM gastos 
            WHERE ${fecha_inicio ? 'DATE(fecha_gasto) BETWEEN ? AND ?' : (mes ? 'YEAR(fecha_gasto) = ? AND MONTH(fecha_gasto) = ?' : 'YEAR(fecha_gasto) = ?')}
        `;

        if (email_manicurista) {
            gastosQuery += ' AND (tipo != \'deduccion_manicurista\' OR email_manicurista = ?)';
            gastosParams.push(email_manicurista);
        }

        const [gastos] = await db.query(gastosQuery, gastosParams);

        // Citas completadas
        const [citas] = await db.query(`
            SELECT 
                COUNT(*) as total_citas,
                SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as completadas,
                SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) as canceladas,
                SUM(CASE WHEN estado = 'pendiente' THEN 1 ELSE 0 END) as pendientes
            FROM citas c
            WHERE ${dateFilter}${manicuristaFilter}
        `, params);

        const totalIngresos = parseFloat(ingresos[0].total_ingresos) || 0;
        const totalComisiones = parseFloat(comisiones[0].total_comisiones) || 0;
        const totalGastos = parseFloat(gastos[0].total_gastos) || 0;
        const balanceNeto = totalIngresos - totalComisiones - totalGastos;

        res.json({
            success: true,
            metricas: {
                ingresos: {
                    total: totalIngresos,
                    cantidad: ingresos[0].cantidad_pagos
                },
                comisiones: {
                    total: totalComisiones
                },
                gastos: {
                    total: totalGastos,
                    local: parseFloat(gastos[0].gastos_local) || 0,
                    deducciones: parseFloat(gastos[0].deducciones) || 0
                },
                balance: balanceNeto,
                citas: {
                    total: citas[0].total_citas || 0,
                    completadas: citas[0].completadas || 0,
                    canceladas: citas[0].canceladas || 0,
                    pendientes: citas[0].pendientes || 0
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener métricas:', error);
        res.status(500).json({ success: false, error: 'Error al obtener métricas', details: error.message });
    }
};

// =============================================
// DATOS PARA GRÁFICO (Ingresos vs Gastos por mes)
// =============================================
exports.obtenerDatosGrafico = async (req, res) => {
    try {
        const { anio } = req.query;
        const year = anio || new Date().getFullYear();

        // Ingresos por mes
        const [ingresosMes] = await db.query(`
            SELECT 
                MONTH(p.fecha_pago_cliente) as mes,
                COALESCE(SUM(p.monto), 0) as total
            FROM pagos p
            WHERE YEAR(p.fecha_pago_cliente) = ? AND p.estado_pago_cliente = 'pagado'
            GROUP BY MONTH(p.fecha_pago_cliente)
            ORDER BY mes
        `, [year]);

        // Gastos por mes
        const [gastosMes] = await db.query(`
            SELECT 
                MONTH(fecha_gasto) as mes,
                COALESCE(SUM(monto), 0) as total
            FROM gastos 
            WHERE YEAR(fecha_gasto) = ?
            GROUP BY MONTH(fecha_gasto)
            ORDER BY mes
        `, [year]);

        // Comisiones por mes
        const [comisionesMes] = await db.query(`
            SELECT 
                MONTH(p.fecha_pago_cliente) as mes,
                COALESCE(SUM(p.comision_manicurista), 0) as total
            FROM pagos p
            WHERE YEAR(p.fecha_pago_cliente) = ? AND p.estado_pago_cliente = 'pagado'
            GROUP BY MONTH(p.fecha_pago_cliente)
            ORDER BY mes
        `, [year]);

        // Crear arrays de 12 meses con valores 0
        const ingresos = Array(12).fill(0);
        const gastos = Array(12).fill(0);
        const comisiones = Array(12).fill(0);

        ingresosMes.forEach(r => { ingresos[r.mes - 1] = parseFloat(r.total); });
        gastosMes.forEach(r => { gastos[r.mes - 1] = parseFloat(r.total); });
        comisionesMes.forEach(r => { comisiones[r.mes - 1] = parseFloat(r.total); });

        res.json({
            success: true,
            grafico: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
                datasets: {
                    ingresos,
                    gastos,
                    comisiones
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener datos del gráfico:', error);
        res.status(500).json({ success: false, error: 'Error al obtener datos del gráfico', details: error.message });
    }
};

// =============================================
// RESUMEN POR MANICURISTA
// =============================================
exports.obtenerResumenManicuristas = async (req, res) => {
    try {
        const { mes, anio, fecha_inicio, fecha_fin, email_manicurista } = req.query;

        let dateFilter, params;

        // Soporte para rango de fechas
        if (fecha_inicio && fecha_fin) {
            dateFilter = 'DATE(c.fecha) BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        } else {
            // Legacy: mes/año
            const year = anio || new Date().getFullYear();
            const month = mes || null;

            if (month) {
                dateFilter = 'YEAR(c.fecha) = ? AND MONTH(c.fecha) = ?';
                params = [year, month];
            } else {
                dateFilter = 'YEAR(c.fecha) = ?';
                params = [year];
            }
        }

        // Agregar filtro de manicurista si se proporciona
        let manicuristaFilter = '';
        if (email_manicurista) {
            manicuristaFilter = ' AND c.email_manicurista = ?';
            params.push(email_manicurista);
        }

        // Obtener ingresos agrupados por fecha y manicurista - usar fecha de CITA
        const [resumen] = await db.query(`
            SELECT 
                DATE(c.fecha) as fecha,
                c.email_manicurista,
                CONCAT(u.nombre, ' ', u.apellido) as nombre_manicurista,
                COUNT(*) as cantidad_servicios,
                COALESCE(SUM(p.monto), 0) as ingresos_generados,
                COALESCE(SUM(p.comision_manicurista), 0) as comision_total
            FROM pagos p
            INNER JOIN citas c ON p.id_cita = c.id_cita
            INNER JOIN usuarios u ON c.email_manicurista = u.email
            WHERE p.estado_pago_cliente = 'pagado' AND ${dateFilter}${manicuristaFilter}
            GROUP BY DATE(c.fecha), c.email_manicurista, u.nombre, u.apellido
            ORDER BY DATE(c.fecha) DESC, comision_total DESC
        `, params);

        // Obtener deducciones agrupadas por fecha y manicurista
        let deduccionesFilter, deduccionesParams;
        if (fecha_inicio && fecha_fin) {
            deduccionesFilter = 'DATE(fecha_gasto) BETWEEN ? AND ?';
            deduccionesParams = [fecha_inicio, fecha_fin];
        } else {
            const year = anio || new Date().getFullYear();
            const month = mes || null;
            if (month) {
                deduccionesFilter = 'YEAR(fecha_gasto) = ? AND MONTH(fecha_gasto) = ?';
                deduccionesParams = [year, month];
            } else {
                deduccionesFilter = 'YEAR(fecha_gasto) = ?';
                deduccionesParams = [year];
            }
        }

        const [deducciones] = await db.query(`
            SELECT 
                DATE(fecha_gasto) as fecha,
                email_manicurista,
                COALESCE(SUM(monto), 0) as total_deducciones
            FROM gastos
            WHERE tipo = 'deduccion_manicurista' AND ${deduccionesFilter}
            GROUP BY DATE(fecha_gasto), email_manicurista
        `, deduccionesParams);

        // Crear mapa de deducciones
        const deduccionesMap = {};
        deducciones.forEach(d => {
            const key = `${d.fecha.toISOString().split('T')[0]}_${d.email_manicurista}`;
            deduccionesMap[key] = parseFloat(d.total_deducciones);
        });

        // Combinar ingresos con deducciones
        const resumenFinal = resumen.map(r => {
            const fechaStr = r.fecha.toISOString().split('T')[0];
            const key = `${fechaStr}_${r.email_manicurista}`;
            return {
                fecha: fechaStr,
                email_manicurista: r.email_manicurista,
                nombre_manicurista: r.nombre_manicurista,
                cantidad_servicios: r.cantidad_servicios,
                ingresos_generados: parseFloat(r.ingresos_generados),
                comision_total: parseFloat(r.comision_total),
                deducciones: deduccionesMap[key] || 0
            };
        });

        res.json({ success: true, resumen: resumenFinal });

    } catch (error) {
        console.error('Error al obtener resumen:', error);
        res.status(500).json({ success: false, error: 'Error al obtener resumen', details: error.message });
    }
};

// =============================================
// CUADRE DE CAJA
// =============================================
exports.obtenerCuadreCaja = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, email_manicurista } = req.query;

        if (!fecha_inicio || !fecha_fin) {
            return res.status(400).json({ success: false, error: 'Se requieren fecha_inicio y fecha_fin' });
        }

        // Preparar params y filtro
        const params = [fecha_inicio, fecha_fin];
        let manicuristaFilter = '';
        if (email_manicurista) {
            manicuristaFilter = ' AND c.email_manicurista = ?';
            params.push(email_manicurista);
        }

        // Ingresos por método de pago - usar fecha de CITA
        const [ingresosPorMetodo] = await db.query(`
            SELECT 
                p.metodo_pago_cliente as metodo,
                COALESCE(SUM(p.monto), 0) as total,
                COUNT(*) as cantidad
            FROM pagos p
            INNER JOIN citas c ON p.id_cita = c.id_cita
            WHERE p.estado_pago_cliente = 'pagado' 
            AND DATE(c.fecha) BETWEEN ? AND ?${manicuristaFilter}
            AND p.metodo_pago_cliente IN ('efectivo', 'transferencia')
            GROUP BY p.metodo_pago_cliente
        `, params);

        // Total ingresos - usar fecha de CITA
        const [totalIngresos] = await db.query(`
            SELECT COALESCE(SUM(p.monto), 0) as total
            FROM pagos p
            INNER JOIN citas c ON p.id_cita = c.id_cita
            WHERE p.estado_pago_cliente = 'pagado' 
            AND DATE(c.fecha) BETWEEN ? AND ?${manicuristaFilter}
        `, params);

        // Total gastos del período
        const [totalGastos] = await db.query(`
            SELECT COALESCE(SUM(monto), 0) as total
            FROM gastos
            WHERE DATE(fecha_gasto) BETWEEN ? AND ?
        `, [fecha_inicio, fecha_fin]);

        // Procesar resultados
        const metodos = {
            efectivo: { total: 0, cantidad: 0 },
            transferencia: { total: 0, cantidad: 0 }
        };

        ingresosPorMetodo.forEach(row => {
            if (row.metodo && metodos[row.metodo]) {
                metodos[row.metodo] = {
                    total: parseFloat(row.total) || 0,
                    cantidad: row.cantidad || 0
                };
            }
        });

        // Calcular lo que debe haber en efectivo
        // = Ingresos en efectivo - Gastos (asumiendo gastos se pagan en efectivo)
        const ingresoTotal = parseFloat(totalIngresos[0].total) || 0;
        const gastoTotal = parseFloat(totalGastos[0].total) || 0;
        const debeHaberEfectivo = metodos.efectivo.total - gastoTotal;

        res.json({
            success: true,
            cuadre: {
                total: ingresoTotal,
                metodos,
                gastos: gastoTotal,
                debeEfectivo: debeHaberEfectivo
            }
        });

    } catch (error) {
        console.error('Error al obtener cuadre de caja:', error);
        res.status(500).json({ success: false, error: 'Error al obtener cuadre de caja', details: error.message });
    }
};

// =============================================
// DETALLE DE PAGOS (CUADRE TABLE) - RESUMEN POR DÍA
// =============================================
exports.obtenerDetallePagos = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, email_manicurista } = req.query;

        if (!fecha_inicio || !fecha_fin) {
            return res.status(400).json({ success: false, error: 'Se requieren fecha_inicio y fecha_fin' });
        }

        // Preparar params y filtro
        const params = [fecha_inicio, fecha_fin];
        let manicuristaFilter = '';
        if (email_manicurista) {
            manicuristaFilter = ' AND c.email_manicurista = ?';
            params.push(email_manicurista);
        }

        // Obtener ingresos agrupados por fecha y método de pago - usar fecha de CITA
        const [ingresosPorDia] = await db.query(`
            SELECT 
                DATE(c.fecha) as fecha,
                COALESCE(SUM(p.monto), 0) as total_ingresos,
                COALESCE(SUM(CASE WHEN p.metodo_pago_cliente = 'efectivo' THEN p.monto ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN p.metodo_pago_cliente = 'transferencia' THEN p.monto ELSE 0 END), 0) as transferencia
            FROM pagos p
            INNER JOIN citas c ON p.id_cita = c.id_cita
            WHERE p.estado_pago_cliente = 'pagado'
            AND DATE(c.fecha) BETWEEN ? AND ?${manicuristaFilter}
            GROUP BY DATE(c.fecha)
            ORDER BY DATE(c.fecha) DESC
        `, params);

        // Obtener gastos agrupados por fecha
        const [gastosPorDia] = await db.query(`
            SELECT 
                DATE(fecha_gasto) as fecha,
                COALESCE(SUM(monto), 0) as total_gastos
            FROM gastos
            WHERE DATE(fecha_gasto) BETWEEN ? AND ?
            GROUP BY DATE(fecha_gasto)
        `, [fecha_inicio, fecha_fin]);

        // Crear un mapa de gastos por fecha
        const gastosMap = {};
        gastosPorDia.forEach(g => {
            gastosMap[g.fecha.toISOString().split('T')[0]] = parseFloat(g.total_gastos);
        });

        // Combinar ingresos con gastos
        const resumenDiario = ingresosPorDia.map(dia => {
            const fechaStr = dia.fecha.toISOString().split('T')[0];
            return {
                fecha: fechaStr,
                total_ingresos: parseFloat(dia.total_ingresos) || 0,
                efectivo: parseFloat(dia.efectivo) || 0,
                transferencia: parseFloat(dia.transferencia) || 0,
                total_gastos: gastosMap[fechaStr] || 0
            };
        });

        res.json({ success: true, resumen: resumenDiario });

    } catch (error) {
        console.error('Error al obtener detalle de pagos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener detalle de pagos', details: error.message });
    }
};
// =============================================
// RENDER DASHBOARD CLIENTE
// =============================================
exports.renderDashboardCliente = (req, res) => {
    // Validar rol (aunque middleware auth ya valida token, aseguramos rol)
    if (req.usuario.rol !== 'cliente') {
        return res.status(403).send('Acceso denegado: Área exclusiva para clientes');
    }
    const path = require('path');
    res.sendFile(path.join(__dirname, '../views/dashboard-cliente.html'));
};
