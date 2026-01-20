# 🎨 ARQUITETURA CSS DO MVP

## 📋 Resumo: Qual Arquivo Controla o CSS?

Seu MVP usa uma **arquitetura CSS de 3 camadas**:

---

## 1️⃣ **Tailwind CSS (CDN)**
**Arquivo:** `index.html` - Linha 10
```html
<script src="https://cdn.tailwindcss.com"></script>
```

**O que é:** 
- Framework de CSS utility-first
- Carregado via CDN (não precisa de build local)
- Versão mais recente: sempre atualizada

**Como usar:**
```tsx
<div className="flex items-center gap-4 p-6 bg-slate-50 rounded-lg">
  {/* Tailwind classes: flex, items-center, gap-4, p-6, bg-slate-50, rounded-lg */}
</div>
```

---

## 2️⃣ **Estilos Globais (index.html)**
**Arquivo:** `index.html` - Linhas 12-22
```html
<style>
  body { 
    font-family: 'Inter', sans-serif; 
    background-color: #f8fafc;
    overflow: hidden;
  }
  /* Custom scrollbar for glass containers */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }

  /* Scrollbar hide utility */
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
```

**Controla:**
- Font da aplicação: **Inter**
- Cor de fundo: **#f8fafc** (slate-50)
- Scrollbar customizado
- Utilidades globais (`.scrollbar-hide`)

---

## 3️⃣ **CSS Externo (Não Encontrado - Para Criar)**
**Caminho:** `/index.css` (referenciado mas não existe)
```html
<link rel="stylesheet" href="/index.css">
```

**Status:** ❌ Não existe atualmente
**Uso:** Poderia conter estilos adicionais customizados

---

## 🏗️ Estrutura Visual

```
index.html (CSS Global)
    ↓
Tailwind CDN (Classes Utility)
    ↓
React Components (className="...")
    ↓
Renderização Final
```

---

## 🎯 Como Adicionar Novos Estilos

### Opção 1: Tailwind (Recomendado)
```tsx
// Em qualquer componente
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
  Clique aqui
</button>
```

### Opção 2: Estilos Globais
Editar `<style>` em `index.html`:
```html
<style>
  .meu-componente {
    color: red;
    font-size: 16px;
  }
</style>
```

### Opção 3: CSS Externo (Criar)
1. Criar arquivo `/index.css`
2. Adicionar estilos
3. Importar em `index.html` (já está referenciado)

---

## 📊 Fontes Carregadas

**Arquivo:** `index.html` - Linha 9
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

**Font:** Inter (Google Fonts)
- Pesos disponíveis: 300, 400, 500, 600, 700, 800, 900
- Perfeita para UI moderna

---

## 🔧 Personalização

### Cores Customizadas
Se precisar de cores fora do Tailwind, adicione em `index.html`:
```html
<style>
  :root {
    --cor-primaria: #2563eb;
    --cor-secundaria: #64748b;
  }
</style>
```

### Estilos Específicos
Adicione classes em `index.html` ou crie `index.css`:
```css
.gantt-bar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
```

---

## 📈 Stack CSS Atual

| Tecnologia | Status | Localização |
|-----------|--------|------------|
| Tailwind CSS | ✅ Ativo | CDN (index.html) |
| Font | ✅ Ativo | Google Fonts (index.html) |
| Estilos Globais | ✅ Ativo | `<style>` (index.html) |
| CSS Externo | ❌ Não existe | `/index.css` (vazio) |

---

## 🚀 Recomendações

### Para Manutenção Atual
- Use **Tailwind classes** para 95% dos estilos
- Estilos globais ficam em `index.html`
- Mantenha tudo centralizado

### Para Escalabilidade Futura
- Criar `index.css` com estilos customizados
- Mover `<style>` para `index.css`
- Considerar CSS Modules se crescer muito

---

## 💡 Exemplo Prático

### Adicionar Novo Estilo Customizado

**Em index.html:**
```html
<style>
  /* ... estilos existentes ... */
  
  /* Novo estilo */
  .card-gantt {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
</style>
```

**Usar no componente:**
```tsx
<div className="card-gantt p-6 bg-white">
  Conteúdo
</div>
```

---

## 📝 Resumo Resposta Rápida

**Qual arquivo controla o CSS?**

✅ **Principal:** `index.html` (estilos globais + Tailwind)
✅ **Framework:** Tailwind CSS via CDN
✅ **Font:** Inter do Google Fonts
⚠️ **CSS Externo:** `/index.css` (referenciado mas vazio)

**Tudo é controlado por `index.html`!**
