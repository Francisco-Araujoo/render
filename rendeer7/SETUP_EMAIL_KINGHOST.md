# 📧 Setup Email - Kinghost + Nodemailer

## 🎯 O que foi configurado

Quando um **admin** cria um novo projeto:

1. ✅ **Arquiteto recebe email** notificando que um novo projeto foi atribuído
2. ✅ **Cliente recebe email** notificando que seu projeto está pronto

---

## 🔧 Passo 1: Configurar Variáveis de Ambiente

### Opção A: Em `.env` (Desenvolvimento Local)

Crie ou edite um arquivo `.env` na raiz do projeto `rendeer7/`:

```bash
EMAIL_PROVIDER=kinghost
EMAIL_USER=comercial@render7.com.br
EMAIL_PASS=Render123$
EMAIL_FROM="Render 7 Comercial <comercial@render7.com.br>"
EMAIL_HOST=smtp.kinghost.net
EMAIL_PORT=587
EMAIL_SECURE=false
```

### Opção B: Na AWS Lambda (Produção)

Configure as variáveis de ambiente no `serverless.yml`:

```yaml
provider:
  name: aws
  runtime: nodejs18.x
  environment:
    EMAIL_PROVIDER: kinghost
    EMAIL_USER: comercial@render7.com.br
    EMAIL_PASS: ${ssm:/render7/email-password}
    EMAIL_FROM: "Render 7 Comercial <comercial@render7.com.br>"
    EMAIL_HOST: smtp.kinghost.net
    EMAIL_PORT: 587
    EMAIL_SECURE: 'false'
```

**Salvar senha no AWS Parameter Store:**

```bash
aws ssm put-parameter \
  --name "/render7/email-password" \
  --value "Render123$" \
  --type "SecureString" \
  --region us-east-1
```

---

## ✅ Passo 2: Verificar Configuração

### Teste Local (Node.js)

Crie um arquivo de teste `test-email.js`:

```javascript
const { healthCheck } = require('./src/helpers/email');

(async () => {
  const result = await healthCheck();
  console.log('Status de email:', result);
})();
```

Execute:
```bash
node test-email.js
```

**Resposta esperada (sucesso):**
```json
{
  "status": "ok",
  "provider": "kinghost",
  "host": "smtp.kinghost.net",
  "port": 587
}
```

**Erro comum:**
```
"Falha na verificação SMTP: Invalid login: 535-5.7.8 Username and password not accepted"
```

→ Verifique se `EMAIL_USER` e `EMAIL_PASS` estão corretos

---

## 🚀 Passo 3: Testar Envio de Email

### Teste Manual via API

1. **Obter token de admin:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@render7.com.br",
    "password": "sua-senha-admin"
  }'
```

2. **Criar um projeto (vai enviar emails):**
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "name": "Projeto Teste",
    "description": "Casa residencial - Teste de email",
    "category": "Residencial",
    "location": "Rua das Flores, 123 - São Paulo, SP",
    "value": "150000",
    "status": "Em andamento",
    "architect_id": 1,
    "client_id": 1
  }'
```

**Resposta esperada:**
```json
{
  "id": 123,
  "name": "Projeto Teste",
  "email_architect_sent": true,
  "email_client_sent": true,
  ...
}
```

---

## 📧 Fluxo de Email

### Quando Admin Cria Projeto

```
┌─────────────┐
│    ADMIN    │ (faz POST /projects)
└──────┬──────┘
       │
       ├─────────────────────────────────┬──────────────────────────────────┐
       │                                 │                                  │
       ▼                                 ▼                                  ▼
   ┌──────────────┐               ┌──────────────┐                ┌──────────────┐
   │  Banco Dados │               │  ARQUITETO   │                │   CLIENTE    │
   │   Salvar     │               │  Email: ✓    │                │  Email: ✓    │
   │   Projeto    │               │              │                │              │
   └──────────────┘               └──────────────┘                └──────────────┘
       (p.id)                   "Novo Projeto Atribuído"    "Seu Projeto está Pronto"
```

