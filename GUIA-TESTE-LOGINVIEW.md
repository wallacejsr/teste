# 🧪 GUIA DE TESTE - LoginView Modernizada

> Instruções para validar a LoginView modernizada antes do deploy em produção

---

## ✅ ANTES DE COMEÇAR

- [ ] Node.js instalado
- [ ] Dependências instaladas (`npm install`)
- [ ] Dev server pronto (`npm run dev`)
- [ ] Navegador moderno (Chrome, Safari, Firefox)
- [ ] DevTools pronto para inspecionar

---

## 🚀 INICIAR DEV SERVER

```bash
# Terminal 1: Iniciar dev server
cd c:\Users\Wallace\Desktop\teste
npm run dev

# Output esperado:
# ✓ VITE v6.4.1  ready in 346 ms
# ➜  Local:   http://localhost:3001/
```

**URL para acessar**: http://localhost:3001

---

## 📱 TESTES DE RESPONSIVIDADE

### Desktop (1920x1080)
```
Abrir DevTools: F12
Desativar device emulation: Ctrl+Shift+M para sair
Tamanho da janela: 1920x1080
```

**Validar**:
- [ ] Split screen visível (60% esquerda + 40% direita)
- [ ] Imagem de canteiro de obras carregada
- [ ] Overlay elegante sobre imagem
- [ ] Frase "Engenharia que CONECTA pessoas" visível
- [ ] Formulário à direita com fundo branco
- [ ] Logo visível com círculo colorido
- [ ] Inputs com rounded-xl
- [ ] Botão com shadow-xl
- [ ] Todos os campos visíveis
- [ ] Animações suaves ao carregar

### Tablet (768x1024)
```
DevTools: F12
Device Emulation: Ctrl+Shift+M (ativar)
Selecionar: iPad (768x1024)
```

**Validar**:
- [ ] Imagem de fundo desaparece (hidden lg:flex)
- [ ] Formulário full width
- [ ] Inputs responsivos
- [ ] Botão full width
- [ ] Sem scroll horizontal
- [ ] Espaçamento adequado
- [ ] Tudo legível

### Mobile (375x667)
```
DevTools: F12
Device Emulation: Ctrl+Shift+M (ativar)
Selecionar: iPhone 12 (375x667)
```

**Validar**:
- [ ] Layout stacked vertical
- [ ] Inputs tocáveis (mínimo 44px)
- [ ] Botão full width
- [ ] Sem scroll horizontal
- [ ] Legível com zoom 100%
- [ ] Placeholders visíveis
- [ ] Labels acima dos inputs

---

## 🎨 TESTES VISUAIS

### Elementos Deletados (Verificar Ausência)
```
❌ NÃO DEVE ESTAR VISÍVEL:
- [ ] Box "MODO DESENVOLVIMENTO"
- [ ] Aviso vermelho "Serviço não inicializado"
- [ ] Boxes inline de erro (vermelhos)
- [ ] Boxes inline de sucesso (verdes)
```

### Elementos Adicionados (Verificar Presença)
```
✅ DEVE ESTAR VISÍVEL:
- [ ] Imagem de canteiro de obras na esquerda
- [ ] Overlay com gradient escuro sobre imagem
- [ ] Frase motivacional em branco
- [ ] Linha decorativa no rodapé esquerdo
- [ ] "Seguro e Confiável" no rodapé esquerdo
- [ ] Inputs com rounded-xl (mais arredondados)
- [ ] Sombra suave no formulário (shadow-xl)
- [ ] Logo com circulo colorido
- [ ] Botão com efeito hover (fica ligeiramente maior)
```

### Cores e Contraste
```
Desktop em 1920x1024:
- [ ] Fundo esquerdo: Slate-900 com overlay gradient
- [ ] Imagem: Cores naturais (canteiro de obras)
- [ ] Texto esquerdo: Branco/Cinza claro
- [ ] Fundo direito: Branco ou Slate-50
- [ ] Inputs: Branco com border slate-200
- [ ] Texto inputs: Slate-900 (escuro)
- [ ] Placeholders: Slate-400 (cinza)
- [ ] Labels: Slate-700 (escuro)
- [ ] Botão: Cor primária do globalConfig
```

---

## 🔄 TESTES DE FUNCIONALIDADE

### Fluxo: LOGIN

