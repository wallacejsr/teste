/**
 * 📧 SUPABASE EDGE FUNCTION - Send Invite Email
 * 
 * Envia e-mails de convite usando Resend API
 * Executa no servidor (Deno runtime) para:
 * - ✅ Evitar CORS
 * - 🔒 Proteger API keys (secrets do Supabase)
 * - ⚡ Performance (edge computing)
 * 
 * 🔓 CONFIGURAÇÃO: Função PÚBLICA (sem validação JWT)
 * Esta função não valida tokens JWT pois o convite é enviado
 * antes do usuário ter uma conta. A segurança é feita no frontend
 * validando permissões do usuário que envia o convite.
 * 
 * Deploy:
 * supabase functions deploy send-invite-email --no-verify-jwt
 * supabase secrets set RESEND_API_KEY=re_sua_chave_aqui
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// 🔒 Configuração de e-mail
const FROM_EMAIL = 'WSR Soluções <onboarding@wsrsolucoes.com.br>';
const FROM_EMAIL_DEV = 'onboarding@resend.dev';

interface InviteEmailRequest {
  toEmail: string;
  toName: string;
  inviteToken: string;
  tenantName: string;
  role: string;
  invitedByName: string;
  primaryColor?: string;
  appUrl?: string;
}

/**
 * Gera a URL completa do link de convite
 */
function generateInviteUrl(token: string, appUrl?: string): string {
  const baseUrl = appUrl || 'http://localhost:5173';
  return `${baseUrl}/?invite=${token}`;
}

/**
 * Template HTML do e-mail de convite
 */
function getInviteEmailTemplate(params: InviteEmailRequest): string {
  const inviteUrl = generateInviteUrl(params.inviteToken, params.appUrl);
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
  
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
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
          
          <tr>
            <td style="padding: 40px;">
              
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #1e293b; line-height: 1.6;">
                Olá <strong>${params.toName}</strong>,
              </p>
              
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569; line-height: 1.6;">
                <strong>${params.invitedByName}</strong> convidou você para fazer parte da equipe da empresa 
                <strong style="color: ${primaryColor};">${params.tenantName}</strong> como 
                <strong>${params.role}</strong>.
              </p>
              
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
              
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 24px 0;">
                    <a href="${inviteUrl}" 
                       style="display: inline-block; padding: 16px 48px; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.4);">
                      🚀 Configurar Minha Conta
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; font-size: 13px; color: #94a3b8; text-align: center; line-height: 1.6;">
                Não consegue clicar no botão? Copie e cole este link no seu navegador:<br>
                <a href="${inviteUrl}" style="color: ${primaryColor}; word-break: break-all;">${inviteUrl}</a>
              </p>
              
            </td>
          </tr>
          
          <tr>
            <td style="padding: 32px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 24px 24px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">
                      WSR SOLUÇÕES
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.6;">
                      Sistema de Gestão de Construção Civil<br>
                      © 2026 WSR Soluções. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
                
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
 * Envia e-mail via Resend API
 */
async function sendEmailViaResend(params: InviteEmailRequest): Promise<{ success: boolean; error?: string }> {
  try {
    // 🐛 DEBUG: Log do payload recebido
    console.log('[DEBUG] Payload recebido:', {
      toEmail: params.toEmail,
      toName: params.toName,
      tenantName: params.tenantName,
      role: params.role,
      hasToken: !!params.inviteToken,
    });

    // Validar API key
    const apiKey = Deno.env.get('RESEND_API_KEY');
    console.log('[DEBUG] RESEND_API_KEY configurada:', !!apiKey);
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('RESEND_API_KEY não configurada nos secrets do Supabase');
    }

    // 🔒 HOTFIX: Blindagem definitiva de e-mail (null/undefined → string)
    const cleanEmail = String(params.toEmail || '').trim().toLowerCase();
    console.log('[DEBUG] E-mail limpo:', cleanEmail);
    
    if (!cleanEmail || cleanEmail === '') {
      throw new Error('E-mail do destinatário inválido ou vazio');
    }

    // Validar formato de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Formato de e-mail inválido');
    }

    // 🔧 HOTFIX: Forçar uso de onboarding@resend.dev (domínio não verificado)
    const fromEmail = FROM_EMAIL_DEV;
    console.log('[DEBUG] Usando remetente:', fromEmail);

    // Chamar API do Resend
    console.log('[DEBUG] Chamando Resend API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: cleanEmail,
        subject: `🎉 Convite para ${params.tenantName} - Configure seu Acesso`,
        html: getInviteEmailTemplate(params),
      }),
    });

    console.log('[DEBUG] Resend status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Erro ao parsear resposta' }));
      console.error('[DEBUG] Resend error:', errorData);
      throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('[SendInviteEmail] ✅ E-mail enviado com sucesso:', {
      id: data.id,
      to: cleanEmail,
      tenant: params.tenantName,
    });

    return { success: true };

  } catch (error: any) {
    console.error('[SendInviteEmail] Erro ao enviar e-mail:', error);
    return { 
      success: false, 
      error: error.message || 'Erro desconhecido ao enviar e-mail' 
    };
  }
}

/**
 * Handler principal da Edge Function
 */
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body: InviteEmailRequest = await req.json();
    
    // 🐛 DEBUG: Log do payload completo
    console.log('[DEBUG] Payload recebido no handler:', JSON.stringify(body, null, 2));

    // Validações básicas
    if (!body.toEmail || !body.toName || !body.inviteToken) {
      console.error('[DEBUG] Validação falhou - campos obrigatórios faltando');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Parâmetros obrigatórios faltando (toEmail, toName, inviteToken)' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[DEBUG] Validações OK, enviando e-mail...');
    
    // Enviar e-mail
    const result = await sendEmailViaResend(body);
    
    console.log('[DEBUG] Resultado do envio:', result);

    // Retornar resultado
    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[SendInviteEmail] ❌ Erro crítico:', error);
    console.error('[DEBUG] Stack trace:', error.stack);
    
    // Garantir retorno JSON em todos os casos
    const errorMessage = error?.message || String(error) || 'Erro interno do servidor';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
