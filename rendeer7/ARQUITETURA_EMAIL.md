# 📊 Arquitetura do Sistema de Email

## Visão Geral

```
┌──────────────────────────────────────────────────────────────────────┐
│                        RENDER 7 - EMAIL SYSTEM                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ANTES (com Relay HTTP):                                            │
│  ────────────────────────                                           │
│  Lambda → HTTP POST → Render (relay) → SMTP Kinghost → Email       │
│                                                                      │
│  ❌ Problemas:                                                      │
│     • 3 pontos de falha (Lambda, Render, SMTP)                     │
│     • Latência de HTTP request                                      │
│     • Custo do Render                                               │
│     • Complexidade de manutenção                                    │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AGORA (com Nodemailer Integrado):                                  │
│  ─────────────────────────────────                                  │
│  Lambda (nodemailer) → SMTP Kinghost → Email                        │
│                                                                      │
│  ✅ Benefícios:                                                     │
│     • 2 pontos apenas (Lambda, SMTP)                                │
│     • Mais rápido (sem HTTP intermediário)                          │
│     • Sem custo Render                                              │
│     • Suporta múltiplos provedores (Gmail, SendGrid, etc)           │
│     • Melhor manutenibilidade                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Fluxo Detalhado: Admin Cria Projeto

```
                              Admin Portal
                                  │
                                  │ POST /projects
                                  ▼
                    ┌─────────────────────────────┐
                    │   AWS Lambda (Node.js)      │
                    │ ┌───────────────────────┐   │
                    │ │ src/handlers/projects │   │
                    │ │  module.create()      │   │
                    │ └─────────┬─────────────┘   │
                    │           │                 │
                    │ ┌─────────▼─────────────┐   │
                    │ │ Banco de Dados MySQL  │   │
                    │ │ - INSERT projeto      │   │
                    │ │ - GET arquiteto email │   │
                    │ │ - GET cliente email   │   │
                    │ └─────────┬─────────────┘   │
                    │           │                 │
                    │   ┌───────┴────────┐        │
                    │   │                │        │
                    │   ▼                ▼        │
                    │ ┌──────────────┐  ┌──────────────┐
                    │ │   Email #1   │  │   Email #2   │
                    │ │  Arquiteto   │  │   Cliente    │
                    │ └──────┬───────┘  └──────┬───────┘
                    │        │                 │
                    └────────┼─────────────────┼────────
                             │                 │
                 ┌───────────▼─┐         ┌────▼────────┐
                 │   Helper    │         │   Helper    │
                 │   email.js  │         │   email.js  │
                 │ sendEmail() │         │ sendEmail() │
                 └───────────┬─┘         └────┬────────┘
                             │                 │
                 ┌───────────▼─────────────────▼─────────┐
                 │     Nodemailer (Node.js)              │
                 │ - Cria transportador SMTP             │
                 │ - Conecta ao servidor SMTP            │
                 │ - Autentica (usuário/senha)           │
                 │ - Envia email                         │
                 └───────────┬─────────────────────────┐─┘
                             │                         │
         ┌───────────────────▼─────┐  ┌────────────────▼──────┐
         │   SMTP Kinghost         │  │  SMTP Kinghost        │
         │   (smtp.kinghost.net)   │  │  (smtp.kinghost.net)  │
         │   Port 587 (STARTTLS)   │  │  Port 587 (STARTTLS)  │
         └───────────────────┬─────┘  └────────────────┬──────┘
                             │                         │
         ┌───────────────────▼─────┐  ┌────────────────▼──────┐
         │   Arquiteto Email       │  │   Cliente Email       │
         │   joao@example.com      │  │   maria@example.com   │
         │                         │  │                       │
         │   Assunto:              │  │   Assunto:            │
         │   "Novo projeto         │  │   "Seu projeto        │
         │    atribuído"           │  │    está pronto!"      │
         │                         │  │                       │
         │   Conteúdo:             │  │   Conteúdo:           │
         │   - Nome projeto        │  │   - Nome projeto      │
         │   - Cliente             │  │   - Arquiteto         │
         │   - Categoria           │  │   - Categoria         │
         │   - Status              │  │   - Status            │
         │   - Valor               │  │   - Valor             │
         │   - Localização         │  │   - Localização       │
         └─────────────────────────┘  └───────────────────────┘
```

## Componentes e Responsabilidades

### 1. **src/helpers/email.js**
```
Função: Abstração de envio de email
├─ sendEmail()
│  └─ Envia email via nodemailer
│     ├─ Valida campos obrigatórios (to, subject, html/text)
│     ├─ Cria transportador SMTP
│     ├─ Envia email
│     └─ Retorna { success: true, messageId }
│
└─ healthCheck()
   └─ Verifica se conexão SMTP está funcional
      ├─ Valida configuração de ambiente
      ├─ Cria transportador
      ├─ Verifica conexão
      └─ Retorna { status: 'ok'|'error' }
