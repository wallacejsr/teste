// ================================================
// TENANT GUARD MIDDLEWARE - PILAR 2 SEGURANÇA
// ================================================
// Arquivo: src/middleware/tenantGuard.ts
// Propósito: Validar tenant_id e forçar logout se houver discrepância
// Segurança: Impede roubo/manipulação de tokens entre tenants
// Data: 2026-01-22
// ================================================

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Interface para usuário validado
 */
export interface ValidatedUser {
  id: string;
  email: string;
  tenantId: string;
  role: 'ADMIN' | 'GESTOR' | 'LEITURA' | 'OPERACIONAL';
  ativo: boolean;
  isValid: boolean;
  reason?: string;
}

/**
 * Interface para resultado da validação
 */
export interface TenantValidationResult {
  isValid: boolean;
  user?: ValidatedUser;
  error?: string;
  shouldLogout?: boolean;
}

// ================================================
// CLASSE PRINCIPAL: TENANT GUARD
// ================================================

export class TenantGuard {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Validar usuário autenticado contra JWT e banco de dados
   * CRÍTICO: Executado a cada mudança de usuário ou sessão
   */
  async validateCurrentUser(): Promise<TenantValidationResult> {
    try {
      // 1. Obter usuário atual do Supabase Auth
      const {
        data: { user: authUser },
        error: authError,
      } = await this.supabase.auth.getUser();

      if (authError || !authUser) {
        return {
          isValid: false,
          error: 'Usuário não autenticado',
          shouldLogout: true,
        };
      }

      // 2. Extrair tenant_id do JWT
      const jwtTenantId = this.extractTenantIdFromJWT(authUser.user_metadata);

      if (!jwtTenantId) {
        console.error(
          '🔴 SEGURANÇA: JWT não contém tenant_id. Força logout.',
          { userId: authUser.id }
        );
        return {
          isValid: false,
          error: 'JWT não contém tenant_id válido',
          shouldLogout: true,
        };
      }

      // 3. Buscar usuário no banco de dados
      const { data: dbUser, error: dbError } = await this.supabase
        .from('users')
        .select('id, email, tenant_id, role, ativo')
        .eq('id', authUser.id)
        .single();

      if (dbError || !dbUser) {
        console.error(
          '🔴 SEGURANÇA: Usuário não encontrado no banco. Força logout.',
          { userId: authUser.id, error: dbError }
        );
        return {
          isValid: false,
          error: 'Usuário não encontrado no banco de dados',
          shouldLogout: true,
        };
      }

      // 4. CRÍTICO: Validar que tenant_id do JWT corresponde ao banco
      if (dbUser.tenant_id !== jwtTenantId) {
        console.error(
          '🔴 SEGURANÇA: Tenant_id mismatch! JWT != DB. POSSÍVEL ATAQUE.',
          {
            userId: authUser.id,
            jwtTenantId,
            dbTenantId: dbUser.tenant_id,
          }
        );
        // Alertar e fazer logout
        this.logSecurityEvent('TENANT_MISMATCH_DETECTED', authUser.id, {
          jwtTenantId,
          dbTenantId: dbUser.tenant_id,
        });
        return {
          isValid: false,
          error: 'Tenant mismatch detectado. Token pode estar comprometido.',
          shouldLogout: true,
        };
      }

      // 5. Validar que usuário está ativo
      if (!dbUser.ativo) {
        console.warn('⚠️  Usuário inativo. Força logout.', {
          userId: authUser.id,
        });
        return {
          isValid: false,
          error: 'Usuário inativo',
          shouldLogout: true,
        };
      }

      // 6. SUCESSO: Usuário é válido
      console.log('✅ Usuário validado com sucesso', {
        userId: authUser.id,
        tenantId: dbUser.tenant_id,
        role: dbUser.role,
      });

      return {
        isValid: true,
        user: {
          id: dbUser.id,
          email: authUser.email || '',
          tenantId: dbUser.tenant_id,
          role: dbUser.role,
          ativo: dbUser.ativo,
          isValid: true,
        },
      };
    } catch (error) {
      console.error('❌ Erro ao validar usuário:', error);
      return {
        isValid: false,
        error: 'Erro ao validar usuário',
        shouldLogout: true,
      };
    }
  }

