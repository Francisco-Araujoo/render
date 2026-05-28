'use strict';
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const client = new SSMClient({ region: process.env.AWS_REGION || 'us-east-1' });

let cache = null;

async function getSecrets() {
    if (cache) return cache;

    const names = [
        '/render7/DB_HOST',
        '/render7/DB_PORT',
        '/render7/DB_NAME',
        '/render7/DB_USER',
        '/render7/DB_PASS',
        '/render7/DB_SSL',
        '/render7/JWT_SECRET',
    ];

    const { Parameters } = await client.send(
        new GetParametersCommand({ Names: names, WithDecryption: true })
    );

    cache = {};
    for (const p of Parameters) {
        const key = p.Name.split('/').pop();
        cache[key] = p.Value;
    }

    return cache;
}

module.exports = { getSecrets };
