# 🚀 GUIA DE DEPLOY - ENGENHARIAPRO SAAS NA VERCEL

## 📋 Pré-requisitos

Antes de começar, você precisa de:

1. **Conta na Vercel** - [vercel.com](https://vercel.com)
2. **Conta no GitHub** - Para conectar o repositório
3. **Banco de Dados PostgreSQL** - Recomendado Supabase ou Railway
4. **Git** - Instalado localmente
5. **Node.js 18+** - Instalado

---

## 🗄️ PASSO 1: Configurar o Banco de Dados

### Opção A: Supabase (RECOMENDADO)

1. Acesse [supabase.com](https://supabase.com)
2. Crie uma nova organização e projeto
3. Escolha **PostgreSQL 15**
4. Aguarde a criação (2-3 minutos)
5. Na aba **SQL Editor**, execute o arquivo `schema.sql`:
   - Copie todo o conteúdo de `schema.sql`
   - Cole na aba SQL Editor
   - Clique em **Run**
6. Copie a **Database URL** em Settings > Database > Connection String:
   ```
   postgresql://[user]:[password]@[host]:[port]/[database]
   ```

### Opção B: Railway

1. Acesse [railway.app](https://railway.app)
2. Clique em **New Project** → **Provision PostgreSQL**
3. Na aba **Data**, clique em **PostgreSQL**
4. Abra o plugin e copie a **Database URL**
5. Execute o `schema.sql` usando pgAdmin ou similar

### Opção C: Local (Apenas para testes)

```bash
# Instale PostgreSQL localmente
# Windows: https://www.postgresql.org/download/windows/
# macOS: brew install postgresql
# Linux: sudo apt-get install postgresql

# Crie o banco
createdb engenhariapro

# Execute o schema
psql -U postgres -d engenhariapro -f schema.sql
```

---

## 📦 PASSO 2: Preparar o Repositório

### 2.1 Inicializar Git (Se não tiver)

```bash
cd c:\Users\Wallace\Desktop\teste
git init
git add .
git commit -m "Initial commit - ENGENHARIAPRO SAAS"
```

### 2.2 Criar Repositório no GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Crie um repositório com nome `engenhariapro-saas`
3. **NÃO** initialize com README (já existe)
4. Copie o comando para adicionar remote:

```bash
git remote add origin https://github.com/seu-usuario/engenhariapro-saas.git
git branch -M main
git push -u origin main
```

---

## 🔧 PASSO 3: Configurar Vercel

### 3.1 Conectar GitHub à Vercel

1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique em **Add New** → **Project**
3. Clique em **Import Git Repository**
4. Autorize Vercel a acessar seu GitHub
5. Selecione o repositório `engenhariapro-saas`
6. Clique em **Import**

### 3.2 Configurar Variáveis de Ambiente

Na tela de configuração do projeto:

1. **Root Directory**: Deixe em branco (padrão)
2. **Build Command**: `npm run build`
3. **Output Directory**: `dist`
4. **Install Command**: `npm install`

Clique em **Environment Variables** e adicione:

```
VITE_API_URL = https://seu-dominio.com
DATABASE_URL = postgresql://user:password@host:5432/db
GEMINI_API_KEY = sua-chave-aqui
VITE_MERCADO_PAGO_KEY = sua-chave-opcional
NODE_ENV = production
```

### 3.3 Deploy Inicial

1. Clique em **Deploy**
2. Aguarde a build completar (2-5 minutos)
3. Verifique se todos os checks passaram
4. Acesse o URL da Vercel gerado automaticamente

---

## ✅ PASSO 4: Pós-Deploy - Verificações

### Checklist:

- [ ] Projeto carrega sem erros (F12 → Console)
- [ ] Login funciona (teste com `master@plataforma.com`)
- [ ] Dashboard exibe dados corretamente
- [ ] Gráficos (Curva S) renderizam
- [ ] PDFs podem ser gerados
- [ ] Dados persistem no banco

### Se houver erros:

1. **Vercel Dashboard** → **Deployments** → **Logs** - Verifique build logs
2. **Browser Console** (F12) - Procure por erros JavaScript
3. **Vercel CLI** para debug local:
   ```bash
   npm install -g vercel
   vercel --prod
   ```

---

## 🌐 PASSO 5: Configurar Domínio Personalizado (Opcional)

1. Vá para **Project Settings** → **Domains**
2. Clique em **Add Domain**
3. Digite seu domínio (ex: `engenhariapro.com.br`)
4. Escolha **CNAME** e siga as instruções do seu registrador
5. Aguarde propagação (15-48 horas)

---

## 🔐 PASSO 6: Adicionar SSL/HTTPS (Automático)

Vercel fornece SSL gratuito via Let's Encrypt. Verifique em:
- **Project Settings** → **Domains** → Seu domínio → Status

---

## 🚀 DEPLOY CONTÍNUO (CI/CD)

Vercel redeploy automaticamente quando você faz push para `main`:

```bash
# Fazer alterações localmente
git add .
git commit -m "Melhoria no dashboard"
git push origin main

# Vercel detecta e faz deploy automaticamente
# Verifique em vercel.com/dashboard
```

---

## 📊 MONITORAMENTO E LOGS

### Acessar Logs em Tempo Real:

```bash
vercel logs engenhariapro-saas.vercel.app --tail
```

### Verificar Performance:

1. **Vercel Dashboard** → **Analytics**
2. **Web Vitals** - Core Web Vitals do site
3. **Edge Network** - Distribuição global

---

## 🔄 ROLLBACK (Voltar para Deploy Anterior)

1. **Vercel Dashboard** → **Deployments**
2. Selecione o deployment anterior
3. Clique em **Promote to Production**

---

## 💾 BACKUP DO BANCO DE DADOS

### Supabase:

```bash
# Backup automático
# Supabase faz backup diário automaticamente
# Settings → Database → Backups
```

### PostgreSQL Direto:

```bash
# Fazer backup local
pg_dump -U usuario -h host -d engenhariapro > backup.sql

# Restaurar
psql -U usuario -h host -d engenhariapro < backup.sql
```

---

## 🚨 TROUBLESHOOTING

### "Build failed"
- Verifique `npm run build` localmente
- Verifique logs de build na Vercel
- Certifique-se de que todas as dependências estão em `package.json`

### "Database connection error"
- Verifique DATABASE_URL nas Environment Variables
- Teste a URL localmente: `psql postgresql://...`
- Verifique whitelist de IP no seu provedor de BD

### "Erro 404 em páginas"
- Vercel redireciona automaticamente para `index.html`
- Verifique `vite.config.ts` está correto

### "Dados não persistem"
- Verifique se `dailyLogs` está sendo salvos no localStorage corretamente
- Considere usar Supabase Client para sincronização real-time

---

## 📱 Versões do Ambiente

| Ferramenta | Versão |
|-----------|--------|
| Node.js | 18+ |
| npm | 10+ |
| TypeScript | 5.8.2 |
| React | 19.2.3 |
| Vite | 6.2.0 |
| PostgreSQL | 15+ |

---

## 🎯 Próximos Passos

1. **Configurar Email** - Adicionar sendgrid para notificações
2. **Implementar Auth0** - Para autenticação robusta
3. **Adicionar Analytics** - Google Analytics ou Vercel Analytics
4. **CDN para Assets** - Cloudflare para imagens e PDFs
5. **Monitoring** - Sentry para error tracking

---

## 📞 Suporte

- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs
- **React Docs**: https://react.dev
- **Vite Docs**: https://vitejs.dev

---

## ✅ Checklist Final

- [ ] GitHub repositório criado e pusheado
- [ ] Banco de dados PostgreSQL configurado
- [ ] schema.sql executado com sucesso
- [ ] Vercel conectada ao GitHub
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy inicial bem-sucedido
- [ ] Funcionalidades principais testadas
- [ ] Domínio personalizado (opcional) configurado
- [ ] SSL/HTTPS ativo
- [ ] Backup strategy implementado

---

## 📝 Notas Importantes

1. **Segurança**: Nunca commit `.env` ou `DATABASE_URL` diretamente
2. **Performance**: Vercel oferece cache automático e CDN global
3. **Scaling**: Aumento automático de recursos conforme demanda
4. **Custo**: Plano gratuito adequado para MVP, pague conforme cresce

---

**Projeto: ENGENHARIAPRO SAAS**  
**Data: 20 de Janeiro de 2026**  
**Versão: 1.0.0**