### Email para Arquiteto

**Assunto:** `Novo projeto atribuído — Nome do Projeto`

**Conteúdo:**
- Nome do projeto
- Nome do cliente
- Categoria
- Status
- Valor da obra
- Localização
- Link para acessar portal

### Email para Cliente

**Assunto:** `Seu projeto Nome do Projeto está pronto!`

**Conteúdo:**
- Confirmação que o projeto foi registrado
- Nome do arquiteto atribuído
- Detalhes do projeto (categoria, status, valor, localização)
- Link para acessar portal

---

## 🐛 Troubleshooting

### Erro 1: "EMAIL_USER e EMAIL_PASS são obrigatórios"
```
✗ Variáveis de ambiente não configuradas
✓ Verifique:
  - .env existe e tem EMAIL_USER e EMAIL_PASS?
  - Variáveis de ambiente da Lambda estão definidas?
  - Reiniciou o serviço após configurar?
```

### Erro 2: "Conexão rejeitada"
```
✗ Servidor SMTP indisponível ou porta bloqueada
✓ Teste conectividade:
  telnet smtp.kinghost.net 587
  
✓ Verifique firewall/segurança
```

### Erro 3: "Invalid login: 535-5.7.8"
```
✗ Email ou senha incorretos
✓ Verifique:
  EMAIL_USER=comercial@render7.com.br
  EMAIL_PASS=Render123$ (sem espaços, caracteres especiais corretos)
```

### Erro 4: "Email enviado mas não chegou"
```
✗ Email pode estar em SPAM/Lixo
✓ Ações:
  - Verifique pasta SPAM do destinatário
  - Configure SPF/DKIM no Kinghost
  - Verifique domínio de envio
```

### Erro 5: Aplicação local funciona, mas Lambda não envia
```
✗ Variáveis de ambiente não definidas na Lambda
✓ Verifique:
  - serverless.yml tem environment?
  - Deploy foi feito com "serverless deploy"?
  - Parâmetros SSM existem?
```

---

## 🔒 Segurança

### ⚠️ Nunca faça isso:

❌ NÃO commit `.env` com senha real
```bash
# Ruim:
git add .env  # Expõe EMAIL_PASS
```

✅ Boas práticas:
```bash
# Bom:
echo ".env" >> .gitignore
cp .env.example .env  # Use exemplo como template
```

### Para AWS Lambda:

✅ Use **AWS Systems Manager Parameter Store** ou **Secrets Manager**

```bash
# Guardar no Parameter Store (criptografado)
aws ssm put-parameter \
  --name "/render7/email-password" \
  --value "Render123$" \
  --type "SecureString"

# Acessar no serverless.yml
EMAIL_PASS: ${ssm:/render7/email-password}
```

---

## 📝 Documentos Relacionados

- [MIGRACAO_EMAIL.md](./MIGRACAO_EMAIL.md) — Guia completo de migração
- [src/helpers/email.js](./src/helpers/email.js) — Código do helper
- [src/handlers/projects.js](./src/handlers/projects.js) — Handlers de projetos com email

---

## ❓ Dúvidas Frequentes

**P: Quantos emails por mês Kinghost permite?**
A: Normalmente ilimitado. Verifique seu plano Kinghost.

**P: Como reenviar email se falhar?**
A: Implemente fila de retry (ex: SQS, Bull, etc). Por enquanto, apenas log de erro.

**P: Posso usar múltiplos emails de envio?**
A: Sim, altere EMAIL_USER conforme necessário (ex: suporte@, vendas@, etc).

**P: Email testado local mas falha em produção?**
A: Verifique se variáveis de ambiente estão definidas na Lambda.

---

## ✨ Próximas Melhorias

- [ ] Sistema de retry para emails que falharem
- [ ] Log de envio de emails (audit trail)
- [ ] Webhook de leitura (se provedor suportar)
- [ ] Template customizável via banco de dados
- [ ] Suporte a CC/BCC (adminisradores)
- [ ] Agendamento de envio
