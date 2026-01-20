#!/bin/bash

# ================================================
# SCRIPT DE DEPLOY - ENGENHARIAPRO SAAS
# ================================================
# Este script automatiza o setup para deploy na Vercel
# ================================================

echo "🚀 ENGENHARIAPRO SAAS - SETUP PARA VERCEL"
echo "=========================================="
echo ""

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Erro: Execute este script na raiz do projeto"
    exit 1
fi

echo "✅ Diretório verificado"
echo ""

# 1. Verificar Node.js
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado"
    echo "📥 Baixe em: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo "✅ Node.js $NODE_VERSION"
echo ""

# 2. Instalar dependências
echo "📥 Instalando dependências..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi
echo "✅ Dependências instaladas"
echo ""

# 3. Build test
echo "🔨 Testando build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erro no build"
    exit 1
fi
echo "✅ Build bem-sucedido"
echo ""

# 4. Verificar arquivos necessários
echo "📋 Verificando arquivos de configuração..."
FILES=("schema.sql" "vercel.json" ".env.example" "README-DEPLOY.md")

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file existe"
    else
        echo "⚠️  $file não encontrado"
    fi
done
echo ""

# 5. Git setup
echo "🔄 Configurando Git..."
if [ ! -d ".git" ]; then
    git init
    echo "✅ Repositório Git inicializado"
else
    echo "✅ Repositório Git já existe"
fi

# Verificar remoto
if git remote | grep -q "origin"; then
    echo "✅ Git remote 'origin' configurado"
else
    echo "⚠️  Execute: git remote add origin https://github.com/seu-usuario/engenhariapro-saas.git"
fi
echo ""

# 6. Verificar .env
echo "🔐 Verificando variáveis de ambiente..."
if [ -f ".env.local" ]; then
    echo "✅ .env.local já existe"
else
    echo "📝 Criando .env.local a partir de .env.example..."
    cp .env.example .env.local
    echo "⚠️  Edite .env.local com suas credenciais"
fi
echo ""

# 7. Resumo
echo "=========================================="
echo "✅ SETUP CONCLUÍDO COM SUCESSO"
echo "=========================================="
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1️⃣  Configure o banco de dados:"
echo "    - Supabase: supabase.com"
echo "    - Railway: railway.app"
echo "    - Copie o DATABASE_URL"
echo ""
echo "2️⃣  Execute o schema.sql no seu banco:"
echo "    cat schema.sql | psql [sua-database-url]"
echo ""
echo "3️⃣  Configure Git e GitHub:"
echo "    git add ."
echo "    git commit -m 'Initial commit'"
echo "    git push -u origin main"
echo ""
echo "4️⃣  Deploy na Vercel:"
echo "    - Acesse vercel.com/new"
echo "    - Importe seu repositório GitHub"
echo "    - Adicione variáveis de ambiente"
echo "    - Click DEPLOY"
echo ""
echo "5️⃣  Edite .env.local com suas credenciais:"
echo "    nano .env.local"
echo ""
echo "📖 Para mais detalhes, leia: README-DEPLOY.md"
echo "⚡ Quick start: DEPLOY-QUICK-START.md"
echo ""
echo "🎉 Seu app estará online em minutos!"
