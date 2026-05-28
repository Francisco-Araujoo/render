'use strict';
const mysql = require('mysql2/promise');
const { getSecrets } = require('./ssm');

let pool = null;

async function getPool() {
    if (pool) return pool;

    const s = await getSecrets();

    pool = mysql.createPool({
        host:               s.DB_HOST,
        port:               parseInt(s.DB_PORT, 10) || 3306,
        database:           s.DB_NAME,
        user:               s.DB_USER,
        password:           s.DB_PASS,
        ssl:                s.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        connectionLimit:    2,
        connectTimeout:     5000,
        waitForConnections: true,
        queueLimit:         0,
    });

    return pool;
}

// Retorna { rows, insertId, affectedRows } para interface uniforme
async function query(sql, params) {
    const p = await getPool();
    const [result] = await p.execute(sql, params || []);
    if (Array.isArray(result)) {
        return { rows: result };
    }
    // INSERT / UPDATE / DELETE
    return {
        rows:         [],
        insertId:     result.insertId,
        affectedRows: result.affectedRows,
    };
}

module.exports = { query };
