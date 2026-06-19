# 🚀 Guia Rápido de Início - Email + Nodemailer

## ✅ O que foi feito

Seu sistema de envio de email foi completamente configurado para usar **Kinghost + Nodemailer** integrado diretamente na Lambda AWS. Sem relay HTTP externo!

### Arquivos Criados/Modificados:

| Arquivo | O Quê |
|---------|-------|
| `src/helpers/email.js` | ✨ **NOVO** - Helper de email com nodemailer |
| `src/handlers/projects.js` | 🔄 **ATUALIZADO** - Agora envia emails para arquiteto E cliente |
| `package.json` | 📦 **ATUALIZADO** - Adicionado nodemailer ^6.9.13 |
| `.env.example` | ✨ **NOVO** - Template de ambiente |
| `.env.email.example` | ✨ **NOVO** - Configurações de email por provedor |
| `test-email.js` | 🧪 **NOVO** - Script para testar configuração |
| `SETUP_EMAIL_KINGHOST.md` | 📚 **NOVO** - Documentação completa |
| `MIGRACAO_EMAIL.md` | 📚 **NOVO** - Guia de migração |

---

## 🎯 Fluxo: Admin Cria Projeto → Emails Enviados

```
ADMIN cria projeto
        ↓
┌───────┴────────┐
│                │
▼                ▼
ARQUITETO      CLIENTE
Recebe email:  Recebe email:
"Novo projeto  "Seu projeto
atribuído"     está pronto!"
```

### Exemplo: Admin cria projeto para arquiteto João e cliente Maria

1. **API: POST /projects**
   ```json
   {
     "name": "Casa em São Paulo",
     "architect_id": 5,
     "client_id": 12,
     "category": "Residencial",
     "value": "150000"
   }
   ```

2. **Sistema automático:**
   - ✅ Projeto salvo no banco
   - 📧 Email para **João** (arquiteto): "Novo projeto Casa em São Paulo atribuído"
   - 📧 Email para **Maria** (cliente): "Seu projeto Casa em São Paulo está pronto!"

3. **Resposta da API:**
   ```json
   {
     "id": 123,
     "name": "Casa em São Paulo",
     "email_architect_sent": true,
     "email_client_sent": true,
     ...
   }
   ```

---

## 🔧 Como Começar (3 Passos)

### Passo 1: Configurar Ambiente Local

```bash
# 1. Copie o template
cp .env.example .env

# 2. Verifique que já está configurado:
cat .env
```

O arquivo `.env` já está com as credenciais do Kinghost:
```bash
EMAIL_PROVIDER=kinghost
EMAIL_USER=comercial@render7.com.br
EMAIL_PASS=Render123$
```

### Passo 2: Testar Conexão

```bash
# Execute o script de teste
node test-email.js
```

**Resposta esperada:**
```
1️⃣  Verificando Variáveis de Ambiente...
   EMAIL_PROVIDER: kinghost
   EMAIL_USER:     comercial@render7.com.br
   EMAIL_PASS:     [***oculta***]

2️⃣  Testando Conexão SMTP...
   ✅ Conexão bem-sucedida!
      Host: smtp.kinghost.net
      Port: 587

3️⃣  Enviando Email de Teste...
   ✅ Email enviado com sucesso!
```

### Passo 3: Deploy na AWS Lambda

```bash
# Configure variáveis de ambiente no serverless.yml:
# (veja arquivo abaixo)

serverless deploy
```

---

## 📋 Checklist de Deployment

- [ ] `.env` configurado localmente
- [ ] `test-email.js` passando com sucesso
- [ ] `npm install` executado (nodemailer instalado)
- [ ] Credenciais Kinghost verificadas
- [ ] `serverless.yml` atualizado com variáveis de ambiente
- [ ] Deploy executado: `serverless deploy`
- [ ] Testar criar projeto via API
- [ ] Verificar que emails chegaram

---

## 🔐 Segurança - AWS Deployment

### Opção A: Parâmetros SSM (Recomendado)

1. **Salvar senha no Parameter Store:**
```bash
aws ssm put-parameter \
  --name "/render7/email-password" \
  --value "Render123$" \
  --type "SecureString" \
  --region us-east-1
```

2. **Usar no serverless.yml:**
```yaml
provider:
  environment:
    EMAIL_PROVIDER: kinghost
    EMAIL_USER: comercial@render7.com.br
    EMAIL_PASS: ${ssm:/render7/email-password}
```

### Opção B: Variáveis Diretas (Menos Seguro)

```yaml
provider:
  environment:
    EMAIL_PROVIDER: kinghost
    EMAIL_USER: comercial@render7.com.br
    EMAIL_PASS: Render123$
```

---

## 📧 Customizar Emails

Os templates estão em `src/handlers/projects.js`:

- `emailTemplateProjectCreated()` — Email para arquiteto
- `emailTemplateProjectCreatedForClient()` — Email para cliente

**Para editar:**
1. Abra `src/handlers/projects.js`
2. Localize a função desejada
3. Modifique o HTML

---

## 🆘 Problemas Comuns

### Email não chega?

1. **Verificar logs:**
```bash
serverless logs -f create-project
```

2. **Testar localmente:**
```bash
node test-email.js
```

3. **Verificar:**
   - [ ] EMAIL_USER correto? (comercial@render7.com.br)
   - [ ] EMAIL_PASS correto? (Render123$)
   - [ ] Cliente/Arquiteto tem email cadastrado?
   - [ ] Firewall permite porta 587?

### Erro: "Invalid login"?
- Verifique EMAIL_PASS (sem espaços, caracteres especiais corretos)
- Teste direto no Kinghost webmail

### Arquivo de teste falha?
```bash
# Verificar se nodemailer está instalado:
npm list nodemailer

# Se não estiver:
npm install nodemailer
```

---

## 📚 Documentação Completa

- **[SETUP_EMAIL_KINGHOST.md](./SETUP_EMAIL_KINGHOST.md)** — Setup passo-a-passo completo
- **[MIGRACAO_EMAIL.md](./MIGRACAO_EMAIL.md)** — Guia técnico de migração
- **[src/helpers/email.js](./src/helpers/email.js)** — Código do helper
- **[test-email.js](./test-email.js)** — Script de teste

---

## ✨ Próximas Melhorias

- [ ] UI para visualizar histórico de emails enviados
- [ ] Sistema de retry automático
- [ ] Suporte a templates dinâmicos
- [ ] Webhooks de leitura/clique
- [ ] Agendamento de emails

---

## 🎉 Pronto!

Seu sistema de email está configurado e pronto para usar.

**Próximo passo:** Execute `node test-email.js` e verifique que tudo está funcionando! ✅
