'use strict';
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');

// Token fixo de segurança — só aceita requisições com este token
const SETUP_TOKEN = 'render7-setup-2026';

const REGION = process.env.AWS_REGION || 'us-east-1';
const client  = new SSMClient({ region: REGION });

const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

function resp(status, body) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify(body),
    };
}

async function put(name, value, secure = false) {
    await client.send(new PutParameterCommand({
        Name:      `/render7/${name}`,
        Value:     value,
        Type:      secure ? 'SecureString' : 'String',
        Overwrite: true,
    }));
}

// -------------------------------------------------------
// POST /setup/ssm
// Body: { token, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DB_SSL, JWT_SECRET }
// Chamado UMA vez para configurar os parâmetros SSM.
// -------------------------------------------------------
module.exports.setupSSM = async (event) => {
    // Preflight CORS
    const method = event.requestContext?.http?.method;
    if (method === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };

    try {
        const body = JSON.parse(event.body || '{}');

        // Verifica token de segurança
        if (body.token !== SETUP_TOKEN) {
            return resp(403, { error: 'Token inválido.' });
        }

        const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DB_SSL, JWT_SECRET } = body;

        if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASS || !JWT_SECRET) {
            return resp(400, { error: 'Preencha todos os campos obrigatórios.' });
        }

        await put('DB_HOST', DB_HOST);
        await put('DB_PORT', DB_PORT || '3306');
        await put('DB_NAME', DB_NAME);
        await put('DB_USER', DB_USER);
        await put('DB_SSL',  DB_SSL || 'false');
        await put('DB_PASS',    DB_PASS);
        await put('JWT_SECRET', JWT_SECRET);

        return resp(200, { message: 'Parâmetros SSM configurados com sucesso!' });
    } catch (err) {
        console.error('setupSSM error:', err);
        return resp(500, { error: 'Erro ao gravar parâmetros: ' + err.message });
    }
};