```

### 2. **src/handlers/projects.js**
```
Função: Handler da API de projetos
├─ module.create()
│  ├─ Recebe POST /projects
│  ├─ Valida autenticação (admin ou arquiteto)
│  ├─ INSERT projeto no BD
│  ├─ Query para obter detalhes (nome, emails, etc)
│  │
│  ├─ Enviar email ao ARQUITETO
│  │  └─ sendEmailNotification(
│  │     to: architect_email,
│  │     subject: 'Novo projeto atribuído',
│  │     html: emailTemplateProjectCreated()
│  │  )
│  │
│  ├─ Enviar email ao CLIENTE
│  │  ├─ Query para obter client_email
│  │  └─ sendEmailNotification(
│  │     to: client_email,
│  │     subject: 'Seu projeto está pronto!',
│  │     html: emailTemplateProjectCreatedForClient()
│  │  )
│  │
│  └─ Retorna { id, email_architect_sent, email_client_sent }
```

### 3. **Configuração de Ambiente**
```
.env (local) ou Lambda Environment Variables
├─ EMAIL_PROVIDER = 'kinghost'
├─ EMAIL_USER = 'comercial@render7.com.br'
├─ EMAIL_PASS = 'Render123$'
├─ EMAIL_FROM = 'Render 7 Comercial <comercial@render7.com.br>'
├─ EMAIL_HOST = 'smtp.kinghost.net'
├─ EMAIL_PORT = '587'
└─ EMAIL_SECURE = 'false'
```

## Sequência Temporal: Criar Projeto

```
T0: Admin clica "Criar Projeto"
    │
T1: API: POST /projects { name, architect_id, client_id, ... }
    │
T2: Auth válido? ✓
    │
T3: Banco: INSERT projeto
    │
T4: Banco: SELECT projeto + arquiteto + cliente
    │
T5: Nodemailer: Conecta SMTP Kinghost (port 587)
    │
T6: Nodemailer: Autentica (comercial@render7.com.br / Render123$)
    │
T7: Nodemailer: Envia email #1 (arquiteto)
    │       Email #1 sai de commercial@render7.com.br → joao@example.com
    │
T8: Nodemailer: Envia email #2 (cliente)
    │       Email #2 sai de commercial@render7.com.br → maria@example.com
    │
T9: API Response: 201 { id, email_architect_sent: true, email_client_sent: true }
    │
T10: Admin vê "Projeto criado com sucesso!"
     Arquiteto recebe email em 1-5 segundos
     Cliente recebe email em 1-5 segundos
```

## Tratamento de Erros

```
Fluxo de tratamento de falhas:
├─ EMAIL_PROVIDER não reconhecido?
│  └─ healthCheck() retorna { status: 'error' }
│
├─ EMAIL_USER ou EMAIL_PASS faltando?
│  └─ Tentativa de conexão falha (EAUTH)
│  └─ Log: "[email] ✗ Erro de autenticação"
│
├─ SMTP Kinghost indisponível?
│  └─ sendEmail() throws erro
│  └─ sendEmailNotification() catch e retorna false
│  └─ API ainda responde com email_architect_sent: false
│
├─ Email para arquiteto falha?
│  └─ Tenta enviar para cliente normalmente
│  └─ Ambos separados para independência
│
├─ Email para cliente falha?
│  └─ Não afeta email do arquiteto
│  └─ Log com warning
```

## Configurações de Provedor

```
KINGHOST (atual)
├─ Host: smtp.kinghost.net
├─ Port: 587
├─ Secure: false (usa STARTTLS)
├─ Auth: usuario@kinghost.com.br / senha
└─ TLS: { rejectUnauthorized: false }

GMAIL
├─ Host: smtp.gmail.com
├─ Port: 587
├─ Secure: false (usa STARTTLS)
├─ Auth: email@gmail.com / app-password
└─ 2FA: obrigatório

SENDGRID
├─ Host: smtp.sendgrid.net
├─ Port: 587
├─ Secure: false
├─ Auth: apikey / API_KEY
└─ Rate limit: 600 emails/minuto

CUSTOM
├─ Host: seu-smtp-host.com
├─ Port: 587 ou 465
├─ Secure: true (565) ou false (587)
├─ Auth: usuario / senha
└─ TLS: variável
```

## Dados Sensíveis

```
Proteção de credenciais:
├─ Desenvolvimento (Local)
│  └─ .env com EMAIL_PASS (nunca commit)
│
├─ Produção (AWS Lambda)
│  └─ AWS Systems Manager Parameter Store
│     └─ /render7/email-password (criptografado)
│
└─ Boas práticas
   ├─ Adicionar .env ao .gitignore
   ├─ Usar ENV_EXAMPLE como template
   ├─ Rotar senhas periodicamente
   └─ Usar app-specific passwords (Gmail, etc)
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | Antes (Relay HTTP) | Depois (Nodemailer) |
|---------|-------------------|---------------------|
| **Serviços envolvidos** | AWS + Render + Kinghost | AWS + Kinghost |
| **Latência** | ~500-1000ms | ~100-300ms |
| **Custo** | Render (~$7/mês) | Grátis |
| **Provedores suportados** | 1 (Kinghost) | 4+ (Gmail, SendGrid, etc) |
| **Pontos de falha** | 3 (Lambda, Render, SMTP) | 2 (Lambda, SMTP) |
| **Manutenção** | Mais complexa | Mais simples |
| **Deploy** | 2 aplicações | 1 aplicação |
| **Escalabilidade** | Limitada | Melhor |

---

## 🔍 Monitoramento e Logs

```
Logs importantes:
├─ [email] ✓ E-mail enviado | messageId: <id>
├─ [email] ✗ Falha ao enviar: <erro>
├─ [projects.create] E-mail arquiteto: ✓
├─ [projects.create] E-mail cliente: ✗
└─ [relay] Acesso negado — token inválido (antes)
```

---

Criado em: 2025-06-19  
Versão: 1.0