#### 1️⃣ Erro - Email/Senha em Branco
```
Ação:
  1. Clique no botão "Acessar Plataforma →" SEM preencher
  
Esperado:
  - [ ] Toast.error() aparece no canto inferior
  - [ ] Mensagem: "Preencha todos os campos obrigatórios"
  - [ ] Toast desaparece em 3-4 segundos
  - [ ] Botão volta ao estado normal
  - [ ] NÃO há alerta vermelho no formulário
```

#### 2️⃣ Erro - Credenciais Inválidas
```
Ação:
  1. Preencha Email: "teste@teste.com"
  2. Preencha Senha: "123456"
  3. Clique "Acessar Plataforma →"
  
Esperado:
  - [ ] Botão mostra spinner/animação de carregamento
  - [ ] Toast.error() aparece em 1-2 segundos
  - [ ] Mensagem: "Falha ao conectar. Verifique suas credenciais."
  - [ ] Spinner desaparece
  - [ ] Botão volta ao estado normal
```

#### 3️⃣ Sucesso - Login Válido (se tiver usuário)
```
Ação:
  1. Preencha Email: [seu email do Supabase]
  2. Preencha Senha: [sua senha]
  3. Clique "Acessar Plataforma →"
  
Esperado:
  - [ ] Spinner mostra por 1-2 segundos
  - [ ] Toast.success() aparece
  - [ ] Mensagem: "Login realizado com sucesso!"
  - [ ] App redirecionará para Dashboard
```

### Fluxo: CRIAR CONTA

#### 1️⃣ Navegar para Signup
```
Ação:
  1. Na tela de LOGIN
  2. Clique em "Criar nova conta"
  
Esperado:
  - [ ] Transição suave para SIGNUP
  - [ ] Novo campo aparece: "Nome Completo"
  - [ ] Novo campo: "Confirmar Senha"
  - [ ] Botão muda para "Criar Conta ✓"
  - [ ] Labels estão corretos
  - [ ] Animações aparecem em cascata
```

#### 2️⃣ Erro - Campo Obrigatório Vazio
```
Ação:
  1. Deixe "Nome" em branco
  2. Preencha outros campos
  3. Clique "Criar Conta ✓"
  
Esperado:
  - [ ] Toast.error() com "Preencha todos os campos obrigatórios"
  - [ ] Não envia formulário
```

#### 3️⃣ Erro - Senhas Não Correspondem
```
Ação:
  1. Preencha Senha: "Senha@123"
  2. Preencha Confirmar: "Senha@456"
  3. Clique "Criar Conta ✓"
  
Esperado:
  - [ ] Toast.error() com "As senhas não correspondem"
  - [ ] Não envia formulário
```

#### 4️⃣ Erro - Senha Fraca
```
Ação:
  1. Preencha Senha: "123456"
  2. Preencha Confirmar: "123456"
  3. Clique "Criar Conta ✓"
  
Esperado:
  - [ ] Toast.error() com "Senha fraca. Mínimo 8 caracteres..."
  - [ ] Não envia formulário
```

#### 5️⃣ Sucesso - Conta Criada
```
Ação:
  1. Preencha Nome: "João da Silva"
  2. Preencha Email: "joao+[timestamp]@teste.com"
  3. Preencha Senha: "Senha@123"
  4. Preencha Confirmar: "Senha@123"
  5. Clique "Criar Conta ✓"
  
Esperado:
  - [ ] Spinner mostra
  - [ ] Toast.success() com "Conta criada! Verifique seu email..."
  - [ ] Após 2 segundos: volta para LOGIN automaticamente
  - [ ] Campos resetam para vazio
```

#### 6️⃣ Voltar para Login
```
Ação:
  1. Na tela SIGNUP
  2. Clique "Já tem conta? Fazer login"
  
Esperado:
  - [ ] Transição suave para LOGIN
  - [ ] Campos removidos: "Nome", "Confirmar Senha"
  - [ ] Botão volta a "Acessar Plataforma →"
  - [ ] Email e outros campos estão vazios (resetados)
```

### Fluxo: RECUPERAR SENHA

#### 1️⃣ Navegar para Reset
```
Ação:
  1. Na tela LOGIN
  2. Clique "Recuperar acesso"
  
Esperado:
  - [ ] Transição suave para RESET
  - [ ] Apenas campo "Email" visível
  - [ ] Botão muda para "Enviar Email 🔑"
  - [ ] Menos campos na tela
```

