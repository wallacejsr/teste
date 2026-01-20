
import { GlobalConfig } from '../types';

/**
 * Status Internos Mapeados
 */
export type InternalPaymentStatus = 'pending' | 'paid' | 'failed' | 'canceled';

/**
 * Mercado Pago Integration Service
 * Baseado na API V2 do Mercado Pago
 */
export class MercadoPagoService {
  private static BASE_URL = 'https://api.mercadopago.com/v1';
  private accessToken: string;

  constructor(config: GlobalConfig) {
    if (config.gatewayType !== 'MERCADO_PAGO' || !config.secretKey) {
      throw new Error('Configuração do Mercado Pago inválida ou Access Token ausente.');
    }
    this.accessToken = config.secretKey;
  }

  /**
   * Cria uma intenção de pagamento no Mercado Pago
   * Suporta PIX, Cartão (tokenizado) ou Boleto
   */
  async createPayment(data: {
    transaction_amount: number;
    description: string;
    payment_method_id: 'pix' | 'bolbradesco' | 'master' | 'visa';
    payer: {
      email: string;
      identification?: { type: string; number: string };
    };
    external_reference: string;
  }) {
    try {
      const response = await fetch(`${MercadoPagoService.BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `pay-${Date.now()}` // Idempotência simples para o exemplo
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao criar pagamento no Mercado Pago');
      }

      return await response.json();
    } catch (error) {
      console.error('[MercadoPagoService] Error creating payment:', error);
      throw error;
    }
  }

  /**
   * Consulta o status atual de um pagamento
   */
  async getPaymentStatus(paymentId: string): Promise<InternalPaymentStatus> {
    try {
      const response = await fetch(`${MercadoPagoService.BASE_URL}/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      if (!response.ok) throw new Error('Pagamento não encontrado');

      const data = await response.json();
      return this.mapStatus(data.status);
    } catch (error) {
      console.error('[MercadoPagoService] Error fetching status:', error);
      return 'failed';
    }
  }

  /**
   * Mapeia os status nativos do MP para o padrão do SaaS
   */
  private mapStatus(mpStatus: string): InternalPaymentStatus {
    switch (mpStatus) {
      case 'approved': return 'paid';
      case 'pending':
      case 'in_process': return 'pending';
      case 'rejected': return 'failed';
      case 'cancelled': return 'canceled';
      default: return 'pending';
    }
  }

  /**
   * Lógica para ser usada no endpoint POST /webhooks/mercadopago
   */
  static async handleWebhook(payload: any, signature: string, secret: string) {
    // Nota: Em produção, validar a assinatura usando a biblioteca do MP
    console.log('[MercadoPagoWebhook] Received event:', payload.action);
    
    if (payload.type === 'payment') {
        const paymentId = payload.data.id;
        // 1. Logar evento
        // 2. Chamar getPaymentStatus(paymentId) para confirmar veracidade
        // 3. Atualizar licença do Tenant no banco de dados
        return { success: true, paymentId };
    }
    
    return { success: false };
  }
}
