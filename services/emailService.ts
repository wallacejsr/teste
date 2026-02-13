/**
 * 📧 EMAIL SERVICE - Sistema de Envio de E-mails
 * 
 * ✅ MIGRADO PARA EMAILJS (Padronização com Gestão de Empresas)
 * 
 * Arquitetura:
 * - Frontend: Chama EmailJS API diretamente
 * - Backend: EmailJS cuida do disparo (sem Edge Function necessária)
 * 
 * Benefícios:
 * - ✅ Sem necessidade de domínio verificado
 * - ✅ Mesmo padrão usado na Gestão de Empresas
 * - ✅ API keys públicas (safe to expose)
 * - 🎯 100% frontend (sem servidor)
 * 
 * Configuração:
 * - VITE_EMAILJS_SERVICE_ID
 * - VITE_EMAILJS_TEMPLATE_ID (criar template de convite)
 * - VITE_EMAILJS_PUBLIC_KEY
 */

interface SendInviteEmailParams {
  toEmail: string;
  toName: string;
  inviteToken: string;
  tenantName: string;
  role: string;
  invitedByName: string;
  primaryColor?: string;
}

/**
 * Envia e-mail de convite para novo usuário
 * 
 * ✅ NOVA IMPLEMENTAÇÃO: EmailJS API (mesmo padrão da Gestão de Empresas)
 * - Sem necessidade de domínio verificado
 * - Sem problemas de CORS
 * - Validações robustas
 * 
 * @param params - Parâmetros do convite
 * @returns Promise com resultado do envio
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // 🔒 HOTFIX: Blindagem definitiva de e-mail (null/undefined → string)
    const cleanEmail = String(params.toEmail || '').trim().toLowerCase();
    
    if (!cleanEmail || cleanEmail === '') {
      throw new Error('E-mail do destinatário inválido ou vazio');
    }
    
    if (!params.toName || typeof params.toName !== 'string' || params.toName.trim() === '') {
      throw new Error('Nome do destinatário inválido ou vazio');
    }
    
    if (!params.inviteToken || typeof params.inviteToken !== 'string' || params.inviteToken.trim() === '') {
      throw new Error('Token de convite inválido ou vazio');
    }
    
    // Validar formato básico de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Formato de e-mail inválido');
    }

    // 📧 Configuração do EmailJS
    const serviceId = (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || '';
    const templateId = (import.meta as any).env?.VITE_EMAILJS_INVITE_TEMPLATE_ID || 
                       (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || ''; // Fallback para template padrão
    const publicKey = (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || '';
    
    if (!serviceId || !templateId || !publicKey) {
      throw new Error('EmailJS não configurado - verifique variáveis de ambiente');
    }

    // 🔗 Gerar URL de convite
    // ✅ HOTFIX: Usar parâmetro 'token' para consistência com banco de dados
    const inviteUrl = `${window.location.origin}/?token=${params.inviteToken}`;
    const primaryColor = params.primaryColor || '#3b82f6';

    // 📋 Preparar dados do template EmailJS
    const templateParams = {
      to_email: cleanEmail,
      to_name: params.toName,
      tenant_name: params.tenantName || 'Sistema',
      role: params.role || 'USUARIO',
      invited_by: params.invitedByName || 'Administrador',
      invite_url: inviteUrl,
      primary_color: primaryColor,
      app_url: window.location.origin,
    };

    // 🚀 Chamar API do EmailJS
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: templateParams
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Erro desconhecido');
      throw new Error(`EmailJS API error: ${response.status} - ${errorText}`);
    }

    return { success: true };

  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Erro desconhecido ao enviar e-mail' 
    };
  }
}

/**
 * Envia e-mail de redefinição de senha (futuro)
 * 
 * TODO: Implementar com EmailJS usando template específico
 */
export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Funcionalidade não implementada' };
}

export const emailService = {
  sendInviteEmail,
  sendPasswordResetEmail,
};

export default emailService;
