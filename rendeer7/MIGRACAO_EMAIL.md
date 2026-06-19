# 📧 Migração: Email Relay → Nodemailer Integrado

## 📋 Resumo das Mudanças

### Antes (com Relay HTTP)
```
Lambda (AWS) 
  ↓ POST HTTP
Relay externo (Render)
  ↓ SMTP
Kinghost SMTP
  ↓
E-mail enviado
```

**Problemas:**
- Requer manutenção de um serviço externo (Render)
- Dependência de 3 serviços (AWS + Render + Kinghost)
- Latência adicional de requisição HTTP
- Custo adicional do serviço no Render

### Agora (Nodemailer Integrado)
```
Lambda (AWS)
  ↓ Nodemailer
Provedor SMTP (Gmail, Kinghost, SendGrid, etc.)
  ↓
E-mail enviado
```

**Benefícios:**
- ✅ Sem dependência de relay HTTP externo
- ✅ Mais rápido (requisição HTTP eliminada)
- ✅ Suporta múltiplos provedores
- ✅ Sem custo adicional do Render
- ✅ Mais simples de manter

---

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
cd rendeer7
npm install
```

O `nodemailer` foi adicionado ao `package.json`.

### 2. Escolher Provedor SMTP

Escolha um dos provedores suportados:

#### **Option A: Gmail (Recomendado - Grátis)**

1. Ative 2FA em https://myaccount.google.com/security
2. Gere uma "App Password" em https://myaccount.google.com/apppasswords
   - Selecione: App = Mail, Device = Windows/Linux/etc
   - Google gera uma senha com 16 caracteres

3. Configure as variáveis de ambiente:
   ```bash
   EMAIL_PROVIDER=gmail
   EMAIL_USER=seu-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   EMAIL_FROM="Render 7 Comercial <seu-email@gmail.com>"
   ```

#### **Option B: Kinghost (Atual)**

```bash
EMAIL_PROVIDER=kinghost
EMAIL_USER=comercial@render7.com.br
EMAIL_PASS=sua-senha-kinghost
EMAIL_FROM="Render 7 Comercial <comercial@render7.com.br>"
```

#### **Option C: SendGrid (Profissional)**

1. Crie conta em https://sendgrid.com
2. Gere uma API key
3. Configure:
   ```bash
   EMAIL_PROVIDER=sendgrid
   EMAIL_USER=apikey
   EMAIL_PASS=SG.xxxxxxxxxxxxx
   EMAIL_FROM="Render 7 <seu-email@sendgrid.com>"
   ```

#### **Option D: Outro SMTP (Custom)**

```bash
EMAIL_PROVIDER=custom
EMAIL_HOST=smtp.seu-servidor.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=usuario@seu-servidor.com
EMAIL_PASS=sua-senha
EMAIL_FROM="Render 7 <usuario@seu-servidor.com>"
```

### 3. Configurar Variáveis de Ambiente

**Em .env (local):**
```bash
EMAIL_PROVIDER=gmail
EMAIL_USER=seu-email@gmail.com
EMAIL_PASS=sua-app-password
EMAIL_FROM="Render 7 <seu-email@gmail.com>"
```

**Na AWS Lambda (via serverless.yml ou console):**
```yaml
environment:
  EMAIL_PROVIDER: gmail
  EMAIL_USER: seu-email@gmail.com
  EMAIL_PASS: ${ssm:EMAIL_PASS_SECRET}
  EMAIL_FROM: "Render 7 <seu-email@gmail.com>"
```

Ou salvar no SSM Parameter Store e usar:
```yaml
EMAIL_PASS: ${ssm:/render7/email-pass}
```

### 4. Testar Conexão

Para testar a configuração, execute um script:

```javascript
const { healthCheck } = require('./src/helpers/email');

(async () => {
  const result = await healthCheck();
  console.log(result);
})();
```

**Resposta esperada (sucesso):**
```json
{
  "status": "ok",
  "provider": "gmail",
  "host": "smtp.gmail.com",
  "port": 587
}
```

**Erro comum:**
```
"Falha na verificação SMTP: Invalid login: 535-5.7.8 Username and password not accepted"
```
→ Verifique EMAIL_USER e EMAIL_PASS (use App Password para Gmail)

---

## 📝 Mudanças no Código

### `src/helpers/email.js` (novo)
Novo helper que encapsula a lógica de nodemailer com suporte a múltiplos provedores.

**Uso:**
```javascript
const { sendEmail, healthCheck } = require('./src/helpers/email');

