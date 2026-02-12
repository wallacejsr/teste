/**
 * 📧 EMAIL SERVICE - Sistema de Envio de E-mails
 * 
 * ✅ MIGRADO PARA SUPABASE EDGE FUNCTIONS
 * 
 * Arquitetura:
 * - Frontend (este arquivo): Chama Supabase Edge Function
 * - Backend (Edge Function): Integra com Resend API
 * 
 * Benefícios:
 * - 🔒 API keys protegidas (secrets do Supabase)
 * - ✅ Sem problemas de CORS
 * - ⚡ Performance (edge computing)
 * - 🛡️ Segurança (chaves nunca expostas no frontend)
 * 
 * Deploy:
 * supabase functions deploy send-invite-email
 * supabase secrets set RESEND_API_KEY=re_sua_chave_aqui
 */

import { getSupabaseClient } from './supabaseClient';

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
 * ✅ NOVA IMPLEMENTAÇÃO: Chama Supabase Edge Function
 * - Sem problemas de CORS
 * - API keys protegidas no servidor
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

    // Obter cliente Supabase
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Credenciais do Supabase não configuradas');
    }
    
    const supabase = getSupabaseClient(supabaseUrl, supabaseKey);

    // 🚀 Chamar Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('send-invite-email', {
      body: {
        toEmail: cleanEmail,
        toName: params.toName.trim(),
        inviteToken: params.inviteToken,
        tenantName: params.tenantName || 'Sistema',
        role: params.role || 'USUARIO',
        invitedByName: params.invitedByName || 'Administrador',
        primaryColor: params.primaryColor || '#3b82f6',
        appUrl: window.location.origin, // URL da aplicação atual
      },
    });

    if (error) {
      return { 
        success: false, 
        error: error.message || 'Erro ao chamar função de envio de e-mail' 
      };
    }

    // Verificar resposta da função
    if (data && !data.success) {
      return { 
        success: false, 
        error: data.error || 'Erro desconhecido no envio de e-mail' 
      };
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
 * TODO: Implementar Edge Function separada para reset de senha
 */
export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: 'Funcionalidade não implementada' };
}

export const emailService = {
  sendInviteEmail,
  sendPasswordResetEmail,
};

export default emailService;
