'use strict';
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
// GET /projects
// Admin: todos os projetos
// Arquiteto: apenas os projetos onde architect_id = seu id
// Cliente: apenas os projetos onde client_id = seu id
// -------------------------------------------------------
module.exports.list = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event);
    if (err) return err;

    try {
        let sql, params;

        if (payload.role === 'admin') {
            sql = `
                SELECT p.id, p.name, p.description, p.category, p.location,
                       p.value, p.status, p.architect_id, p.client_id,
                       p.pdf_name, p.created_at,
                       CASE WHEN p.image_base64 IS NOT NULL THEN 1 ELSE 0 END AS has_image,
                       CASE WHEN p.pdf_base64   IS NOT NULL THEN 1 ELSE 0 END AS has_pdf,
                       a.name AS architect_name,
                       c.name AS client_name
                FROM projects p
                LEFT JOIN architects a ON a.id = p.architect_id
                LEFT JOIN clients    c ON c.id = p.client_id
                ORDER BY p.created_at DESC`;
            params = [];
        } else if (payload.role === 'arquiteto') {
            sql = `
                SELECT p.id, p.name, p.description, p.category, p.location,
                       p.value, p.status, p.architect_id, p.client_id,
                       p.pdf_name, p.created_at,
                       CASE WHEN p.image_base64 IS NOT NULL THEN 1 ELSE 0 END AS has_image,
                       CASE WHEN p.pdf_base64   IS NOT NULL THEN 1 ELSE 0 END AS has_pdf,
                       c.name AS client_name
                FROM projects p
                LEFT JOIN clients c ON c.id = p.client_id
                WHERE p.architect_id = ?
                ORDER BY p.created_at DESC`;
            params = [payload.id];
        } else {
            // cliente
            sql = `
                SELECT p.id, p.name, p.description, p.category, p.location,
                       p.value, p.status, p.architect_id, p.client_id,
                       p.pdf_name, p.created_at,
                       CASE WHEN p.image_base64 IS NOT NULL THEN 1 ELSE 0 END AS has_image,
                       CASE WHEN p.pdf_base64   IS NOT NULL THEN 1 ELSE 0 END AS has_pdf
                FROM projects p
                WHERE p.client_id = ?
                ORDER BY p.created_at DESC`;
            params = [payload.id];
        }

        const { rows } = await query(sql, params);
        return resp(200, rows);
    } catch (e) {
        console.error('projects.list:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// GET /projects/{id}
// Retorna dados completos incluindo base64 (para download/exibição)
// -------------------------------------------------------
module.exports.getOne = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event);
    if (err) return err;

    const projectId = parseInt(
        event.pathParameters && event.pathParameters.id,
        10
    );
    if (isNaN(projectId)) return resp(400, { error: 'ID inválido.' });

    try {
        const { rows } = await query(
            `SELECT p.*, a.name AS architect_name, c.name AS client_name
             FROM projects p
             LEFT JOIN architects a ON a.id = p.architect_id
             LEFT JOIN clients    c ON c.id = p.client_id
             WHERE p.id = ?`,
            [projectId]
        );

        if (!rows.length) return resp(404, { error: 'Projeto não encontrado.' });

        const project = rows[0];

        // Controle de acesso
        if (payload.role === 'arquiteto' && project.architect_id !== payload.id) {
            return resp(403, { error: 'Acesso negado.' });
        }
        if (payload.role === 'cliente' && project.client_id !== payload.id) {
            return resp(403, { error: 'Acesso negado.' });
        }

        return resp(200, project);
    } catch (e) {
        console.error('projects.getOne:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// POST /projects
// Cria um projeto com base64 de imagem e PDF.
// Admin: pode especificar architect_id e client_id.
// Arquiteto: architect_id é o próprio, client_id obrigatório.
// Body: { name, description, category, location, value, status,
//         architect_id?, client_id, image_base64?, pdf_base64?, pdf_name? }
// -------------------------------------------------------
module.exports.create = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    try {
        const body = JSON.parse(event.body || '{}');

        const name        = (body.name        || '').trim();
        const description = (body.description || '').trim();
        const category    = (body.category    || 'Residencial').trim();
        const location    = (body.location    || '').trim();
        const value       = (body.value       || '').trim();
        const status      = (body.status      || 'Em andamento').trim();
        const imageBase64 = body.image_base64 || null;
        const pdfBase64   = body.pdf_base64   || null;
        const pdfName     = (body.pdf_name    || null);

        if (!name) return resp(400, { error: 'Nome do projeto é obrigatório.' });
        if (!description) return resp(400, { error: 'Descrição é obrigatória.' });
        if (!value) return resp(400, { error: 'Valor da obra é obrigatório.' });

        // Determina architect_id e client_id
        let architectId, clientId;

        if (payload.role === 'admin') {
            architectId = parseInt(body.architect_id, 10);
            clientId    = parseInt(body.client_id, 10);
            if (isNaN(architectId)) return resp(400, { error: 'Selecione um arquiteto.' });
            if (isNaN(clientId))    return resp(400, { error: 'Selecione um cliente.' });
        } else {
            // arquiteto
            architectId = payload.id;
            clientId    = parseInt(body.client_id, 10);
            if (isNaN(clientId)) return resp(400, { error: 'Selecione um cliente.' });
        }

        // Verifica client pertence ao arquiteto
        const clientCheck = await query(
            `SELECT id FROM clients
             WHERE id = ? AND architect_id = ? AND active = 1`,
            [clientId, architectId]
        );
        if (!clientCheck.rows.length) {
            return resp(404, { error: 'Cliente não encontrado ou não pertence ao arquiteto.' });
        }

        const { insertId } = await query(
            `INSERT INTO projects
             (name, description, category, location, value, status,
              architect_id, client_id, image_base64, pdf_base64, pdf_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            [name, description, category, location, value, status,
             architectId, clientId, imageBase64, pdfBase64, pdfName]
        );
        const { rows } = await query(
            `SELECT p.id, p.name, p.category, p.location, p.value, p.status,
                    p.architect_id, p.client_id, p.pdf_name, p.created_at,
                    CASE WHEN p.image_base64 IS NOT NULL THEN 1 ELSE 0 END AS has_image,
                    CASE WHEN p.pdf_base64   IS NOT NULL THEN 1 ELSE 0 END AS has_pdf
             FROM projects p WHERE p.id = ?`,
            [insertId]
        );

        return resp(201, rows[0]);
    } catch (e) {
        console.error('projects.create:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// DELETE /projects/{id}
// Admin: qualquer projeto.
// Arquiteto: apenas os próprios.
// -------------------------------------------------------
module.exports.remove = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    const projectId = parseInt(
        event.pathParameters && event.pathParameters.id,
        10
    );
    if (isNaN(projectId)) return resp(400, { error: 'ID inválido.' });

    try {
        const check = await query(
            'SELECT architect_id FROM projects WHERE id = ?',
            [projectId]
        );
        if (!check.rows.length) return resp(404, { error: 'Projeto não encontrado.' });

        // Arquiteto só pode excluir os próprios projetos
        if (
            payload.role === 'arquiteto' &&
            check.rows[0].architect_id !== payload.id
        ) {
            return resp(403, { error: 'Acesso negado.' });
        }

        await query('DELETE FROM projects WHERE id = ?', [projectId]);
        return resp(200, { message: 'Projeto excluído com sucesso.' });
    } catch (e) {
        console.error('projects.remove:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};

// -------------------------------------------------------
// PUT /projects/{id}
// Admin: qualquer projeto. Arquiteto: apenas os próprios.
// Body (todos opcionais): name, description, category, location,
//   value, status, image_base64, pdf_base64, pdf_name
// -------------------------------------------------------
module.exports.update = async (event) => {
    const pre = preflight(event);
    if (pre) return pre;

    const { err, payload } = await auth(event, ['admin', 'arquiteto']);
    if (err) return err;

    const projectId = parseInt(
        event.pathParameters && event.pathParameters.id,
        10
    );
    if (isNaN(projectId)) return resp(400, { error: 'ID inválido.' });

    try {
        const check = await query(
            'SELECT architect_id FROM projects WHERE id = ?',
            [projectId]
        );
        if (!check.rows.length) return resp(404, { error: 'Projeto não encontrado.' });

        if (payload.role === 'arquiteto' && check.rows[0].architect_id !== payload.id) {
            return resp(403, { error: 'Acesso negado.' });
        }

        const body = JSON.parse(event.body || '{}');
        const fields = [];
        const vals   = [];

        const allowed = ['name','description','category','location','value','status','image_base64','pdf_base64','pdf_name'];
        allowed.forEach(key => {
            if (body[key] !== undefined) { fields.push(`${key} = ?`); vals.push(body[key]); }
        });

        if (!fields.length) return resp(400, { error: 'Nenhum campo para atualizar.' });

        vals.push(projectId);
        await query(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, vals);

        const { rows } = await query(
            `SELECT p.*, a.name AS architect_name, c.name AS client_name
             FROM projects p
             LEFT JOIN architects a ON a.id = p.architect_id
             LEFT JOIN clients    c ON c.id = p.client_id
             WHERE p.id = ?`,
            [projectId]
        );
        return resp(200, rows[0]);
    } catch (e) {
        console.error('projects.update:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};
