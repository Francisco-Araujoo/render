'use strict';
require('dotenv').config();

const nodemailer = require('nodemailer');

/**
 * Helper: envio de e-mail via nodemailer
 * Suporta múltiplos provedores SMTP (Gmail, Kinghost, SendGrid, etc.)
 * 
 * Variáveis de ambiente:
 *   EMAIL_PROVIDER  — 'gmail' | 'kinghost' | 'custom' (padrão: 'custom')
 *   EMAIL_HOST      — servidor SMTP (obrigatório para 'custom')
 *   EMAIL_PORT      — porta SMTP (padrão: 587)
 *   EMAIL_SECURE    — 'true' para SSL/465, 'false' para TLS/587
 *   EMAIL_USER      — usuário SMTP (obrigatório)
 *   EMAIL_PASS      — senha SMTP ou app password (obrigatório)
 *   EMAIL_FROM      — endereço 'from' (padrão: EMAIL_USER)
 */

const PROVIDER = process.env.EMAIL_PROVIDER || 'custom';
const EMAIL_HOST = process.env.EMAIL_HOST || '';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587', 10);
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASS = process.env.EMAIL_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

// ─── Configurações pré-definidas por provedor ───────────────────────────────
const SMTP_TIMEOUTS = {
    connectionTimeout: 8000,
    greetingTimeout:   5000,
    socketTimeout:     10000,
};

const PROVIDER_CONFIGS = {
    gmail: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS, // Use "App Password" se tiver 2FA
        },
        ...SMTP_TIMEOUTS,
    },
    kinghost: {
        host: 'smtp.kinghost.net',
        port: 587,
        secure: false,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
        ...SMTP_TIMEOUTS,
    },
    sendgrid: {
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
            user: 'apikey',
            pass: EMAIL_PASS, // Use a API key do SendGrid como password
        },
        ...SMTP_TIMEOUTS,
    },
    custom: {
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
        ...SMTP_TIMEOUTS,
    },
};

// ─── Validação de configuração ──────────────────────────────────────────────
function validateConfig() {
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error('[email] EMAIL_USER e EMAIL_PASS são obrigatórios.');
    }
    if (PROVIDER === 'custom' && !EMAIL_HOST) {
        throw new Error('[email] EMAIL_HOST é obrigatório para provedor "custom".');
    }
}

// ─── Criar transportador ────────────────────────────────────────────────────
function createTransporter() {
    try {
        validateConfig();
    } catch (e) {
        console.error(e.message);
        return null;
    }

    const config = PROVIDER_CONFIGS[PROVIDER];
    if (!config) {
        console.error(`[email] Provedor desconhecido: ${PROVIDER}`);
        return null;
    }

    console.log(`[email] Criando transportador → provedor: ${PROVIDER}, host: ${config.host}, port: ${config.port}`);
    
    const transporter = nodemailer.createTransport(config);
    return transporter;
}

// ─── Enviar via relay HTTP (quando rodando na Lambda/AWS) ──────────────────
async function sendViaRelay({ to, subject, html, text }) {
    const relayUrl   = (process.env.EMAIL_RELAY_URL   || '').replace(/\/$/, '') + '/send-email';
    const relayToken = process.env.EMAIL_RELAY_TOKEN || '';

    console.log(`[email] Usando relay HTTP → ${relayUrl}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
        const res = await fetch(relayUrl, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                ...(relayToken ? { 'Authorization': `Bearer ${relayToken}` } : {}),
            },
            body:   JSON.stringify({ to, subject, html, text }),
            signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Relay retornou HTTP ${res.status}: ${body}`);
        }

        const result = await res.json().catch(() => ({}));
        console.log(`[email] ✓ E-mail enviado via relay | messageId: ${result.messageId || 'n/a'}`);
        return { success: true, messageId: result.messageId };
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// ─── Enviar e-mail ─────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text, cc, bcc, replyTo }) {
    if (!to || !subject || (!html && !text)) {
        console.error('[email] Campos obrigatórios ausentes:', { to, subject, hasHtml: !!html, hasText: !!text });
        throw new Error('Campos obrigatórios: to, subject, html ou text.');
    }

    // Se EMAIL_RELAY_URL estiver configurado, usar relay (necessário na Lambda
    // pois a Kinghost bloqueia conexões SMTP vindas de IPs da AWS).
    if (process.env.EMAIL_RELAY_URL) {
        return sendViaRelay({ to, subject, html, text });
    }

    // Modo local/desenvolvimento: SMTP direto via nodemailer
    const transporter = createTransporter();
    if (!transporter) {
        throw new Error('Falha ao criar transportador de e-mail.');
    }

    const mailOptions = {
        from: `"Render 7" <${EMAIL_FROM}>`,
        to,
        subject,
        ...(html && { html }),
        ...(text && { text }),
        ...(cc && { cc }),
        ...(bcc && { bcc }),
        ...(replyTo && { replyTo }),
    };

    console.log(`[email] Enviando via SMTP direto → to: ${to} | subject: ${subject}`);

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`[email] ✓ E-mail enviado | messageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`[email] ✗ Falha ao enviar: ${err.message}`);
        throw err;
    }
}

// ─── Health check (verifica configuração) ──────────────────────────────────
async function healthCheck() {
    const transporter = createTransporter();
    if (!transporter) {
        return { status: 'error', message: 'Configuração de e-mail inválida.' };
    }

    try {
        await transporter.verify();
        console.log('[email] ✓ Conexão SMTP verificada com sucesso.');
        return {
            status: 'ok',
            provider: PROVIDER,
            host: PROVIDER_CONFIGS[PROVIDER]?.host || EMAIL_HOST,
            port: PROVIDER_CONFIGS[PROVIDER]?.port || EMAIL_PORT,
        };
    } catch (err) {
        console.error(`[email] ✗ Falha na verificação SMTP: ${err.message}`);
        return { status: 'error', message: err.message };
    }
}

module.exports = {
    sendEmail,
    healthCheck,
};
