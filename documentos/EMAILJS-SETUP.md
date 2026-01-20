# 📧 CONFIGURAÇÃO EMAILJS - PASSO A PASSO

## Status: ✅ Código Pronto | ⏳ Aguardando Configuração

---

## 1️⃣ CRIAR CONTA EMAILJS

### Acesso:
```
https://www.emailjs.com/
```

### Passos:
1. Clique "Sign Up" (canto superior direito)
2. Escolha "Sign up with Google" ou "Sign up with Email"
3. Preencha dados (nome, email, senha)
4. Confirme email (link no inbox)
5. ✅ Conta criada!

---

## 2️⃣ CRIAR EMAIL SERVICE

### Passos:
1. Login em https://dashboard.emailjs.com
2. Esquerda → "Email Services"
3. Clique "+ Add Service"
4. Escolha provedor:
   - **Gmail** (recomendado para teste)
   - Outlook
   - Yahoo Mail
   - Outro SMTP

### Se Escolher Gmail:
1. Clique "Gmail"
2. Clique "Connect Gmail"
3. Autorize acesso (será redirecionado para Google)
4. Retorne ao EmailJS
5. Name: `Gmail Service` (ou seu escolha)
6. Clique "Create Service"
7. ✅ Service ID aparece na tela

**Copie o Service ID:**
```
Exemplo: service_abc123xyz789
```

---

## 3️⃣ CRIAR EMAIL TEMPLATE

### Passos:
1. Esquerda → "Email Templates"
2. Clique "+ Create New Template"
3. Template Name: `Welcome Email` (ou seu escolha)
4. Subject: `🔐 Bem-vindo à {{APP_NAME}} - Seus Dados de Acesso`

### Conteúdo do Template:

