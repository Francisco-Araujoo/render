#!/usr/bin/env node
'use strict';

/**
 * test-email.js
 * Script rápido para testar a configuração de email com Kinghost
 * 
 * Uso:
 *   node test-email.js
 * 
 * Requer variáveis de ambiente:
 *   EMAIL_PROVIDER, EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE
 */

// Carregar variáveis de .env
require('dotenv').config();

const { healthCheck, sendEmail } = require('./src/helpers/email');

async function runTests() {
    console.log('\n' + '═'.repeat(70));
    console.log('🧪 Teste de Configuração de Email');
    console.log('═'.repeat(70) + '\n');

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Verificar variáveis de ambiente
    // ──────────────────────────────────────────────────────────────────────────
    console.log('1️⃣  Verificando Variáveis de Ambiente...\n');

    const env = {
        EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'custom',
        EMAIL_USER: process.env.EMAIL_USER || '',
        EMAIL_PASS: process.env.EMAIL_PASS || '',
        EMAIL_HOST: process.env.EMAIL_HOST || '',
        EMAIL_PORT: process.env.EMAIL_PORT || '587',
        EMAIL_FROM: process.env.EMAIL_FROM || '',
    };

    console.log('  EMAIL_PROVIDER:', env.EMAIL_PROVIDER);
    console.log('  EMAIL_USER:    ', env.EMAIL_USER);
    console.log('  EMAIL_PASS:    ', env.EMAIL_PASS ? '[***oculta***]' : '❌ NÃO CONFIGURADA');
    console.log('  EMAIL_HOST:    ', env.EMAIL_HOST || '(padrão por provedor)');
    console.log('  EMAIL_PORT:    ', env.EMAIL_PORT);
    console.log('  EMAIL_FROM:    ', env.EMAIL_FROM);

    if (!env.EMAIL_USER || !env.EMAIL_PASS) {
        console.log('\n❌ Erro: EMAIL_USER ou EMAIL_PASS não configurados!');
        console.log('   Crie um arquivo .env com:');
        console.log('     EMAIL_PROVIDER=kinghost');
        console.log('     EMAIL_USER=comercial@render7.com.br');
        console.log('     EMAIL_PASS=Render123$');
        process.exit(1);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Testar conexão SMTP
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n2️⃣  Testando Conexão SMTP...\n');

    const health = await healthCheck();
    
    if (health.status === 'ok') {
        console.log('  ✅ Conexão bem-sucedida!');
        console.log('     Host:', health.host);
        console.log('     Port:', health.port);
    } else {
        console.log('  ❌ Falha na conexão:', health.message);
        process.exit(1);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Testar envio de email de teste
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n3️⃣  Enviando Email de Teste...\n');

    const testEmail = {
        to: env.EMAIL_USER, // Envia para si mesmo para não poluir inbox de outro
        subject: '[TESTE] Configuração de Email - Render 7',
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0f0f0;padding:20px;border-radius:8px;">
  <h2 style="color:#1A1C1A;margin-top:0;">✅ Email de Teste - Render 7</h2>
  
  <p style="color:#383B38;line-height:1.6;">
    Parabéns! Seu sistema de email foi configurado com sucesso.
  </p>
  
  <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;color:#666;">Provedor</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;color:#000;font-weight:bold;">${env.EMAIL_PROVIDER}</td>
    </tr>
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;color:#666;">Email de Envio</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;color:#000;font-weight:bold;">${env.EMAIL_USER}</td>
    </tr>
    <tr>
      <td style="padding:8px;color:#666;">Data/Hora</td>
      <td style="padding:8px;color:#000;font-weight:bold;">${new Date().toLocaleString('pt-BR')}</td>
    </tr>
  </table>
  
  <p style="color:#818781;font-size:12px;">
    Este é um email de teste. Se você o recebeu, a configuração está funcionando corretamente.
  </p>
  
  <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
  <p style="color:#999;font-size:11px;margin:0;">
    Render 7 © 2025
  </p>
</div>
        `.trim(),
    };

    try {
        await sendEmail(testEmail);
        console.log('  ✅ Email enviado com sucesso!');
        console.log('     Para: ' + testEmail.to);
        console.log('     Assunto: ' + testEmail.subject);
    } catch (err) {
        console.log('  ❌ Falha ao enviar email:', err.message);
        process.exit(1);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Resumo
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(70));
    console.log('✨ Todos os testes passaram!');
    console.log('═'.repeat(70));
    console.log('\nSeu sistema de email está pronto para uso.');
    console.log('Quando um admin criar um projeto, emails serão enviados para:');
    console.log('  • Arquiteto (novo projeto atribuído)');
    console.log('  • Cliente (seu projeto está pronto)');
    console.log('\n');
}

// Executar testes
runTests().catch((err) => {
    console.error('\n❌ Erro inesperado:', err);
    process.exit(1);
});