  /**
   * Validar que operação está sendo feita no tenant correto
   * IMPORTANTE: Usar antes de criar/atualizar/deletar dados críticos
   */
  async validateTenantOperation(
    operationTenantId: string,
    operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SELECT'
  ): Promise<TenantValidationResult> {
    try {
      // 1. Validar usuário primeiro
      const userValidation = await this.validateCurrentUser();
      if (!userValidation.isValid || !userValidation.user) {
        return userValidation;
      }

      const { user } = userValidation;

      // 2. Verificar que a operação é no tenant do usuário
      if (operationTenantId !== user.tenantId) {
        console.error(
          '🔴 SEGURANÇA: Tentativa de acessar tenant diferente!',
          {
            userId: user.id,
            userTenantId: user.tenantId,
            operationTenantId,
            operationType,
          }
        );

        this.logSecurityEvent('CROSS_TENANT_ACCESS_ATTEMPT', user.id, {
          userTenantId: user.tenantId,
          operationTenantId,
          operationType,
        });

        return {
          isValid: false,
          error: 'Tentativa de acessar dados de outro tenant detectada',
          shouldLogout: true,
        };
      }

      // 3. Validar permissões por tipo de operação
      const canPerform = this.validatePermission(user.role, operationType);
      if (!canPerform) {
        console.warn(
          '⚠️  Usuário sem permissão para operação:',
          { userId: user.id, role: user.role, operation: operationType }
        );
        return {
          isValid: false,
          error: `Permissão negada para operação ${operationType}`,
        };
      }

      console.log('✅ Operação de tenant validada', {
        userId: user.id,
        tenantId: user.tenantId,
        operation: operationType,
      });

      return { isValid: true, user };
    } catch (error) {
      console.error('❌ Erro ao validar operação de tenant:', error);
      return {
        isValid: false,
        error: 'Erro ao validar operação',
      };
    }
  }

  /**
   * Extrair tenant_id do JWT (user_metadata)
   * IMPORTANTE: O tenant_id DEVE estar no JWT para RLS funcionar
   */
  private extractTenantIdFromJWT(userMetadata: Record<string, any>): string | null {
    if (!userMetadata) return null;

    // Tentar múltiplas localizações possíveis
    return (
      userMetadata.tenant_id ||
      userMetadata.tenantId ||
      userMetadata.tenant ||
      userMetadata.organizationId ||
      null
    );
  }

  /**
   * Validar se a role tem permissão para a operação
   */
  private validatePermission(
    role: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'SELECT'
  ): boolean {
    const permissions: Record<string, string[]> = {
      ADMIN: ['SELECT', 'CREATE', 'UPDATE', 'DELETE'],
      GESTOR: ['SELECT', 'CREATE', 'UPDATE', 'DELETE'],
      OPERACIONAL: ['SELECT', 'CREATE', 'UPDATE'],
      LEITURA: ['SELECT'],
    };

    return permissions[role]?.includes(operation) ?? false;
  }

  /**
   * Fazer logout seguro
   */
  async forceLogout(reason: string = 'Logout forçado pelo sistema'): Promise<void> {
    console.warn('🚪 Forçando logout:', reason);

    try {
      await this.supabase.auth.signOut();
      // Limpar localStorage
      localStorage.clear();
      // Redirecionar para login
      window.location.href = '/login';
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Fallback: redirecionar mesmo assim
      window.location.href = '/login';
    }
  }

  /**
   * Registrar evento de segurança para auditoria
   */
  private async logSecurityEvent(
    eventType: string,
    userId: string,
    details: Record<string, any>
  ): Promise<void> {
    try {
      // TODO: Implementar tabela de auditoria
      console.log(`[AUDIT] ${eventType}:`, { userId, ...details });

      // Opcionalmente, enviar para sistema de logging
      if (process.env.REACT_APP_LOG_ENDPOINT) {
        await fetch(process.env.REACT_APP_LOG_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            eventType,
            userId,
            details,
          }),
        }).catch(err => console.error('Erro ao registrar log:', err));
      }
    } catch (error) {
      console.error('Erro ao registrar evento de segurança:', error);
    }
  }

  /**
   * Monitorar sessão contínuamente
   * CRÍTICO: Executar periodicamente (ex: a cada 30 segundos)
   */
  async monitorSession(
    onMismatch?: () => void
  ): Promise<void> {
    const validation = await this.validateCurrentUser();

    if (!validation.isValid && validation.shouldLogout) {
      console.error('🔴 Sessão inválida detectada. Realizando logout.');
      onMismatch?.();
      await this.forceLogout(
        validation.error || 'Sessão inválida'
      );
    }
  }
}

