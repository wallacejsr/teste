/**
 * 📧 EMAIL SERVICE - Sistema de Envio de E-mails
 * 
 * Provider: Resend (https://resend.com)
 * Brand: WSR SOLUÇÕES
 * 
 * Funcionalidades:
 * - Envio de convites de usuários
 * - Templates profissionais com branding customizado
 * - Suporte a multi-tenant
 * - Geração de links de primeiro acesso
 */

import { Resend } from 'resend';

// ⚙️ Configuração do Resend
// INSTRUÇÕES DE SETUP:
// 1. Criar conta em https://resend.com
// 2. Gerar API Key no Dashboard
// 3. Verificar domínio de envio (ou usar onboarding@resend.dev para testes)
// 4. Substituir a API Key abaixo pela sua chave real
const RESEND_API_KEY = (import.meta as any).env?.VITE_RESEND_API_KEY || 're_123456789'; // ⚠️ CONFIGURAR NO .env

const resend = new Resend(RESEND_API_KEY);

// 📧 Configuração do Remetente
const FROM_EMAIL = 'WSR Soluções <onboarding@wsrsolucoes.com.br>'; // Alterar para domínio verificado
const FROM_EMAIL_DEV = 'onboarding@resend.dev'; // Para testes sem domínio verificado

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
 * Gera a URL completa do link de convite
 */
function generateInviteUrl(token: string): string {
  const baseUrl = (import.meta as any).env?.VITE_APP_URL || window.location.origin;
  return `${baseUrl}/?invite=${token}`;
}

/**
 * Template HTML do e-mail de convite
 * Design profissional com branding WSR SOLUÇÕES
 */
function getInviteEmailTemplate(params: SendInviteEmailParams): string {
  const inviteUrl = generateInviteUrl(params.inviteToken);
  const primaryColor = params.primaryColor || '#3b82f6';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite - ${params.tenantName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  
  <!-- Container Principal -->
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Card do E-mail -->
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Header com Cor Primária -->
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 100%); border-radius: 24px 24px 0 0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      🎉 Você foi convidado!
                    </h1>
                    <p style="margin: 8px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.9); font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      WSR SOLUÇÕES · Sistema de Gestão
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Saudação -->
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #1e293b; line-height: 1.6;">
                Olá <strong>${params.toName}</strong>,
              </p>
              
              <!-- Mensagem Principal -->
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                <strong>${params.invitedByName}</strong> convidou você para fazer parte da equipe da empresa 
                <strong style="color: ${primaryColor};">${params.tenantName}</strong> como 
                <strong>${params.role}</strong>.
              </p>
              
              <!-- Instruções -->
              <div style="background-color: #f1f5f9; border-left: 4px solid ${primaryColor}; padding: 20px; border-radius: 8px; margin-bottom: 32px;">
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; font-weight: 600;">
                  📋 Próximos passos:
                </p>
                <ol style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.8;">
                  <li>Clique no botão abaixo para acessar a plataforma</li>
                  <li>Configure sua senha de acesso</li>
                  <li>Comece a gerenciar seus projetos</li>
                </ol>
              </div>
              
              <!-- Botão de Ação -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <a href="${inviteUrl}" 
                       style="display: inline-block; padding: 16px 48px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.4); transition: all 0.3s ease;">
                      🚀 Configurar Minha Conta
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Link Alternativo -->
              <p style="margin: 24px 0 0 0; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.6;">
                Não consegue clicar no botão? Copie e cole este link no seu navegador:<br>
                <a href="${inviteUrl}" style="color: ${primaryColor}; word-break: break-all;">${inviteUrl}</a>
              </p>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 32px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 24px 24px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <!-- Logo/Branding -->
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">
                      WSR SOLUÇÕES
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                      Sistema de Gestão de Construção Civil<br>
                      © 2026 WSR Soluções. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
                
                <!-- Aviso de Segurança -->
                <tr>
                  <td style="padding-top: 20px;">
                    <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 12px;">
                      <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.5;">
                        🔒 <strong>Segurança:</strong> Este convite é pessoal e intransferível. Se você não esperava este e-mail, por favor ignore-o.
                      </p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `.trim();
}

/**
 * Envia e-mail de convite para novo usuário
 * 
 * @param params - Parâmetros do convite
 * @returns Promise com resultado do envio
 */
export async function sendInviteEmail(params: SendInviteEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Validações básicas
    if (!params.toEmail || !params.toName || !params.inviteToken) {
      throw new Error('Parâmetros obrigatórios faltando');
    }

    // Usar e-mail dev se não houver API key configurada
    const fromEmail = RESEND_API_KEY.startsWith('re_') && RESEND_API_KEY.length > 20 
      ? FROM_EMAIL 
      : FROM_EMAIL_DEV;

    // Enviar e-mail via Resend
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: params.toEmail,
      subject: `🎉 Convite para ${params.tenantName} - Configure seu Acesso`,
      html: getInviteEmailTemplate(params),
    });

    if (error) {
      console.error('[EmailService] Erro ao enviar e-mail:', error);
      return { success: false, error: error.message };
    }

    console.log('[EmailService] E-mail enviado com sucesso:', {
      id: data?.id,
      to: params.toEmail,
      tenant: params.tenantName,
    });

    return { success: true };

  } catch (error: any) {
    console.error('[EmailService] Erro crítico no envio:', error);
    return { 
      success: false, 
      error: error.message || 'Erro desconhecido ao enviar e-mail' 
    };
  }
}

/**
 * Envia e-mail de redefinição de senha (futuro)
 */
export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Implementar template de reset de senha
  console.log('[EmailService] Reset de senha ainda não implementado');
  return { success: false, error: 'Funcionalidade não implementada' };
}

export const emailService = {
  sendInviteEmail,
  sendPasswordResetEmail,
};

export default emailService;
