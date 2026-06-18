'use strict';

/**
 * render7-email-relay
 * Serviço HTTP externo (hospedado no Render) que recebe POST da Lambda
 * e envia e-mails via SMTP Kinghost com nodemailer.
 *
 * Variáveis de ambiente:
 *   RELAY_PORT        — porta do servidor (padrão: 3001)
 *   EMAIL_RELAY_TOKEN — token Bearer obrigatório para autorizar requisições
 *   SMTP_USER         — usuário SMTP (padrão: comercial@render7.com.br)
 *   SMTP_PASS         — senha SMTP
 *   SMTP_HOST         — servidor SMTP (padrão: smtp.kinghost.net)
 */

const express    = require('express');
const nodemailer = require('nodemailer');

const app  = express();
const PORT = process.env.RELAY_PORT || process.env.PORT || 3001;

app.use(express.json({ limit: '1mb' }));

// ─── Config ────────────────────────────────────────────────────────────────────
const RELAY_TOKEN = process.env.EMAIL_RELAY_TOKEN || '';
const SMTP_USER   = process.env.SMTP_USER || 'comercial@render7.com.br';
const SMTP_PASS   = process.env.SMTP_PASS || '';
const SMTP_HOST   = process.env.SMTP_HOST || 'smtp.kinghost.net';

if (!RELAY_TOKEN) {
    console.warn('[relay] AVISO: EMAIL_RELAY_TOKEN não definido — sem proteção por token!');
}
if (!SMTP_PASS) {
    console.warn('[relay] AVISO: SMTP_PASS não definido — envio de e-mails vai falhar!');
}

// ─── Criar transportador SMTP ──────────────────────────────────────────────────
function createTransporter(port, secure) {
    console.log(`[relay] Criando transportador SMTP → ${SMTP_HOST}:${port} secure=${secure}`);
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false, // compatibilidade com cert. da Kinghost
        },
        connectionTimeout: 10000,
        greetingTimeout:   8000,
        socketTimeout:     15000,
    });
}

// ─── Middleware de autenticação ────────────────────────────────────────────────
function checkToken(req, res, next) {
    if (!RELAY_TOKEN) return next(); // sem token configurado → aberto (apenas dev)

    const authHeader = (req.headers['authorization'] || '').trim();
    const bodyToken  = (req.body && req.body.token) || '';
    const bearer     = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (bearer !== RELAY_TOKEN && bodyToken !== RELAY_TOKEN) {
        console.warn('[relay] Acesso negado — token inválido.');
        return res.status(401).json({ error: 'Token inválido.' });
    }
    next();
}

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    console.log('[relay] /health OK');
    res.json({ status: 'ok', service: 'render7-email-relay', ts: new Date().toISOString() });
});

// ─── POST /send-email ──────────────────────────────────────────────────────────
app.post('/send-email', checkToken, async (req, res) => {
    const { to, subject, html, text } = req.body || {};

    if (!to || !subject || (!html && !text)) {
        console.error('[relay] Campos obrigatórios ausentes:', { to, subject, hasHtml: !!html, hasText: !!text });
        return res.status(400).json({ error: 'Campos obrigatórios: to, subject, html ou text.' });
    }

    console.log(`[relay] ──────────────────────────────────────────`);
    console.log(`[relay] Novo envio → to: ${to} | assunto: ${subject}`);

    const mailOptions = {
        from:    `"Render 7 Comercial" <${SMTP_USER}>`,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
    };

    // ── Tentativa 1: porta 587 (STARTTLS) ──────────────────────────────────────
    try {
        console.log('[relay] Tentando porta 587 (STARTTLS)...');
        const t    = createTransporter(587, false);
        const info = await t.sendMail(mailOptions);
        console.log(`[relay] ✓ Enviado via 587 | messageId: ${info.messageId}`);
        return res.json({ sent: true, messageId: info.messageId, port: 587 });
    } catch (err) {
        console.error(`[relay] ✗ Falha porta 587: ${err.message} (code: ${err.code || 'n/a'})`);
    }

    // ── Tentativa 2: porta 465 (SSL) ───────────────────────────────────────────
    try {
        console.log('[relay] Tentando porta 465 (SSL)...');
        const t2    = createTransporter(465, true);
        const info2 = await t2.sendMail(mailOptions);
        console.log(`[relay] ✓ Enviado via 465 | messageId: ${info2.messageId}`);
        return res.json({ sent: true, messageId: info2.messageId, port: 465 });
    } catch (err2) {
        console.error(`[relay] ✗ Falha porta 465: ${err2.message} (code: ${err2.code || 'n/a'})`);
        console.error('[relay] Ambas as tentativas falharam. Verifique SMTP_PASS e conectividade.');
        return res.status(500).json({
            error:   'Falha ao enviar e-mail pelas portas 587 e 465.',
            details: err2.message,
        });
    }
});

// ─── Iniciar servidor ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[relay] ✓ render7-email-relay rodando na porta ${PORT}`);
    console.log(`[relay]   SMTP_HOST : ${SMTP_HOST}`);
    console.log(`[relay]   SMTP_USER : ${SMTP_USER}`);
    console.log(`[relay]   TOKEN ATIVO: ${RELAY_TOKEN ? 'sim' : 'não'}`);
});
