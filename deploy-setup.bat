@echo off
REM ================================================
REM SCRIPT DE DEPLOY - ENGENHARIAPRO SAAS (WINDOWS)
REM ================================================
REM Este script automatiza o setup para deploy na Vercel
REM ================================================

setlocal enabledelayedexpansion

echo.
echo ========================================
echo 🚀 ENGENHARIAPRO SAAS - SETUP PARA VERCEL
echo ========================================
echo.

REM 1. Verificar se está no diretório correto
if not exist "package.json" (
    echo ❌ Erro: Execute este script na raiz do projeto
    echo Copie o arquivo para a pasta do projeto e execute de lá.
    pause
    exit /b 1
)

echo ✅ Diretório verificado
echo.

REM 2. Verificar Node.js
echo 📦 Verificando Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js não está instalado
    echo 📥 Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION%
echo.

REM 3. Instalar dependências
echo 📥 Instalando dependências...
call npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependências
    pause
    exit /b 1
)
echo ✅ Dependências instaladas
echo.

REM 4. Build test
echo 🔨 Testando build...
call npm run build
if errorlevel 1 (
    echo ❌ Erro no build
    pause
    exit /b 1
)
echo ✅ Build bem-sucedido
echo.

REM 5. Verificar arquivos necessários
echo 📋 Verificando arquivos de configuração...

setlocal disableDelayedExpansion

set "files=schema.sql vercel.json .env.example README-DEPLOY.md"

for %%f in (%files%) do (
    if exist "%%f" (
        echo ✅ %%f existe
    ) else (
        echo ⚠️  %%f não encontrado
    )
)

setlocal enableDelayedExpansion

echo.

REM 6. Git setup
echo 🔄 Configurando Git...

git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    call git init
    echo ✅ Repositório Git inicializado
) else (
    echo ✅ Repositório Git já existe
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Execute: git remote add origin https://github.com/seu-usuario/engenhariapro-saas.git
) else (
    echo ✅ Git remote 'origin' configurado
)

echo.

REM 7. Verificar .env
echo 🔐 Verificando variáveis de ambiente...

if exist ".env.local" (
    echo ✅ .env.local já existe
) else (
    echo 📝 Criando .env.local a partir de .env.example...
    if exist ".env.example" (
        copy .env.example .env.local >nul
        echo ✅ .env.local criado
        echo ⚠️  Edite .env.local com suas credenciais
    ) else (
        echo ❌ .env.example não encontrado
    )
)

echo.

REM 8. Resumo
echo ========================================
echo ✅ SETUP CONCLUÍDO COM SUCESSO
echo ========================================
echo.

echo 📋 Próximos passos:
echo.
echo 1️⃣  Configure o banco de dados:
echo     - Supabase: supabase.com
echo     - Railway: railway.app
echo     - Copie o DATABASE_URL
echo.
echo 2️⃣  Execute o schema.sql no seu banco
echo.
echo 3️⃣  Configure Git e GitHub:
echo     git add .
echo     git commit -m "Initial commit"
echo     git push -u origin main
echo.
echo 4️⃣  Deploy na Vercel:
echo     - Acesse vercel.com/new
echo     - Importe seu repositório GitHub
echo     - Adicione variáveis de ambiente
echo     - Click DEPLOY
echo.
echo 5️⃣  Edite .env.local com suas credenciais
echo.
echo 📖 Para mais detalhes, leia: README-DEPLOY.md
echo ⚡ Quick start: DEPLOY-QUICK-START.md
echo.
echo 🎉 Seu app estará online em minutos!
echo.

pause
