'use strict';
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

let cache = null;

async function getSecrets() {
    if (cache) return cache;

    // Em desenvolvimento (sem AWS_EXECUTION_ENV), usar variáveis de ambiente direto
    if (!process.env.AWS_EXECUTION_ENV) {
        console.log('[ssm] 🏠 Modo desenvolvimento (sem Lambda) — usando variáveis de ambiente diretas');
        cache = {
            DB_HOST: process.env.DB_HOST || 'localhost',
            DB_PORT: process.env.DB_PORT || '3306',
            DB_NAME: process.env.DB_NAME || 'render7_db',
            DB_USER: process.env.DB_USER || 'admin',
            DB_PASS: process.env.DB_PASS || '',
            DB_SSL: process.env.DB_SSL || 'false',
            JWT_SECRET: process.env.JWT_SECRET || 'seu-jwt-secret-aqui',
        };
        return cache;
    }

    const names = [
        '/render7/DB_HOST',
        '/render7/DB_PORT',
        '/render7/DB_NAME',
        '/render7/DB_USER',
        '/render7/DB_PASS',
        '/render7/DB_SSL',
        '/render7/JWT_SECRET',
    ];

    try {
        console.log('[ssm] 🔐 Tentando conectar ao AWS SSM Parameter Store...');
        const { Parameters } = await client.send(
            new GetParametersCommand({ Names: names, WithDecryption: true })
        );

        cache = {};
        for (const p of Parameters) {
            const key = p.Name.split('/').pop();
            cache[key] = p.Value;
        }

        console.log('[ssm] ✓ Parâmetros carregados do AWS SSM');
        return cache;
    } catch (err) {
        console.warn(`[ssm] ⚠️  Falha ao conectar SSM (${err.message})`);
        console.log('[ssm] ℹ️  Usando variáveis de ambiente como fallback...');
        
        // Fallback: usar variáveis de ambiente para desenvolvimento local
        cache = {
            DB_HOST: process.env.DB_HOST || 'localhost',
            DB_PORT: process.env.DB_PORT || '3306',
            DB_NAME: process.env.DB_NAME || 'render7_db',
            DB_USER: process.env.DB_USER || 'admin',
            DB_PASS: process.env.DB_PASS || '',
            DB_SSL: process.env.DB_SSL || 'false',
            JWT_SECRET: process.env.JWT_SECRET || 'seu-jwt-secret-aqui',
        };

        console.log('[ssm] ✓ Usando variáveis de ambiente (FALLBACK)');
        return cache;
    }
}

module.exports = { getSecrets };
