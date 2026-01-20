# 🚀 QUICK START - DEPLOY VERCEL

## ⚡ Resumo Executivo

Este projeto é uma plataforma SaaS de Engenharia (ENGENHARIAPRO) desenvolvida com React + TypeScript + Vite.

**Tempo estimado de deploy: 15-20 minutos**

---

## 📋 Arquivos Necessários (Já Inclusos)

✅ `schema.sql` - Schema completo do banco PostgreSQL  
✅ `vercel.json` - Configuração da Vercel  
✅ `.env.example` - Template de variáveis de ambiente  
✅ `README-DEPLOY.md` - Guia detalhado (leia primeiro!)

---

## 🎯 3 Passos Rápidos

### 1️⃣ BANCO DE DADOS (5 min)

```
📌 Opção mais fácil: SUPABASE

a) Acesse supabase.com
b) Crie novo projeto (PostgreSQL 15)
c) Copie schema.sql completo
d) Cole em SQL Editor do Supabase
e) Click RUN
f) Copie DATABASE_URL das Settings
```

### 2️⃣ GITHUB (5 min)

```bash
# No seu terminal, na pasta do projeto:
cd c:\Users\Wallace\Desktop\teste

git init
git add .
git commit -m "Initial commit"

# Criar repo em github.com/new
# Copie os comandos e execute:
git remote add origin https://github.com/seu-usuario/engenhariapro-saas.git
git branch -M main
git push -u origin main
```

### 3️⃣ VERCEL (5 min)

```
📌 No Dashboard da Vercel:

a) New → Import Git Repository
b) Selecione seu repo (engenhariapro-saas)
c) Add Environment Variables:
   - DATABASE_URL = [copie do Supabase]
   - GEMINI_API_KEY = [sua chave, ou deixe em branco por enquanto]
d) Click DEPLOY
e) Aguarde build (2-5 min)
f) Pronto! Seu app está online! 🎉
```

---

## 🔑 Credenciais de Teste

```
Email: master@plataforma.com
Senha: (deixe em branco ou configure após login)
Plano: PRO (completo)
Usuários: ilimitado durante teste
```

---

## ✅ Checklist Pré-Deploy

- [ ] Node.js 18+ instalado (`node --version`)
- [ ] `npm run build` executa sem erros localmente
- [ ] Conta Supabase criada
- [ ] Repositório GitHub criado
- [ ] Conta Vercel conectada ao GitHub

---

## 📊 Arquitetura da Plataforma

```
┌─────────────────────────────────────┐
│   VERCEL (Frontend - React/Vite)    │
│   - Dashboard                       │
│   - Cronograma (Curva S)            │
│   - Diário de Obra (RDO)            │
│   - Gestão de Recursos              │
│   - Relatórios em PDF               │
└────────────┬────────────────────────┘
             │ HTTPS
             ▼
┌─────────────────────────────────────┐
│   SUPABASE (Backend - PostgreSQL)   │
│   - Autenticação                    │
│   - Projetos & Tarefas              │
│   - Diários & Impedimentos          │
│   - Recursos & Usuários             │
│   - Backup automático               │
└─────────────────────────────────────┘
```

---

## 🌍 URLs

```
🔗 Frontend: https://seu-projeto.vercel.app
🔗 API: Integrada (localStorage + Supabase)
🔗 BD: Supabase PostgreSQL
🔗 Domínio Custom: (opcional) seu-dominio.com.br
```

---

## 🔐 Variáveis de Ambiente Necessárias

```env
# OBRIGATÓRIO
DATABASE_URL=postgresql://...  # Do Supabase

# OPCIONAL (Deixe em branco se não tiver)
GEMINI_API_KEY=sua-chave      # Para IA (não essencial)
VITE_MERCADO_PAGO_KEY=...    # Para pagamentos (não essencial)
```

---

## 📱 Funcionalidades Principais

✅ **Dashboard** - Visão geral de projetos  
✅ **Cronograma** - Visualizar tarefas e dependências  
✅ **Curva S** - Gráfico de progresso planejado vs realizado  
✅ **RDO** - Diário de obra com fotos e impedimentos  
✅ **Impedimentos** - Registrar paradas e cascata automática  
✅ **Relatórios** - Exportar PDF com assinaturas  
✅ **Gestão de Recursos** - Equipes e máquinas  
✅ **Multi-tenant** - Suporta múltiplas empresas

---

## 🚨 Problemas Comuns

| Problema | Solução |
|----------|---------|
| Build falha | Rode `npm run build` localmente primeiro |
| Banco não conecta | Verifique DATABASE_URL em Vercel → Settings |
| Página fica em branco | Abra F12 → Console e procure por erros |
| Dados não salvam | Certifique-se que localStorage está ativo |

---

## 💡 Dicas

1. **Teste localmente primeiro**: `npm run dev`
2. **Use Git branches**: `git checkout -b feature/nova-funcionalidade`
3. **Deploy automático**: Push para main faz deploy na Vercel
4. **Logs em tempo real**: `vercel logs seu-projeto.vercel.app --tail`
5. **Rollback rápido**: Vercel dashboard → Deployments → Promote anterior

---

## 📞 Links Úteis

- 📖 [Leia README-DEPLOY.md para guia completo](./README-DEPLOY.md)
- 🗄️ [Schema SQL](./schema.sql)
- ⚙️ [Vercel Config](./vercel.json)
- 🔧 [Environment Template](./.env.example)

---

## 🎓 Próximas Etapas Após Deploy

1. **Configurar Domínio** - Apontar seu domínio para Vercel
2. **Adicionar Usuários** - Criar contas para sua equipe
3. **Importar Dados** - Migrar dados existentes (se houver)
4. **Configurar Notificações** - Email, Slack, etc
5. **Monitorar Performance** - Usar Vercel Analytics

---

## ✨ Suporte

**Documentação Técnica**: README-DEPLOY.md  
**Configuração de Banco**: schema.sql  
**Variáveis de Ambiente**: .env.example

---

**Status**: ✅ Pronto para Deploy  
**Data**: 20 de Janeiro de 2026  
**Versão**: 1.0.0  
**Platform**: Vercel + Supabase