#### 2️⃣ Erro - Email Vazio
```
Ação:
  1. Deixe email em branco
  2. Clique "Enviar Email 🔑"
  
Esperado:
  - [ ] Toast.error() com "Informe seu email"
```

#### 3️⃣ Erro - Email Inválido
```
Ação:
  1. Preencha: "nao-eh-email"
  2. Clique "Enviar Email 🔑"
  
Esperado:
  - [ ] Toast.error() com "Email inválido. Verifique o formato."
```

#### 4️⃣ Sucesso - Email Enviado
```
Ação:
  1. Preencha Email: "seu@email.com"
  2. Clique "Enviar Email 🔑"
  
Esperado:
  - [ ] Spinner mostra
  - [ ] Toast.success() com "Email de recuperação enviado!..."
  - [ ] Após 3 segundos: volta LOGIN automaticamente
  - [ ] Email está vazio (resetado)
```

#### 5️⃣ Voltar para Login
```
Ação:
  1. Na tela RESET
  2. Clique "Já tem conta? Fazer login"
  
Esperado:
  - [ ] Transição suave para LOGIN
  - [ ] Todos os campos do RESET desaparecem
  - [ ] Email está vazio
```

---

## 🎬 TESTES DE ANIMAÇÕES

### Container Principal
```
Ação:
  1. Abra DevTools (F12)
  2. Desativar cache: Network tab → Disable cache
  3. Hard refresh: Ctrl+Shift+R
  
Esperado (Desktop):
  - [ ] Container aparece com fade-in suave
  - [ ] Container faz slide da direita para esquerda
  - [ ] Duração: ~0.8 segundos
  - [ ] Suave (não brusco)
```

### Logo (Escalonado)
```
Esperado:
  - [ ] Logo aparece com scale-up (pequeno → normal)
  - [ ] Logo tem delay de ~0.2s (começa depois do container)
  - [ ] Duração: ~0.6s
  - [ ] Suave e elegante
```

### Campos (Cascata)
```
Esperado:
  - [ ] Cada campo aparece um após o outro
  - [ ] Email: sem delay (ou 0s em login)
  - [ ] Senha: delay de ~0.1-0.2s
  - [ ] Nome (signup): delay diferente de cada um
  - [ ] Cada um faz slide-up + fade-in
  - [ ] Visual em "cascata" elegante
```

### Botão (Hover/Tap)
```
Desktop:
  1. Hover sobre o botão
  
Esperado:
  - [ ] Botão fica ligeiramente maior (scale +2%)
  - [ ] Instantâneo (sem delay)
  - [ ] Ao sair: volta ao tamanho normal
  
Mobile:
  1. Toque no botão
  
Esperado:
  - [ ] Botão fica um pouco menor (scale -2%)
  - [ ] Feedback visual de clique
  - [ ] Ao soltar: volta ao normal
```

### Spinner de Carregamento
```
Ação:
  1. Clique em um botão que cause carregamento
  2. Observe o spinner enquanto processa
  
Esperado:
  - [ ] Spinner visível ao lado do texto
  - [ ] Rotação contínua e suave
  - [ ] Cor branca (ou cor do botão)
  - [ ] Desaparece quando carregamento termina
```

### Visual Esquerdo (Desktop)
```
Ação:
  1. Hard refresh em desktop (1920x1080)
  2. Observe lado esquerdo
  
Esperado:
  - [ ] Imagem aparece com fade-in
  - [ ] Texto aparece com slide-down
  - [ ] Frase aparece após logo (delay ~0.4s)
  - [ ] Decoração no rodapé aparece com fade-in
```

---

## 🌐 TESTES DE COMPATIBILIDADE

### Navegadores
```
Chrome (Desktop):
  [ ] Abre sem erros no Console
  [ ] Todas animações suaves
  [ ] Responsivo funciona
  
Firefox (Desktop):
  [ ] Abre sem erros
  [ ] Animações funcionam
  [ ] DevTools não bloqueia
  
Safari (Mac/iPad):
  [ ] Abre e funciona
  [ ] Animations GPU-aceleradas
  [ ] Inputs responsivos ao toque
```

### Conexões
```
4G Lenta:
  [ ] Imagem carrega (pode levar 2-3s)
  [ ] Botões funcionam durante carregamento
  [ ] Toast aparecem normalmente
  
3G Muito Lenta:
  [ ] Página carrega (lenta mas funcional)
  [ ] Inputs ficam responsivos
  [ ] Não trava/congela
```

