/**
 * Logger Condicional - Previne vazamento de dados sensíveis em produção
 * 
 * EM DESENVOLVIMENTO: Loga tudo no console
 * EM PRODUÇÃO: Apenas errors e warnings
 * 
 * Uso:
 * ```typescript
 * import { logger } from '@/services/logger';
 * 
 * logger.log('Usuário carregado:', user);  // Apenas em dev
 * logger.error('Erro crítico:', error);    // Sempre loga
 * ```
 */

const isProduction = import.meta.env.PROD;
const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log informativo (apenas desenvolvimento)
   * Não aparece em produção para prevenir vazamento de dados
   */
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  /**
   * Log de debug (apenas desenvolvimento)
   * Útil para troubleshooting sem poluir produção
   */
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  /**
   * Warning (sempre loga)
   * Alertas importantes devem ser visíveis em produção
   */
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  /**
   * Error (sempre loga)
   * Erros SEMPRE devem ser logados para monitoramento
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Info (apenas desenvolvimento)
   * Informações contextuais que não são críticas
   */
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  /**
   * Table (apenas desenvolvimento)
   * Útil para visualizar arrays/objetos em formato tabular
   */
  table: (data: any) => {
    if (isDevelopment && console.table) {
      console.table(data);
    }
  },

  /**
   * Group (apenas desenvolvimento)
   * Agrupa logs relacionados
   */
  group: (label: string) => {
    if (isDevelopment && console.group) {
      console.group(label);
    }
  },

  /**
   * Group End (apenas desenvolvimento)
   */
  groupEnd: () => {
    if (isDevelopment && console.groupEnd) {
      console.groupEnd();
    }
  },

  /**
   * Time/TimeEnd (apenas desenvolvimento)
   * Mede tempo de execução
   */
  time: (label: string) => {
    if (isDevelopment && console.time) {
      console.time(label);
    }
  },

  timeEnd: (label: string) => {
    if (isDevelopment && console.timeEnd) {
      console.timeEnd(label);
    }
  }
};

/**
 * Helper para formatar dados sensíveis em logs
 * Remove propriedades sensíveis antes de logar
 */
export function sanitizeForLog<T extends Record<string, any>>(
  obj: T,
  sensitiveKeys: string[] = ['password', 'token', 'jwt', 'secret', 'apiKey']
): Partial<T> {
  const sanitized: any = { ...obj };
  
  sensitiveKeys.forEach(key => {
    if (key in sanitized) {
      sanitized[key] = '***REDACTED***';
    }
  });
  
  return sanitized;
}

/**
 * Helper para logar objetos grandes de forma resumida
 */
export function logSummary(label: string, data: any[]) {
  if (isDevelopment) {
    console.log(`${label}: ${data.length} items`, {
      first: data[0],
      last: data[data.length - 1],
      total: data.length
    });
  }
}
