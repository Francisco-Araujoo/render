/**
 * setup-ssm.js  —  Configura os parâmetros SSM do Render 7 na AWS
 * Uso: node setup-ssm.js
 * Execute UMA vez antes do primeiro deploy ou para corrigir parâmetros.
 */
'use strict';
const { SSMClient, PutParameterCommand } = require('@aws-sdk/client-ssm');
const readline = require('readline');

const REGION = 'us-east-1';
const client = new SSMClient({ region: REGION });

// ──────────────────────────────────────────────
// Parâmetros não-sensíveis — edite aqui se mudar
// ──────────────────────────────────────────────
const STATIC_PARAMS = [
    { Name: '/render7/DB_HOST', Value: 'render7.cclemg2mm332.us-east-1.rds.amazonaws.com', Type: 'String' },
    { Name: '/render7/DB_PORT', Value: '3306',    Type: 'String' },
    { Name: '/render7/DB_NAME', Value: 'render7', Type: 'String' },
    { Name: '/render7/DB_USER', Value: 'root',    Type: 'String' },
    { Name: '/render7/DB_SSL',  Value: 'false',   Type: 'String' },
];

function prompt(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function putParam(name, value, type = 'String') {
    await client.send(new PutParameterCommand({
        Name:      name,
        Value:     value,
        Type:      type,
        Overwrite: true,
    }));
    console.log(`  ✓  ${name}`);
}

(async () => {
    console.log('\n=== RENDER 7 — Setup SSM Parameters ===\n');

    // Parâmetros estáticos
    console.log('Gravando parâmetros de conexão...');
    for (const p of STATIC_PARAMS) {
        await putParam(p.Name, p.Value, p.Type);
    }

    // Senha do banco (SecureString)
    const dbPass = await prompt('\nDigite a senha do banco MySQL (DB_PASS): ');
    if (!dbPass) { console.error('Senha não informada. Abortando.'); process.exit(1); }
    await putParam('/render7/DB_PASS', dbPass, 'SecureString');

    // JWT Secret (SecureString)
    const jwtSecret = await prompt('Digite o JWT_SECRET (string aleatória longa): ');
    if (!jwtSecret) { console.error('JWT_SECRET não informado. Abortando.'); process.exit(1); }
    await putParam('/render7/JWT_SECRET', jwtSecret, 'SecureString');

    console.log('\n✓ Todos os parâmetros gravados com sucesso!');
    console.log('Agora acesse setup-admin.html para criar o admin Carlos.\n');
})().catch(err => {
    console.error('\nERRO:', err.message);
    process.exit(1);
});