**Em "Email Template"**, insira:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); color: white; padding: 40px 20px; text-align: center; }
        .content { padding: 40px 20px; }
        .credentials { background-color: #f0f7ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; }
        .credentials-item { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; }
        .label { font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; }
        .button { display: inline-block; padding: 14px 40px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Bem-vindo à Plataforma!</h1>
            <p>ENGENHARIAPRO SAAS</p>
        </div>
        
        <div class="content">
            <p>Olá <strong>{{TO_NAME}}</strong>,</p>
            <p>Sua conta foi criada com sucesso! Abaixo estão seus dados de acesso para entrar na plataforma. Por favor, <strong>altere sua senha no primeiro login</strong> por razões de segurança.</p>
            
            <div class="credentials">
                <p style="color: #1e40af; font-weight: bold; margin: 0 0 15px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">📋 DADOS DE ACESSO</p>
                <div class="credentials-item">
                    <p class="label">E-mail de Acesso</p>
                    <p class="value">{{TO_EMAIL}}</p>
                </div>
                <div class="credentials-item">
                    <p class="label">Senha Temporária</p>
                    <p class="value">{{TEMP_PASSWORD}}</p>
                </div>
            </div>
            
            <div class="warning">
                <p style="margin: 0; font-weight: bold; color: #856404;">⚠️ Importante:</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404;">
                    <li>Altere sua senha imediatamente após o primeiro login</li>
                    <li>Nunca compartilhe suas credenciais com terceiros</li>
                    <li>Use uma senha forte e única</li>
                </ul>
            </div>
            
            <center>
                <a href="https://seu-dominio.com/login" class="button">Acessar Plataforma</a>
            </center>
            
            <div class="footer">
                <p>Em caso de dúvidas, entre em contato com o suporte: <strong>support@engenhariapro.com.br</strong></p>
            </div>
        </div>
    </div>
</body>
</html>
```

### Variáveis do Template:
```
{{TO_NAME}}           → Nome do usuário
{{TO_EMAIL}}          → E-mail do usuário
{{TEMP_PASSWORD}}     → Senha temporária gerada
{{APP_NAME}}          → Nome da aplicação
```

### Salvar Template:
1. Clique "Save"
2. ✅ Template ID aparece (ex: `template_abc123xyz789`)

---

## 4️⃣ OBTER PUBLIC KEY

### Passos:
1. Dashboard → "Account"
2. Esquerda → Clique em seu nome
3. Vá para "Account"
4. Procure por "API Keys" ou "Public Key"
5. Copie o valor que começa com `dcxxx...` ou similar
6. ✅ Você tem sua Public Key

---

## 5️⃣ CONFIGURAR .env.local (LOCAL)

### Criar arquivo `.env.local` na raiz do projeto:

```bash
# Duplicar .env.example
cp .env.example .env.local

# Ou criar manualmente na raiz:
# c:\Users\Wallace\Desktop\teste\.env.local
```

### Conteúdo `.env.local`:

```dotenv
# ================================================
# EMAILJS - NOTIFICAÇÕES
# ================================================
VITE_EMAILJS_SERVICE_ID=service_seu_id_aqui
VITE_EMAILJS_TEMPLATE_ID=template_seu_id_aqui
VITE_EMAILJS_PUBLIC_KEY=sua_public_key_aqui
```

**Exemplo Real:**
```dotenv
VITE_EMAILJS_SERVICE_ID=service_wq7h3k2l
VITE_EMAILJS_TEMPLATE_ID=template_jq9f2m8p
VITE_EMAILJS_PUBLIC_KEY=dc7q8w2k3j9l0p1m
```

### Validar:
1. Abra terminal
2. Execute: `npm run dev`
3. Plataforma carrega normalmente
4. ✅ Sem erros "undefined environment variable"

---

## 6️⃣ CONFIGURAR VERCEL (PRODUÇÃO)

### Passos:

#### 1. Dashboard Vercel
```
https://vercel.com/dashboard
```

#### 2. Selecionar Projeto
- Clique no projeto `engenhariapro-saas`

#### 3. Settings
- Vá para "Settings" (menu superior)
- Esquerda → "Environment Variables"

#### 4. Adicionar Variáveis
- Clique "+ Add New"
- Name: `VITE_EMAILJS_SERVICE_ID`
- Value: `service_seu_id`
- Production: ✅ Checkado
- Clique "Add"

- Clique "+ Add New"
- Name: `VITE_EMAILJS_TEMPLATE_ID`
- Value: `template_seu_id`
- Production: ✅ Checkado
- Clique "Add"

- Clique "+ Add New"
- Name: `VITE_EMAILJS_PUBLIC_KEY`
- Value: `sua_public_key`
- Production: ✅ Checkado
- Clique "Add"

#### 5. Redeploy
- Vá para "Deployments"
- Clique "... Redeploy" no deployment mais recente
- Clique "Redeploy"
- Aguarde ~3-5 minutos
- ✅ Deploy completo

---

## 7️⃣ TESTAR FUNCIONAMENTO

### Local (http://localhost:3000):

1. Login como Master: `master@plataforma.com`
2. Vá para MasterAdmin → Aba "Usuarios" ou "Tenants"
3. Clique "Convidar Novo Usuário"
4. Preencha:
   - Nome: `Test User`
   - Email: seu_email_pessoal@gmail.com
   - Cargo: `Tester`
5. Clique "Enviar"
6. Aguarde 2-3 segundos
7. Verifique seu email
8. ✅ E-mail recebido com template profissional!

### Produção (https://seu-dominio.vercel.app):

1. Repita passos acima na URL de produção
2. ✅ E-mail dispara da plataforma em produção

---

## 🔧 TROUBLESHOOTING

### "EmailJS não configurado"
**Problema:** Console mostra `console.warn('EmailJS não configurado')`

**Solução:**
1. Verificar `.env.local` (local)
2. Verificar Vercel Settings → Environment Variables (produção)
3. Certificar que nomes são exatos:
   - `VITE_EMAILJS_SERVICE_ID` (não SERVICE_Id)
   - `VITE_EMAILJS_TEMPLATE_ID` (não TEMPLATE_Id)
   - `VITE_EMAILJS_PUBLIC_KEY` (não PUBLIC_key)

### "Failed to send email"
**Problema:** E-mail não é enviado, console mostra erro

**Solução:**
1. Verificar que Gmail está autorizado no EmailJS
2. Verificar Service ID está correto
3. Testar em https://try.emailjs.com/ (ferramenta EmailJS)
4. Verificar limites de taxa EmailJS (500/mês grátis)

### "Invalid Service ID"
**Problema:** Erro ao enviar

**Solução:**
1. Copiar Service ID novamente do dashboard
2. Certificar que não há espaços antes/depois
3. Usar mesma chave em `.env.local` e Vercel

### E-mail vai para Spam
**Problema:** E-mail recebido em Spam

**Solução:**
1. Configurar DKIM e SPF em seu domínio (avançado)
2. Usar SendGrid ou Mailgun em produção
3. Para agora: usuários marcam como "Não é spam"

---

## 📊 LIMITES EMAILJS

| Plano | E-mails/mês | Custo |
|-------|------------|-------|
| Gratuito | 200 | $0 |
| Plus | 1000 | $14.99 |
| Pro | 5000 | $39.99 |
| Enterprise | Customizado | $ |

---

## 🚀 PRÓXIMAS ETAPAS

1. ✅ Configurar EmailJS (este guia)
2. ⏳ Configurar backend com bcrypt (próximo)
3. ⏳ Adicionar rate limiting no login (próximo)
4. ⏳ Implementar JWT tokens (próximo)
5. ⏳ Migrar para SendGrid ou Mailgun (produção)

---

## 📞 LINKS ÚTEIS

- EmailJS Dashboard: https://dashboard.emailjs.com
- EmailJS Docs: https://www.emailjs.com/docs/
- Try EmailJS: https://try.emailjs.com/
- Vercel Env Vars: https://vercel.com/docs/environment-variables

---

**Status: ✅ PRONTO PARA IMPLEMENTAR**

Siga este guia completo e o e-mail de boas-vindas funcionará perfeitamente!