// Enviar e-mail
await sendEmail({
  to: 'arquiteto@example.com',
  subject: 'Novo Projeto',
  html: '<h1>Olá</h1>',
});

// Verificar saúde da conexão
const health = await healthCheck();
```

### `src/handlers/projects.js` (atualizado)
Removida a função `sendViaRelay()` (que chamava HTTP relay externo) e substituída por `sendEmailNotification()` que usa nodemailer direto.

**Antes:**
```javascript
async function sendViaRelay(to, subject, html) {
  // ... HTTP request ao relay externo ...
}

emailSent = await sendViaRelay(architect_email, subject, html);
```

**Agora:**
```javascript
const { sendEmail } = require('../helpers/email');

async function sendEmailNotification(to, subject, html) {
  try {
    await sendEmail({ to, subject, html });
    return true;
  } catch (err) {
    console.error(`[email] Falha: ${err.message}`);
    return false;
  }
}

emailSent = await sendEmailNotification(architect_email, subject, html);
```

### `package.json` (atualizado)
Adicionada dependência:
```json
{
  "dependencies": {
    "nodemailer": "^6.9.13"
  }
}
```

---

## 🔒 Segurança

### Melhores Práticas

1. **Nunca commit `.env` com EMAIL_PASS**
   - Use `.env.example` como template
   - Sempre use variáveis de ambiente

2. **Para AWS Lambda:**
   - Salve EMAIL_PASS no **AWS Systems Manager (SSM) Parameter Store**
   - Use `${ssm:/path/to/secret}` no serverless.yml
   - Ou use **AWS Secrets Manager**

3. **Para Gmail:**
   - Use **App Passwords** (não a senha da conta)
   - Ative 2FA
   - Revogue app passwords periodicamente

4. **Para SendGrid/outros:**
   - Use **API keys** em vez de senhas
   - Rotacione chaves periodicamente
   - Monitore uso

---

## 🛠️ Troubleshooting

### "EMAIL_USER e EMAIL_PASS são obrigatórios"
✗ Variáveis de ambiente não configuradas
✓ Defina em `.env` ou em environment variables da Lambda

### "Conexão rejeitada na porta 587/465"
✗ EMAIL_HOST incorreto ou EMAIL_PORT errado
✓ Verifique com o provedor SMTP

### "Invalid login: 535-5.7.8 Username and password not accepted"
✗ EMAIL_USER ou EMAIL_PASS incorretos
✓ Para Gmail: use App Password, não senha da conta
✓ Para Kinghost: verifique credenciais

### "Timeout ao enviar"
✗ Servidor SMTP indisponível ou firewall bloqueando
✓ Verifique conectividade
✓ Teste com `nc -zv smtp.host.com 587`

---

## 📊 Comparação de Provedores

| Provedor | Custo | Setup | Limite/mês | Melhor Para |
|----------|-------|-------|-----------|-----------|
| **Gmail** | Grátis | 2-3 min | 500 e-mails | Prototipagem |
| **Kinghost** | ~R$100/ano | 1 min | Ilimitado | Produção customizada |
| **SendGrid** | Grátis até 100/dia | 5 min | 100+ | Escala profissional |
| **Custom** | Varia | 10+ min | Varia | Servidor próprio |

---

## 🔄 Migração Gradual

Se quiser manter o relay por enquanto enquanto migra:

1. Mantenha o `email-relay.js` no Render
2. Configure `sendEmailNotification()` para tentar nodemailer primeiro
3. Fallback para relay externo em caso de falha
4. Monitore logs por 1-2 semanas
5. Remova relay quando confiante

---

## ❓ Dúvidas Frequentes

**P: Posso usar múltiplos provedores?**
A: Não direto, mas pode criar múltiplos helpers e escolher por função.

**P: E se o provedor SMTP cair?**
A: A requisição falhará e retornará `email_sent: false`. Implemente retry logic se necessário.

**P: Quanto custa?**
A: Normalmente grátis ou incluído no servidor SMTP. Gmail é grátis com limitações.

**P: Posso usar webhooks para confirmar entrega?**
A: SendGrid oferece webhooks. Gmail/Kinghost precisam de solução third-party.

---

## 📚 Referências

- **Nodemailer Docs:** https://nodemailer.com/
- **Gmail App Passwords:** https://myaccount.google.com/apppasswords
- **SendGrid:** https://sendgrid.com/
- **Kinghost:** https://kinghost.com.br/
