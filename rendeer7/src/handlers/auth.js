'use strict';
const bcrypt = require('bcryptjs');
const { query } = require('../helpers/db');
const { sign, verify, extractToken } = require('../helpers/jwt');

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
    if (
        event.requestContext &&
        event.requestContext.http &&
        event.requestContext.http.method === 'OPTIONS'
    ) {
        return { statusCode: 204, headers: CORS_HEADERS, body: '' };
    }
    return null;
}

// -------------------------------------------------------
// POST /auth/login
// Body: { email, password }
// -------------------------------------------------------
module.exports.login = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    try {
        const body = JSON.parse(event.body || '{}');
        const email    = (body.email    || '').trim().toLowerCase();
        const password = (body.password || '');

        if (!email || !password) {
            return resp(400, { error: 'E-mail e senha são obrigatórios.' });
        }

        const { rows } = await query(
            `SELECT id, email, password_hash, name, 'admin'     AS role, NULL         AS architect_id FROM admins     WHERE email = ? AND active = 1
             UNION ALL
             SELECT id, email, password_hash, name, 'arquiteto' AS role, NULL         AS architect_id FROM architects WHERE email = ? AND active = 1
             UNION ALL
             SELECT id, email, password_hash, name, 'cliente'   AS role, architect_id AS architect_id FROM clients     WHERE email = ? AND active = 1
             LIMIT 1`,
            [email, email, email]
        );

        if (!rows.length) {
            return resp(401, { error: 'Credenciais inválidas.' });
        }

        const user  = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return resp(401, { error: 'Credenciais inválidas.' });
        }

        const token = await sign({
            id:           user.id,
            email:        user.email,
            name:         user.name,
            role:         user.role,
            architect_id: user.architect_id,
        });

        return resp(200, {
            token,
            user: {
                id:           user.id,
                email:        user.email,
                name:         user.name,
                role:         user.role,
                architect_id: user.architect_id,
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// POST /auth/setup-admin
// Cria o admin Carlos (render7obras@gmail.com) se não existir.
// Chamado UMA vez após o deploy.
// Body: { password }
// -------------------------------------------------------
module.exports.setupAdmin = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    try {
        const { rows } = await query(
            'SELECT id FROM admins LIMIT 1',
            []
        );

        if (rows.length > 0) {
            return resp(409, { error: 'Admin já cadastrado. Use o login normal.' });
        }

        const body = JSON.parse(event.body || '{}');
        const password = (body.password || '').trim();

        if (!password || password.length < 6) {
            return resp(400, { error: 'Senha inválida (mínimo 6 caracteres).' });
        }

        const hash = await bcrypt.hash(password, 12);

        await query(
            `INSERT INTO admins (email, password_hash, name)
             VALUES ('render7obras@gmail.com', ?, 'Carlos')`,
            [hash]
        );

        return resp(201, { message: 'Admin Carlos criado com sucesso. Faça login agora.' });
    } catch (err) {
        console.error('Setup admin error:', err);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// POST /auth/change-password
// Header: Authorization: Bearer <token>
// Body: { currentPassword, newPassword }
// -------------------------------------------------------
module.exports.changePassword = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    try {
        const token = extractToken(event);
        if (!token) return resp(401, { error: 'Não autorizado.' });

        let payload;
        try {
            payload = await verify(token);
        } catch {
            return resp(401, { error: 'Token inválido ou expirado.' });
        }

        const body = JSON.parse(event.body || '{}');
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword || newPassword.length < 6) {
            return resp(400, { error: 'Dados inválidos (nova senha: mínimo 6 caracteres).' });
        }

        let selectSql, updateSql;
        if (payload.role === 'admin') {
            selectSql = 'SELECT password_hash FROM admins     WHERE id = ? AND active = 1';
            updateSql = 'UPDATE admins     SET password_hash = ? WHERE id = ?';
        } else if (payload.role === 'arquiteto') {
            selectSql = 'SELECT password_hash FROM architects WHERE id = ? AND active = 1';
            updateSql = 'UPDATE architects SET password_hash = ? WHERE id = ?';
        } else {
            selectSql = 'SELECT password_hash FROM clients    WHERE id = ? AND active = 1';
            updateSql = 'UPDATE clients    SET password_hash = ? WHERE id = ?';
        }

        const { rows } = await query(selectSql, [payload.id]);

        if (!rows.length) return resp(404, { error: 'Usuário não encontrado.' });

        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) return resp(401, { error: 'Senha atual incorreta.' });

        const hash = await bcrypt.hash(newPassword, 12);
        await query(updateSql, [hash, payload.id]);

        return resp(200, { message: 'Senha alterada com sucesso.' });
    } catch (err) {
        console.error('Change password error:', err);
        return resp(500, { error: 'Erro interno.' });
    }
};