// ================================================
// HOOKS REACT PARA USO SIMPLIFICADO
// ================================================

/**
 * Hook customizado: useTenantGuard
 * Uso no componente:
 *   const tenantGuard = useTenantGuard();
 *   useEffect(() => {
 *     tenantGuard.validateCurrentUser().then(result => {
 *       if (!result.isValid && result.shouldLogout) {
 *         tenantGuard.forceLogout();
 *       }
 *     });
 *   }, []);
 */
export function useTenantGuard(supabase: SupabaseClient): TenantGuard {
  return new TenantGuard(supabase);
}

// ================================================
// EXEMPLO DE INTEGRAÇÃO NO APP.TSX
// ================================================

/*
// App.tsx

import { useTenantGuard } from './middleware/tenantGuard';

function App() {
  const [supabase] = useState(() => getSupabaseClient(...));
  const tenantGuard = useTenantGuard(supabase);

  useEffect(() => {
    // Validar sessão ao montar componente
    const validateSession = async () => {
      const result = await tenantGuard.validateCurrentUser();
      if (!result.isValid && result.shouldLogout) {
        await tenantGuard.forceLogout(result.error);
      }
    };

    validateSession();

    // Monitorar sessão a cada 30 segundos
    const monitor = setInterval(() => {
      tenantGuard.monitorSession();
    }, 30000);

    return () => clearInterval(monitor);
  }, [tenantGuard]);

  return (
    <div>
      {currentUser ? (
        <MainApp />
      ) : (
        <LoginView />
      )}
    </div>
  );
}
*/

// ================================================
// TESTE DE SEGURANÇA
// ================================================

/**
 * Função para testar isolamento de tenant
 * Execução: No console do navegador durante testes
 */
export async function testTenantIsolation(supabase: SupabaseClient): Promise<void> {
  const tenantGuard = new TenantGuard(supabase);

  console.group('🔒 TESTE DE ISOLAMENTO DE TENANT');

  // Teste 1: Validar usuário
  console.log('\n[TESTE 1] Validando usuário...');
  const userValidation = await tenantGuard.validateCurrentUser();
  console.log('Resultado:', userValidation);

  if (userValidation.isValid && userValidation.user) {
    const { user } = userValidation;

    // Teste 2: Validar operação no tenant correto
    console.log('\n[TESTE 2] Validando operação no tenant correto...');
    const correctOp = await tenantGuard.validateTenantOperation(
      user.tenantId,
      'SELECT'
    );
    console.log('Resultado:', correctOp);

    // Teste 3: Tentar operação em tenant diferente (DEVE FALHAR)
    console.log(
      '\n[TESTE 3] Tentando acessar tenant diferente (DEVE FALHAR)...'
    );
    const wrongOp = await tenantGuard.validateTenantOperation(
      '999e9999-e29b-41d4-a716-446655440000',
      'SELECT'
    );
    console.log('Resultado:', wrongOp);
    console.assert(
      !wrongOp.isValid,
      '❌ FALHA: Permitiu acesso a tenant diferente!'
    );
  }

  console.groupEnd();
}

// ================================================
// EXEMPLO COMPLETO: SINCRONIZAR COM SEGURANÇA
// ================================================

/*
// Exemplo: Sincronizar dados com validação de tenant

async function syncProjectData(
  tenantId: string,
  projectData: any
): Promise<boolean> {
  const tenantGuard = useTenantGuard(supabase);

  // 1. Validar que operação é no tenant correto
  const validation = await tenantGuard.validateTenantOperation(
    tenantId,
    'UPDATE'
  );

  if (!validation.isValid) {
    console.error('❌ Operação negada:', validation.error);
    if (validation.shouldLogout) {
      await tenantGuard.forceLogout(validation.error);
    }
    return false;
  }

  // 2. Agora é seguro sincronizar
  const { error } = await supabase
    .from('projects')
    .upsert({
      ...projectData,
      tenant_id: tenantId, // RLS vai validar isso
    });

  if (error) {
    console.error('Erro ao sincronizar:', error);
    return false;
  }

  console.log('✅ Dados sincronizados com segurança');
  return true;
}
*/

// ================================================
// FIM DO MIDDLEWARE
// ================================================