---

## 🔐 TESTES DE SEGURANÇA

### Dados Sensíveis
```
[ ] Não há email em placeholder
[ ] Não há senha em placeholder
[ ] Não há dicas de credenciais
[ ] Não há "Modo Desenvolvimento" visível
[ ] localStorage não expõe credenciais
```

### DevTools Deterrence
```
Ação:
  1. Pressione F12 ou Ctrl+Shift+I
  
Esperado:
  - [ ] DevTools abre (não é bloqueado)
  - [ ] Mensagem no console (se houver)
  - [ ] Funcionalidade não é quebrada
```

---

## 📊 TESTES DE PERFORMANCE

### Bundle Size
```bash
npm run build

Esperado:
  [ ] Bundle: ~1.9 MB
  [ ] Gzipped: ~536 KB
  [ ] Sem aumento significativo
```

### Load Time
```
No DevTools > Network:
  [ ] HTML: < 500ms
  [ ] JS: < 2s
  [ ] Imagem: < 1s (CDN Unsplash)
  [ ] Total: < 4s
```

### Renderização
```
DevTools > Lighthouse:
  [ ] Rodar auditorium
  [ ] Performance: > 85
  [ ] Accessibility: > 90
  [ ] Best Practices: > 90
```

---

## ✅ CHECKLIST FINAL

### Antes do Deploy
- [ ] Todos os testes de responsividade passaram
- [ ] Todos os testes de funcionalidade passaram
- [ ] Animações funcionam suavemente
- [ ] Nenhum elemento de debug visível
- [ ] Build passou sem erros
- [ ] DevTools não têm erros críticos
- [ ] Imagem de fundo carrega
- [ ] Toasts aparecem corretamente
- [ ] Fluxos (login/signup/reset) funcionam
- [ ] Mobile/Tablet/Desktop validados

### Em Cada Navegador
- [ ] Chrome ✅
- [ ] Firefox ✅
- [ ] Safari (se Mac) ✅
- [ ] Edge ✅

### Em Cada Device
- [ ] Desktop (1920x1080) ✅
- [ ] Tablet (768x1024) ✅
- [ ] Mobile (375x667) ✅

---

## 🐛 TROUBLESHOOTING

### Imagem não carrega
```
Solução:
1. Verifique conexão internet
2. Verifique Unsplash CDN está acessível
3. Abra DevTools > Network
4. Procure por "unsplash" request
5. Verifique status (200 ou 404)
```

### Toasts não aparecem
```
Solução:
1. Verifique import { toast } from 'sonner'
2. Verifique Sonner está instalado (npm ls sonner)
3. Abra DevTools > Console
4. Procure por erros relacionados a Sonner
5. Regenere node_modules se necessário
```

### Animações travadas
```
Solução:
1. Desativar DevTools (F12)
2. Fechar abas desnecessárias
3. Hard refresh (Ctrl+Shift+R)
4. Verificar performance em Lighthouse
5. Reduzir efeitos visuais se performance baixa
```

### Layout não responsivo
```
Solução:
1. Abrir DevTools > Device Emulation
2. Mudar breakpoints manualmente
3. Verificar hidden lg:flex está no CSS
4. Verificar w-3/5 e lg:w-2/5 estão presentes
5. Clear browser cache (Ctrl+Shift+Delete)
```

---

## 📝 REGISTRO DE TESTES

Crie uma cópia desta seção e preencha:

```
Data do Teste: ___________
Testador: _________________
Navegador: _______________
Device: ___________________
Sistema Operacional: ______

RESULTADO GERAL:  ☐ PASSOU  ☐ FALHOU

Problemas encontrados:
_____________________________
_____________________________

Comentários:
_____________________________
_____________________________

Assinatura: _________________
```

---

## 🎯 PRÓXIMAS AÇÕES

1. **Se todos testes passarem**:
   ```bash
   git add -A
   git commit -m "test: all LoginView tests passed - ready for production"
   git push origin main
   npm run build  # validação final
   # Deploy no Vercel
   ```

2. **Se encontrou problemas**:
   ```bash
   # Registre o problema acima
   # Abra issue no GitHub com detalhes
   # Descreva steps to reproduce
   # Anexe screenshot se aplicável
   ```

---

**Bom teste! 🧪**

Data: 30 de Janeiro de 2026  
Última atualização: Agora  
Status: ✅ Pronto para Teste
