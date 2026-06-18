# Documentação — Disparo de E-mail via SMTP

## Visão Geral

Script Node.js para envio de e-mails transacionais utilizando a biblioteca **nodemailer**,
configurado com as credenciais SMTP do domínio `render7.com.br` hospedado na **Kinghost**.

---

## Credenciais Utilizadas

| Campo        | Valor                        |
|--------------|------------------------------|
| Remetente    | comercial@render7.com.br     |
| Senha        | Render123$                   |
| Destinatário | franciscoaraujodev@gmail.com |

---

## Configuração da Conexão SMTP

### Como o servidor foi descoberto

O servidor SMTP **não foi configurado manualmente**. Foi feita uma consulta ao registro **DNS MX**
do domínio `render7.com.br` com o seguinte comando PowerShell:

```powershell
Resolve-DnsName -Name render7.com.br -Type MX
```

**Resultado retornado:**

```
NameExchange              Preference
------------              ----------
mx-vip-01.kinghost.net    5
mx-vip-02.kinghost.net    5
```

Isso confirmou que o domínio utiliza a infraestrutura de e-mail da **Kinghost**.
O servidor SMTP da Kinghost utilizado foi: `smtp.kinghost.net`.

---

### Parâmetros SMTP

| Parâmetro            | Valor               |
|----------------------|---------------------|
| Host SMTP            | smtp.kinghost.net   |
| Porta                | 587                 |
| Segurança            | STARTTLS            |
| Autenticação         | Login/Senha (AUTH)  |
| TLS rejectUnauthorized | false (compatibilidade com cert. autoassinado) |

---

## Tecnologias

- **Runtime:** Node.js
- **Biblioteca:** [nodemailer](https://nodemailer.com/) v6.x
- **Protocolo:** SMTP com STARTTLS (porta 587)

---

## Como Executar

```bash
# Instalar dependências (apenas na primeira vez)
npm install

# Enviar o e-mail
node send-email.js
```

---

## Caminho Mais Simples Sem AWS SES

O teste local de conectividade com a Kinghost respondeu com sucesso nas portas 587 e 465.
O timeout acontece no ambiente AWS Lambda. Por isso, o caminho mais simples e estavel e:

1. Hospedar um relay HTTP fora da AWS.
2. Esse relay usa o SMTP da Kinghost no proprio Render ou em outro host com saida liberada.
3. A Lambda envia um POST HTTPS para esse relay, em vez de abrir SMTP diretamente.

Nesta versao, a AWS nao tenta mais enviar SMTP direto. Se o relay nao estiver configurado, o backend registra isso nos logs e retorna o status de e-mail pendente.

### Arquivo pronto no projeto

Foi adicionado o arquivo `email-relay.js`, que expoe:

- `GET /health`
- `POST /send-email`

### Como iniciar o relay localmente

```bash
npm install
npm run relay:start
```

### Como subir no Render

O projeto ja possui o arquivo `render.yaml` pronto.

1. Criar um novo Web Service no Render apontando para este repositorio.
2. O Render vai ler `render.yaml` e subir o servico `render7-email-relay`.
3. Preencher no painel do Render:

```bash
EMAIL_RELAY_TOKEN=troque-por-um-token-forte
SMTP_PASS=Render123$
```

O `SMTP_USER` ja foi deixado como `comercial@render7.com.br` no `render.yaml`.

### Variaveis recomendadas no host do relay

```bash
RELAY_PORT=3001
EMAIL_RELAY_TOKEN=troque-por-um-token-forte
SMTP_USER=comercial@render7.com.br
SMTP_PASS=Render123$
```

### Variaveis para a Lambda usar o relay

Defina no ambiente onde voce roda o deploy:

```bash
EMAIL_RELAY_URL=https://seu-servico-no-render.onrender.com/send-email
EMAIL_RELAY_TOKEN=troque-por-um-token-forte
serverless deploy
```

### Fluxo final

- Portal admin chama a API normal.
- API salva/atualiza o projeto.
- API faz POST para o relay no Render.
- Relay externo envia via SMTP Kinghost.

Isso remove a dependencia de SMTP saindo da AWS e mantem o envio profissional com Nodemailer.

---

## Estrutura do Projeto

```
e-mail/
├── send-email.js     # Script principal de envio
├── package.json      # Dependências do projeto
├── node_modules/     # Bibliotecas instaladas
└── DOCUMENTACAO.md   # Este arquivo
```
