'use strict';
const { query }  = require('../helpers/db');
const { verify, extractToken } = require('../helpers/jwt');
const { sendEmail } = require('../helpers/email');

// ─── Helper: enviar e-mail via nodemailer (direto, sem relay HTTP) ─
/**
 * Envia e-mail usando nodemailer configurado via variáveis de ambiente.
 * Retorna true se enviado com sucesso, false em caso de falha (nunca lança exceção).
 *
 * Variáveis necessárias no ambiente:
 *   EMAIL_PROVIDER — 'gmail' | 'kinghost' | 'sendgrid' | 'custom' (padrão: 'custom')
 *   EMAIL_USER     — usuário SMTP (obrigatório)
 *   EMAIL_PASS     — senha SMTP (obrigatório)
 *   EMAIL_HOST     — servidor SMTP (obrigatório para 'custom')
 *   EMAIL_PORT     — porta SMTP (padrão: 587)
 *   EMAIL_FROM     — endereço from (padrão: EMAIL_USER)
 */
async function sendEmailNotification(to, subject, html, text) {
    try {
        await sendEmail({ to, subject, html, text });
        return true;
    } catch (err) {
        console.error(`[email] Falha ao enviar: ${err.message}`);
        return false;
    }
}

// ─── Template HTML de e-mail ───────────────────────────────────────────────────
function emailTemplateProjectCreated({ architectName, projectName, category, status, value, location, clientName }) {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAFAFA;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1A1C1A;padding:32px 40px;text-align:center">
    <h1 style="color:#C7BFB4;margin:0;font-size:20px;letter-spacing:3px;text-transform:uppercase">RENDER 7</h1>
    <p style="color:#818781;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase">Portal de Projetos</p>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1A1C1A;font-size:18px;margin:0 0 6px;font-weight:700">Novo Projeto Atribuído</h2>
    <p style="color:#383B38;font-size:14px;margin:0 0 28px;line-height:1.6">
      Olá, <strong>${architectName}</strong>. Um novo projeto foi criado e atribuído a você pela equipe Render 7.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781;width:150px">Projeto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A;font-weight:700">${projectName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Cliente</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${clientName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Categoria</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${category}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Status</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${status}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Valor da Obra</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">R$ ${value}</td></tr>
      <tr><td style="padding:10px 0;color:#818781">Localização</td>
          <td style="padding:10px 0;color:#1A1C1A">${location || 'Não informado'}</td></tr>
    </table>
    <p style="color:#818781;font-size:12px;margin:0;line-height:1.6">
      Acesse o portal para visualizar os detalhes completos, materiais e documentação do projeto.
    </p>
  </div>
  <div style="background:#F4F2EF;padding:16px 40px;text-align:center">
    <p style="color:#818781;font-size:11px;margin:0">Render 7 © 2025 — Este é um e-mail automático, por favor não responda.</p>
  </div>
</div>`.trim();
}

// ─── Template: Notificação para CLIENTE (novo projeto disponível) ───────────
function emailTemplateProjectCreatedForClient({ clientName, architectName, projectName, category, status, value, location }) {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAFAFA;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1A1C1A;padding:32px 40px;text-align:center">
    <h1 style="color:#C7BFB4;margin:0;font-size:20px;letter-spacing:3px;text-transform:uppercase">RENDER 7</h1>
    <p style="color:#818781;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase">Portal de Projetos</p>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1A1C1A;font-size:18px;margin:0 0 6px;font-weight:700">Seu Projeto Está Pronto!</h2>
    <p style="color:#383B38;font-size:14px;margin:0 0 28px;line-height:1.6">
      Olá, <strong>${clientName}</strong>! Temos o prazer de informar que seu projeto foi registrado e está disponível no portal Render 7. Seu arquiteto <strong>${architectName}</strong> já foi notificado e iniciará o trabalho.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781;width:150px">Projeto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A;font-weight:700">${projectName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Arquiteto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${architectName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Categoria</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${category}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Status</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${status}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Valor da Obra</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">R$ ${value}</td></tr>
      <tr><td style="padding:10px 0;color:#818781">Localização</td>
          <td style="padding:10px 0;color:#1A1C1A">${location || 'Não informado'}</td></tr>
    </table>
    <p style="color:#818781;font-size:12px;margin:0;line-height:1.6">
      Você pode acompanhar o progresso do projeto acessando seu portal com as credenciais fornecidas.
    </p>
  </div>
  <div style="background:#F4F2EF;padding:16px 40px;text-align:center">
    <p style="color:#818781;font-size:11px;margin:0">Render 7 © 2025 — Este é um e-mail automático, por favor não responda.</p>
  </div>
</div>`.trim();
}

function emailTemplateProjectUpdated({ architectName, projectName, category, status, value, location, clientName }) {
    return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAFAFA;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1A1C1A;padding:32px 40px;text-align:center">
    <h1 style="color:#C7BFB4;margin:0;font-size:20px;letter-spacing:3px;text-transform:uppercase">RENDER 7</h1>
    <p style="color:#818781;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase">Portal de Projetos</p>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1A1C1A;font-size:18px;margin:0 0 6px;font-weight:700">Projeto Atualizado</h2>
    <p style="color:#383B38;font-size:14px;margin:0 0 28px;line-height:1.6">
      Olá, <strong>${architectName}</strong>. O projeto abaixo foi atualizado pela equipe administrativa da Render 7.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781;width:150px">Projeto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A;font-weight:700">${projectName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Cliente</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${clientName}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Categoria</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${category}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Status atual</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">${status}</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Valor da Obra</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">R$ ${value}</td></tr>
      <tr><td style="padding:10px 0;color:#818781">Localização</td>
          <td style="padding:10px 0;color:#1A1C1A">${location || 'Não informado'}</td></tr>
    </table>
    <p style="color:#818781;font-size:12px;margin:0;line-height:1.6">
      Acesse o portal para visualizar as alterações e a documentação atualizada.
    </p>
  </div>
  <div style="background:#F4F2EF;padding:16px 40px;text-align:center">
    <p style="color:#818781;font-size:11px;margin:0">Render 7 © 2025 — Este é um e-mail automático, por favor não responda.</p>
  </div>
</div>`.trim();
}

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
                       a.email AS architect_email,
                       c.name AS client_name,
                       c.email AS client_email
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
                       a.name AS architect_name,
                       a.email AS architect_email,
                       c.name AS client_name,
                       c.email AS client_email
                FROM projects p
                LEFT JOIN architects a ON a.id = p.architect_id
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
                       CASE WHEN p.pdf_base64   IS NOT NULL THEN 1 ELSE 0 END AS has_pdf,
                       a.name AS architect_name,
                       a.email AS architect_email,
                       c.name AS client_name,
                       c.email AS client_email
                FROM projects p
                LEFT JOIN architects a ON a.id = p.architect_id
                LEFT JOIN clients    c ON c.id = p.client_id
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
            `SELECT p.*, a.name AS architect_name, a.email AS architect_email,
                    c.name AS client_name, c.email AS client_email
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
                    CASE WHEN p.pdf_base64   IS NOT NULL THEN 1 ELSE 0 END AS has_pdf,
                    a.name  AS architect_name,
                    a.email AS architect_email,
                    c.name  AS client_name,
                    c.email AS client_email
             FROM projects p
             LEFT JOIN architects a ON a.id = p.architect_id
             LEFT JOIN clients    c ON c.id = p.client_id
             WHERE p.id = ?`,
            [insertId]
        );

        const project = rows[0];
        console.log(`[projects.create] Projeto #${project.id} "${project.name}" criado com sucesso.`);

        // ── Notificar ARQUITETO por e-mail ─────────────────────────────────────
        let architectEmailSent = false;
        if (project.architect_email) {
            console.log(`[projects.create] Enviando notificação ao arquiteto: ${project.architect_email}`);
            const html = emailTemplateProjectCreated({
                architectName: project.architect_name || 'Arquiteto',
                projectName:   project.name,
                category:      project.category,
                status:        project.status,
                value:         project.value,
                location:      project.location,
                clientName:    project.client_name || 'Cliente',
            });
            const textArch = `Novo projeto atribuído — ${project.name}\n\nOlá, ${project.architect_name || 'Arquiteto'}.\nUm novo projeto foi criado e atribuído a você.\n\nProjeto: ${project.name}\nCliente: ${project.client_name || 'Cliente'}\nCategoria: ${project.category}\nStatus: ${project.status}\nValor: R$ ${project.value}\nLocalização: ${project.location || 'Não informado'}\n\nRender 7 — Portal de Projetos`;
            architectEmailSent = await sendEmailNotification(
                project.architect_email,
                `Novo projeto atribuído — ${project.name}`,
                html,
                textArch
            );
            console.log(`[projects.create] E-mail arquiteto: ${architectEmailSent ? '✓' : '✗'}`);
        } else {
            console.warn('[projects.create] Arquiteto sem e-mail — notificação não enviada.');
        }

        // ── Notificar CLIENTE por e-mail ────────────────────────────────────────
        let clientEmailSent = false;
        if (project.client_email) {
            console.log(`[projects.create] Enviando notificação ao cliente: ${project.client_email}`);
            const htmlClient = emailTemplateProjectCreatedForClient({
                clientName:    project.client_name || 'Cliente',
                architectName: project.architect_name || 'Arquiteto',
                projectName:   project.name,
                category:      project.category,
                status:        project.status,
                value:         project.value,
                location:      project.location,
            });
            const textClient = `Seu projeto ${project.name} está pronto!\n\nOlá, ${project.client_name || 'Cliente'}.\nSeu projeto foi registrado no portal Render 7.\n\nProjeto: ${project.name}\nArquiteto: ${project.architect_name || 'Arquiteto'}\nCategoria: ${project.category}\nStatus: ${project.status}\nValor: R$ ${project.value}\nLocalização: ${project.location || 'Não informado'}\n\nRender 7 — Portal de Projetos`;
            clientEmailSent = await sendEmailNotification(
                project.client_email,
                `Seu projeto ${project.name} está pronto!`,
                htmlClient,
                textClient
            );
            console.log(`[projects.create] E-mail cliente: ${clientEmailSent ? '✓' : '✗'}`);
        } else {
            console.warn('[projects.create] Cliente sem e-mail — notificação não enviada.');
        }

        // Não expor e-mail do arquiteto na resposta
        const { architect_email, ...projectPublic } = project;
        return resp(201, {
            ...projectPublic,
            email_architect_sent: architectEmailSent,
            email_client_sent:    clientEmailSent,
        });
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
        console.log(`[projects.update] Projeto #${projectId} atualizado. Campos: ${fields.join(', ')}`);

        const { rows } = await query(
            `SELECT p.*, a.name AS architect_name, a.email AS architect_email,
                    c.name AS client_name, c.email AS client_email
             FROM projects p
             LEFT JOIN architects a ON a.id = p.architect_id
             LEFT JOIN clients    c ON c.id = p.client_id
             WHERE p.id = ?`,
            [projectId]
        );

        const project = rows[0];

        // ── Notificar ARQUITETO por e-mail ────────────────────────────────────
        let architectEmailSent = false;
        if (project.architect_email) {
            console.log(`[projects.update] Enviando e-mail de notificação para o arquiteto: ${project.architect_email}`);
            const html = emailTemplateProjectUpdated({
                architectName: project.architect_name || 'Arquiteto',
                projectName:   project.name,
                category:      project.category,
                status:        project.status,
                value:         project.value,
                location:      project.location,
                clientName:    project.client_name || 'Cliente',
            });
            const textArchUpd = `Projeto atualizado — ${project.name}\n\nOlá, ${project.architect_name || 'Arquiteto'}.\nO projeto abaixo foi atualizado.\n\nProjeto: ${project.name}\nCliente: ${project.client_name || 'Cliente'}\nCategoria: ${project.category}\nStatus: ${project.status}\nValor: R$ ${project.value}\nLocalização: ${project.location || 'Não informado'}\n\nRender 7 — Portal de Projetos`;
            architectEmailSent = await sendEmailNotification(
                project.architect_email,
                `Projeto atualizado — ${project.name}`,
                html,
                textArchUpd
            );
            console.log(`[projects.update] E-mail arquiteto: ${architectEmailSent ? '✓' : '✗'}`);
        } else {
            console.warn('[projects.update] Arquiteto sem e-mail — notificação não enviada.');
        }

        // ── Notificar CLIENTE por e-mail ────────────────────────────────────
        let clientEmailSent = false;
        if (project.client_email) {
            console.log(`[projects.update] Enviando e-mail de notificação para o cliente: ${project.client_email}`);
            const htmlClient = emailTemplateProjectCreatedForClient({
                clientName:    project.client_name || 'Cliente',
                architectName: project.architect_name || 'Arquiteto',
                projectName:   project.name,
                category:      project.category,
                status:        project.status,
                value:         project.value,
                location:      project.location,
            });
            const textClientUpd = `Projeto atualizado — ${project.name}\n\nOlá, ${project.client_name || 'Cliente'}.\nSeu projeto foi atualizado no portal Render 7.\n\nProjeto: ${project.name}\nArquiteto: ${project.architect_name || 'Arquiteto'}\nCategoria: ${project.category}\nStatus: ${project.status}\nValor: R$ ${project.value}\nLocalização: ${project.location || 'Não informado'}\n\nRender 7 — Portal de Projetos`;
            clientEmailSent = await sendEmailNotification(
                project.client_email,
                `Projeto atualizado — ${project.name}`,
                htmlClient,
                textClientUpd
            );
            console.log(`[projects.update] E-mail cliente: ${clientEmailSent ? '✓' : '✗'}`);
        } else {
            console.warn('[projects.update] Cliente sem e-mail — notificação não enviada.');
        }

        // Não expor e-mails na resposta
        const { architect_email, client_email, ...projectPublic } = project;
        return resp(200, {
            ...projectPublic,
            email_architect_sent: architectEmailSent,
            email_client_sent:    clientEmailSent,
        });
    } catch (e) {
        console.error('projects.update:', e);
        return resp(500, { error: 'Erro interno.' });
    }
};
