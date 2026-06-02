'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../helpers/db');
const { verify, extractToken } = require('../helpers/jwt');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function resp(status, body) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify(body),
    };
}

function preflight(event) {
    const method =
        event.requestContext &&
        event.requestContext.http &&
        event.requestContext.http.method;
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    return null;
}

// Valida token e verifica roles permitidos
async function auth(event, allowedRoles) {
    const token = extractToken(event);
    if (!token) return { err: resp(401, { error: 'Não autorizado.' }) };

    try {
        const payload = await verify(token);
        if (allowedRoles && !allowedRoles.includes(payload.role)) {
            return { err: resp(403, { error: 'Acesso negado.' }) };
        }
        return { payload };
    } catch {
        return { err: resp(401, { error: 'Token inválido ou expirado.' }) };
    }
}

// -------------------------------------------------------
// GET /users/arquitetos
// Retorna todos os arquitetos. (admin only)
// -------------------------------------------------------
module.exports.listArquitetos = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err } = await auth(event, ['admin']);
    if (err) return err;

    try {
        const { rows } = await query(
            `SELECT id, email, name, created_at
             FROM architects
             WHERE active = 1
             ORDER BY name`,
            []
        );
        return resp(200, rows);
    } catch (e) {
        console.error('listArquitetos:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// POST /users/arquitetos
// Cria um arquiteto. (admin only)
// Body: { name, email, password }
// -------------------------------------------------------
module.exports.createArquiteto = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err } = await auth(event, ['admin']);
    if (err) return err;

    try {
        const body = JSON.parse(event.body || '{}');
        const name     = (body.name     || '').trim();
        const email    = (body.email    || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        if (!name || !email || !password) {
            return resp(400, { error: 'Nome, e-mail e senha são obrigatórios.' });
        }
        if (password.length < 6) {
            return resp(400, { error: 'Senha deve ter no mínimo 6 caracteres.' });
        }

        // Verifica duplicado em todas as tabelas
        const dup = await query(
            `SELECT email FROM admins     WHERE email = ?
             UNION ALL
             SELECT email FROM architects WHERE email = ?
             UNION ALL
             SELECT email FROM clients    WHERE email = ?
             LIMIT 1`,
            [email, email, email]
        );
        if (dup.rows.length) {
            return resp(409, { error: 'E-mail já cadastrado.' });
        }

        const hash = await bcrypt.hash(password, 12);
        const { insertId } = await query(
            `INSERT INTO architects (email, password_hash, name)
             VALUES (?, ?, ?)`,
            [email, hash, name]
        );
        const { rows } = await query(
            'SELECT id, email, name, created_at FROM architects WHERE id = ?',
            [insertId]
        );

        return resp(201, { ...rows[0], role: 'arquiteto' });
    } catch (e) {
        console.error('createArquiteto:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// GET /users/arquitetos/{id}/clientes
// Lista clientes de um arquiteto.
// Admin: acessa qualquer arquiteto.
// Arquiteto: só os próprios.
// -------------------------------------------------------
module.exports.listClientesByArquiteto = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    const arquitetoId = parseInt(
        event.pathParameters && event.pathParameters.id,
        10
    );
    if (isNaN(arquitetoId)) return resp(400, { error: 'ID inválido.' });

    // Arquiteto só pode ver os próprios clientes
    if (payload.role === 'arquiteto' && payload.id !== arquitetoId) {
        return resp(403, { error: 'Acesso negado.' });
    }

    try {
        const { rows } = await query(
            `SELECT id, email, name, architect_id, created_at
             FROM clients
             WHERE architect_id = ? AND active = 1
             ORDER BY name`,
            [arquitetoId]
        );
        return resp(200, rows.map(r => ({ ...r, role: 'cliente' })));
    } catch (e) {
        console.error('listClientesByArquiteto:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// GET /users/clientes
// Admin: todos os clientes. Arquiteto: só os seus.
// -------------------------------------------------------
module.exports.listClientes = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    try {
        let rows;
        if (payload.role === 'admin') {
            ({ rows } = await query(
                `SELECT c.id, c.email, c.name, c.architect_id, c.created_at,
                        a.name AS architect_name
                 FROM clients c
                 LEFT JOIN architects a ON a.id = c.architect_id
                 WHERE c.active = 1
                 ORDER BY c.name`,
                []
            ));
        } else {
            ({ rows } = await query(
                `SELECT id, email, name, architect_id, created_at
                 FROM clients
                 WHERE architect_id = ? AND active = 1
                 ORDER BY name`,
                [payload.id]
            ));
        }
        return resp(200, rows.map(r => ({ ...r, role: 'cliente' })));
    } catch (e) {
        console.error('listClientes:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// POST /users/clientes
// Cria um cliente.
// Admin: pode vincular a qualquer arquiteto (architect_id obrigatório).
// Arquiteto: cliente fica vinculado a ele automaticamente.
// Body: { name, email, password, architect_id? }
// -------------------------------------------------------
module.exports.createCliente = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    try {
        const body = JSON.parse(event.body || '{}');
        const name     = (body.name     || '').trim();
        const email    = (body.email    || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        if (!name || !email || !password) {
            return resp(400, { error: 'Nome, e-mail e senha são obrigatórios.' });
        }
        if (password.length < 6) {
            return resp(400, { error: 'Senha deve ter no mínimo 6 caracteres.' });
        }

        // Determina architect_id
        let architectId;
        if (payload.role === 'admin') {
            architectId = parseInt(body.architect_id, 10);
            if (isNaN(architectId)) {
                return resp(400, { error: 'Selecione um arquiteto para o cliente.' });
            }
            // Verifica se arquiteto existe
            const check = await query(
                'SELECT id FROM architects WHERE id = ? AND active = 1',
                [architectId]
            );
            if (!check.rows.length) {
                return resp(404, { error: 'Arquiteto não encontrado.' });
            }
        } else {
            architectId = payload.id;
        }

        // Verifica duplicado em todas as tabelas
        const dup = await query(
            `SELECT email FROM admins     WHERE email = ?
             UNION ALL
             SELECT email FROM architects WHERE email = ?
             UNION ALL
             SELECT email FROM clients    WHERE email = ?
             LIMIT 1`,
            [email, email, email]
        );
        if (dup.rows.length) {
            return resp(409, { error: 'E-mail já cadastrado.' });
        }

        const hash = await bcrypt.hash(password, 12);
        const { insertId } = await query(
            `INSERT INTO clients (email, password_hash, name, architect_id)
             VALUES (?, ?, ?, ?)`,
            [email, hash, name, architectId]
        );
        const { rows } = await query(
            'SELECT id, email, name, architect_id, created_at FROM clients WHERE id = ?',
            [insertId]
        );

        return resp(201, { ...rows[0], role: 'cliente' });
    } catch (e) {
        console.error('createCliente:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// DELETE /users/arquitetos/{id}
// Desativa um arquiteto. Admin only.
// -------------------------------------------------------
module.exports.deleteArquiteto = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err } = await auth(event, ['admin']);
    if (err) return err;

    const userId = parseInt(
        event.pathParameters && event.pathParameters.id,
        10
    );
    if (isNaN(userId)) return resp(400, { error: 'ID inválido.' });

    try {
        const check = await query(
            'SELECT id FROM architects WHERE id = ?',
            [userId]
        );
        if (!check.rows.length) return resp(404, { error: 'Arquiteto não encontrado.' });

        await query('UPDATE architects SET active = 0 WHERE id = ?', [userId]);
        return resp(200, { message: 'Arquiteto desativado com sucesso.' });
    } catch (e) {
        console.error('deleteArquiteto:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// DELETE /users/clientes/{id}
// Desativa um cliente. Admin ou arquiteto dono.
// -------------------------------------------------------
module.exports.deleteCliente = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    const userId = parseInt(
        event.pathParameters && event.pathParameters.id,
        10
    );
    if (isNaN(userId)) return resp(400, { error: 'ID inválido.' });

    try {
        const check = await query(
            'SELECT id, architect_id FROM clients WHERE id = ?',
            [userId]
        );
        if (!check.rows.length) return resp(404, { error: 'Cliente não encontrado.' });

        // Arquiteto só pode desativar os próprios clientes
        if (payload.role === 'arquiteto' && check.rows[0].architect_id !== payload.id) {
            return resp(403, { error: 'Acesso negado.' });
        }

        await query('UPDATE clients SET active = 0 WHERE id = ?', [userId]);
        return resp(200, { message: 'Cliente desativado com sucesso.' });
    } catch (e) {
        console.error('deleteCliente:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// GET /users/me
// Retorna dados do usuário logado.
// -------------------------------------------------------
module.exports.getMe = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event);
    if (err) return err;

    try {
        let sql;
        if (payload.role === 'admin') {
            sql = `SELECT id, email, name, 'admin' AS role, NULL AS architect_id, created_at
                   FROM admins WHERE id = ? AND active = 1`;
        } else if (payload.role === 'arquiteto') {
            sql = `SELECT id, email, name, 'arquiteto' AS role, NULL AS architect_id, created_at
                   FROM architects WHERE id = ? AND active = 1`;
        } else {
            sql = `SELECT id, email, name, 'cliente' AS role, architect_id, created_at
                   FROM clients WHERE id = ? AND active = 1`;
        }

        const { rows } = await query(sql, [payload.id]);
        if (!rows.length) return resp(404, { error: 'Usuário não encontrado.' });
        return resp(200, rows[0]);
    } catch (e) {
        console.error('getMe:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// PUT /users/me
// Atualiza e-mail e/ou senha do usuário logado.
// Body: { current_password, email?, new_password? }
// Pelo menos um de email ou new_password deve ser enviado.
// -------------------------------------------------------
module.exports.updateMe = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event);
    if (err) return err;

    try {
        const body            = JSON.parse(event.body || '{}');
        const currentPassword = (body.current_password || '').trim();
        const newEmail        = body.email        ? body.email.trim().toLowerCase()       : null;
        const newPassword     = body.new_password  ? body.new_password.trim()              : null;

        if (!currentPassword) {
            return resp(400, { error: 'Senha atual obrigatória para confirmar a alteração.' });
        }
        if (!newEmail && !newPassword) {
            return resp(400, { error: 'Informe o novo e-mail ou a nova senha.' });
        }
        if (newPassword && newPassword.length < 6) {
            return resp(400, { error: 'A nova senha deve ter no mínimo 6 caracteres.' });
        }
        if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return resp(400, { error: 'Formato de e-mail inválido.' });
        }

        // Determina tabela
        const table = payload.role === 'admin'
            ? 'admins'
            : payload.role === 'arquiteto'
                ? 'architects'
                : 'clients';

        // Busca hash atual
        const { rows: userRows } = await query(
            `SELECT password_hash FROM ${table} WHERE id = ? AND active = 1`,
            [payload.id]
        );
        if (!userRows.length) return resp(404, { error: 'Usuário não encontrado.' });

        const valid = await bcrypt.compare(currentPassword, userRows[0].password_hash);
        if (!valid) return resp(401, { error: 'Senha atual incorreta.' });

        // Verifica duplicata de e-mail (se trocando)
        if (newEmail) {
            const dup = await query(
                `SELECT email FROM admins     WHERE email = ? AND id != ?
                 UNION ALL
                 SELECT email FROM architects WHERE email = ?
                 UNION ALL
                 SELECT email FROM clients    WHERE email = ?
                 LIMIT 1`,
                [newEmail, payload.role === 'admin' ? payload.id : -1, newEmail, newEmail]
            );
            if (dup.rows.length) return resp(409, { error: 'E-mail já cadastrado.' });

            await query(`UPDATE ${table} SET email = ? WHERE id = ?`, [newEmail, payload.id]);
        }

        if (newPassword) {
            const hash = await bcrypt.hash(newPassword, 12);
            await query(`UPDATE ${table} SET password_hash = ? WHERE id = ?`, [hash, payload.id]);
        }

        return resp(200, { message: 'Dados atualizados com sucesso.' });
    } catch (e) {
        console.error('updateMe:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};
