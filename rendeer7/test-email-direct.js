#!/usr/bin/env node
'use strict';

/**
 * test-email-direct.js
 * Teste de envio de email SEM precisar conectar ao banco de dados
 * 
 * Uso:
 *   node test-email-direct.js
 */

require('dotenv').config();

const { sendEmail } = require('./src/helpers/email');

async function testDirectEmail() {
    console.log('\n' + '═'.repeat(70));
    console.log('📧 Teste de Envio de Email - Direto');
    console.log('═'.repeat(70) + '\n');

    // Emails de teste
    const architectEmail = 'franciscoaraujodev@gmail.com';
    const clientEmail = 'franciscoaraujodev@gmail.com';

    console.log('💡 INSTRUÇÕES:');
    console.log('   1. Edite este script e altere os emails:');
    console.log(`      • architectEmail = 'franciscoaraujodev@gmail.com'`);
    console.log(`      • clientEmail = 'franciscoaraujodev@gmail.com'`);
    console.log('   2. Execute novamente: node test-email-direct.js\n');

    console.log('Emails de teste:');
    console.log(`   Arquiteto: ${architectEmail}`);
    console.log(`   Cliente:   ${clientEmail}\n`);

    try {
        // ────────────────────────────────────────────────────────────────
        // 1. Email para Arquiteto
        // ────────────────────────────────────────────────────────────────
        console.log('1️⃣  Enviando email para Arquiteto...\n');

        const htmlArchitect = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAFAFA;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1A1C1A;padding:32px 40px;text-align:center">
    <h1 style="color:#C7BFB4;margin:0;font-size:20px;letter-spacing:3px;text-transform:uppercase">RENDER 7</h1>
    <p style="color:#818781;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase">Portal de Projetos</p>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1A1C1A;font-size:18px;margin:0 0 6px;font-weight:700">Novo Projeto Atribuído</h2>
    <p style="color:#383B38;font-size:14px;margin:0 0 28px;line-height:1.6">
      Olá, <strong>Arquiteto Teste</strong>. Um novo projeto foi criado e atribuído a você pela equipe Render 7.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781;width:150px">Projeto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A;font-weight:700">Casa Residencial - Teste</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Cliente</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">Cliente Teste</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Categoria</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">Residencial</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Status</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">Em andamento</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Valor da Obra</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">R$ 150.000,00</td></tr>
      <tr><td style="padding:10px 0;color:#818781">Localização</td>
          <td style="padding:10px 0;color:#1A1C1A">São Paulo, SP</td></tr>
    </table>
    <p style="color:#818781;font-size:12px;margin:0;line-height:1.6">
      Acesse o portal para visualizar os detalhes completos, materiais e documentação do projeto.
    </p>
  </div>
  <div style="background:#F4F2EF;padding:16px 40px;text-align:center">
    <p style="color:#818781;font-size:11px;margin:0">Render 7 © 2025 — Este é um e-mail automático, por favor não responda.</p>
  </div>
</div>
        `.trim();

        await sendEmail({
            to: architectEmail,
            subject: 'Novo projeto atribuído — Casa Residencial - Teste',
            html: htmlArchitect,
        });

        console.log(`   ✅ Email enviado para arquiteto: ${architectEmail}\n`);

        // ────────────────────────────────────────────────────────────────
        // 2. Email para Cliente
        // ────────────────────────────────────────────────────────────────
        console.log('2️⃣  Enviando email para Cliente...\n');

        const htmlClient = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAFAFA;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
  <div style="background:#1A1C1A;padding:32px 40px;text-align:center">
    <h1 style="color:#C7BFB4;margin:0;font-size:20px;letter-spacing:3px;text-transform:uppercase">RENDER 7</h1>
    <p style="color:#818781;margin:6px 0 0;font-size:11px;letter-spacing:1px;text-transform:uppercase">Portal de Projetos</p>
  </div>
  <div style="padding:40px">
    <h2 style="color:#1A1C1A;font-size:18px;margin:0 0 6px;font-weight:700">Seu Projeto Está Pronto!</h2>
    <p style="color:#383B38;font-size:14px;margin:0 0 28px;line-height:1.6">
      Olá, <strong>Cliente Teste</strong>! Temos o prazer de informar que seu projeto foi registrado e está disponível no portal Render 7. Seu arquiteto <strong>Arquiteto Teste</strong> já foi notificado e iniciará o trabalho.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px">
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781;width:150px">Projeto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A;font-weight:700">Casa Residencial - Teste</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Arquiteto</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">Arquiteto Teste</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Categoria</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">Residencial</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Status</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">Em andamento</td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#818781">Valor da Obra</td>
          <td style="padding:10px 0;border-bottom:1px solid #EBEBEB;color:#1A1C1A">R$ 150.000,00</td></tr>
      <tr><td style="padding:10px 0;color:#818781">Localização</td>
          <td style="padding:10px 0;color:#1A1C1A">São Paulo, SP</td></tr>
    </table>
    <p style="color:#818781;font-size:12px;margin:0;line-height:1.6">
      Você pode acompanhar o progresso do projeto acessando seu portal com as credenciais fornecidas.
    </p>
  </div>
  <div style="background:#F4F2EF;padding:16px 40px;text-align:center">
    <p style="color:#818781;font-size:11px;margin:0">Render 7 © 2025 — Este é um e-mail automático, por favor não responda.</p>
  </div>
</div>
        `.trim();

        await sendEmail({
            to: clientEmail,
            subject: 'Seu projeto Casa Residencial - Teste está pronto!',
            html: htmlClient,
        });

        console.log(`   ✅ Email enviado para cliente: ${clientEmail}\n`);

        // ────────────────────────────────────────────────────────────────
        // Sucesso
        // ────────────────────────────────────────────────────────────────
        console.log('═'.repeat(70));
        console.log('✨ Ambos os emails foram enviados com sucesso!');
        console.log('═'.repeat(70) + '\n');

    } catch (err) {
        console.error('❌ Erro:', err.message, '\n');
    }
}

testDirectEmail();
