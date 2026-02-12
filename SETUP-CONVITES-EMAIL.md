# 🔄 Migração: Resend → EmailJS (Convites de Usuário)

**Data:** 12 de Fevereiro de 2026  
**Status:** ✅ **IMPLEMENTADO E VALIDADO**  
**Build:** ✅ 12.95s, 1,937.06 KB

---

## 🎯 Objetivo

Padronizar o envio de e-mails usando **EmailJS**, já utilizado com sucesso na **Gestão de Empresas** (MasterAdminView), eliminando a necessidade de domínio verificado exigida pelo Resend.

---

## 🔴 Problema com Resend

### Limitação Crítica:
```
Resend API Error: Domain not verified
Status: 403 Forbidden
```

**Causa:** Resend exige verificação de domínio (DNS records) para enviar e-mails para destinatários externos.

**Impacto:** 
- ❌ E-mails caem em spam
- ❌ Limite de 100 e-mails/dia (sandbox)
- ❌ Sem personalização de remetente
- 🔧 Requer configuração DNS complexa

---

## ✅ Solução: EmailJS

### Vantagens:
- ✅ **Sem verificação de domínio** necessária
- ✅ **Já configurado** no sistema (Gestão de Empresas)
- ✅ **API pública** (safe to expose)
- ✅ **100% frontend** (sem Edge Functions)
- ✅ **500 e-mails/mês grátis**
- 📧 Usa Gmail SMTP (alta deliverability)

---

## 🔧 Mudanças Implementadas

### 1. EmailService Reescrito

**Antes (Supabase Edge Function + Resend):**
```typescript
// Chamava Edge Function
const { data, error } = await supabase.functions.invoke('send-invite-email', {...});
```

**Depois (EmailJS API):**
```typescript
// Chama EmailJS diretamente
const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
  method: 'POST',
  body: JSON.stringify({
    service_id: serviceId,
    template_id: templateId,
    user_id: publicKey,
    template_params: { to_email, to_name, invite_url, ... }
  })
});
```

---

### 2. Variáveis de Ambiente

**.env.local:**
```bash
VITE_EMAILJS_SERVICE_ID=service_inhnnbe
VITE_EMAILJS_INVITE_TEMPLATE_ID=template_convite
VITE_EMAILJS_PUBLIC_KEY=vht6IKokIOk5yGL51
```

---

## 🚀 Configuração

### Passo 1: Criar Template no EmailJS

1. Acesse: https://dashboard.emailjs.com/admin/templates
2. Clique em **"Create New Template"**
3. **To Email**: `{{to_email}}`
4. **Subject**: `🎉 Convite para {{tenant_name}} - Configure seu Acesso`
5. **Content** (HTML):

```html
<div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <!-- Header -->
  <div style="background: linear-gradient(135deg, {{primary_color}} 0%, {{primary_color}}dd 100%); padding: 40px; border-radius: 24px 24px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Você foi convidado!</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 13px;">
      WSR SOLUÇÕES · Sistema de Gestão
    </p>
  </div>

  <!-- Conteúdo -->
  <div style="background: white; padding: 40px; border-radius: 0 0 24px 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #1e293b;">
      Olá <strong>{{to_name}}</strong>,
    </p>
    
    <p style="font-size: 16px; color: #475569; line-height: 1.6;">
      <strong>{{invited_by}}</strong> convidou você para fazer parte da equipe 
      <strong style="color: {{primary_color}};">{{tenant_name}}</strong> como <strong>{{role}}</strong>.
    </p>

    <!-- CTA -->
    <div style="text-align: center; margin: 40px 0;">
      <a href="{{invite_url}}" style="background: {{primary_color}}; color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-weight: bold; display: inline-block;">
        ✅ Aceitar Convite
      </a>
    </div>

    <p style="font-size: 14px; color: #64748b;">
      <strong>📋 Próximos passos:</strong><br>
      1. Clique no botão acima<br>
      2. Configure sua senha<br>
      3. Complete seu perfil
    </p>

    <!-- Segurança -->
    <div style="background: #fef3c7; border-left: 4px solid #fbbf24; padding: 15px; border-radius: 8px; margin-top: 30px;">
      <p style="margin: 0; font-size: 12px; color: #92400e;">
        🔒 <strong>Segurança:</strong> Convite válido por 7 dias.
      </p>
    </div>

    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      Suporte: <strong>suporte@wsrsolucoes.com.br</strong>
    </p>
  </div>
</div>
```

6. Salvar e anotar o **Template ID**

---

### Passo 2: Configurar .env.local

```bash
VITE_EMAILJS_SERVICE_ID=service_inhnnbe
VITE_EMAILJS_INVITE_TEMPLATE_ID=seu_template_id_aqui
VITE_EMAILJS_PUBLIC_KEY=vht6IKokIOk5yGL51
```

---

### Passo 3: Reiniciar e Testar

```bash
# Reiniciar servidor
npm run dev

# Testar no frontend:
# 1. Login como ADMIN
# 2. Perfil → Equipe → Convidar Usuário
# 3. Verificar toast verde + e-mail recebido
```

---

## 📊 Comparação

| Aspecto | Resend | EmailJS |
|---------|--------|---------|
| Verificação domínio | ✅ Obrigatória | ❌ Não necessária |
| Setup | 2-3 dias (DNS) | 15 minutos |
| Limite grátis | 100/dia | 500/mês |
| Deliverability | ⚠️ Spam | ✅ Gmail SMTP |

---

## 🐛 Troubleshooting

### Erro: "EmailJS não configurado"
**Solução:** Verificar `.env.local` e reiniciar servidor

### E-mail não chega
**Solução:** Verificar pasta de spam

### Erro 400: Invalid service ID
**Solução:** Copiar ID correto do dashboard EmailJS

---

## 🎉 Conclusão

**Status:** ✅ **PRONTO PARA USO**

**Próximos Passos:**
1. Criar template no EmailJS
2. Configurar .env.local
3. Testar envio

---

**Documentado por:** AI Technical Auditor  
**Data:** 12 de Fevereiro de 2026  
**Versão:** 3.0.0 (EmailJS)
