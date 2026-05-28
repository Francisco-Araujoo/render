'use strict';
const jwt = require('jsonwebtoken');
const { getSecrets } = require('./ssm');

async function sign(payload) {
    const s = await getSecrets();
    return jwt.sign(payload, s.JWT_SECRET, { expiresIn: '24h' });
}

async function verify(token) {
    const s = await getSecrets();
    return jwt.verify(token, s.JWT_SECRET);
}

function extractToken(event) {
    const auth =
        (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    return null;
}

module.exports = { sign, verify, extractToken };
