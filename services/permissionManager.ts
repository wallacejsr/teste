/**
 * PILAR 4: Permission Manager Service
 * Gerencia verificação de permissões, cache e integração com authService
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Role, Resource, Action, Permission, ROLE_PERMISSIONS, hasPermission } from '../types/permissions';

interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  cached: boolean;
}

interface PermissionCacheEntry {
  allowed: boolean;
  timestamp: number;
  ttl: number; // time to live in ms
}

export class PermissionManager {
  private supabase: SupabaseClient | null = null;
  private cache: Map<string, PermissionCacheEntry> = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5 minutos
  private currentUserRole: Role | null = null;
  private currentTenantId: string | null = null;

  /**
   * Inicializar o gerenciador de permissões
   */
  initialize(supabase: SupabaseClient, tenantId: string, userRole: Role): void {
    this.supabase = supabase;
    this.currentTenantId = tenantId;
    this.currentUserRole = userRole;
    console.log(`[PermissionManager] Initialized for tenant: ${tenantId}, role: ${userRole}`);
  }

  /**
   * Verificar se usuário tem permissão para recurso/ação
   * Primeiro verifica cache, depois chamada ao servidor, depois usa ROLE_PERMISSIONS local
   */
  async checkPermission(
    resource: Resource,
    action: Action,
    targetId?: string
  ): Promise<PermissionCheckResult> {
      // ✅ BYPASS ROBUSTO: SuperAdmin tem acesso irrestrito a tudo
      // Converte role em string e compara em maiúsculas para evitar sensibilidade a capitalização
      const roleStr = String(this.currentUserRole).toUpperCase();
      if (roleStr === 'SUPERADMIN') {
        return {
          allowed: true,
          reason: 'SuperAdmin bypass - unrestricted access',
          cached: false,
        };
      }

    if (!this.currentUserRole) {
      return {
        allowed: false,
        reason: 'User role not set',
        cached: false,
      };
    }

    // Gerar chave de cache
    const cacheKey = this.generateCacheKey(resource, action, targetId);

    // Verificar cache
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      return {
        allowed: cached.allowed,
        reason: 'Cached',
        cached: true,
      };
    }

    try {
      // Tentar verificar no servidor (se disponível)
      if (this.supabase) {
        const { data, error } = await this.supabase.rpc('check_permission', {
          p_resource: resource,
          p_action: action,
          p_target_id: targetId || null,
        });

        if (!error && data !== null) {
          const result: PermissionCheckResult = {
            allowed: data as boolean,
            reason: 'Server check',
            cached: false,
          };

          // Cachear resultado
          this.cache.set(cacheKey, {
            allowed: data as boolean,
            timestamp: Date.now(),
            ttl: this.cacheTTL,
          });

          return result;
        }
      }

      // Fallback: usar ROLE_PERMISSIONS local
      const allowed = hasPermission(this.currentUserRole, resource, action);

      this.cache.set(cacheKey, {
        allowed,
        timestamp: Date.now(),
        ttl: this.cacheTTL,
      });

      return {
        allowed,
        reason: 'Local role permissions',
        cached: false,
      };
    } catch (error) {
      console.error('[PermissionManager] Error checking permission:', error);

      // Em caso de erro, usar ROLE_PERMISSIONS local como fallback
      const allowed = hasPermission(this.currentUserRole, resource, action);
      return {
        allowed,
        reason: 'Fallback to local permissions (error occurred)',
        cached: false,
      };
    }
  }

  /**
   * Verificar múltiplas permissões
   */
  async checkPermissions(
    checks: Array<{ resource: Resource; action: Action }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const check of checks) {
      const result = await this.checkPermission(check.resource, check.action);
      const key = `${check.resource}:${check.action}`;
      results.set(key, result.allowed);
    }

    return results;
  }

  /**
   * Obter todas as permissões do usuário atual
   */
  getMyPermissions(): Permission[] {
    if (!this.currentUserRole) {
      return [];
    }
    return ROLE_PERMISSIONS[this.currentUserRole] || [];
  }

  /**
   * Verificar se usuário pode realizar uma ação (sintaxe simplificada)
   */
  can(resource: Resource, action: Action): Promise<boolean> {
    return this.checkPermission(resource, action).then((result) => result.allowed);
  }

  /**
   * Verificar se usuário NÃO pode realizar uma ação
   */
  cannot(resource: Resource, action: Action): Promise<boolean> {
    return this.can(resource, action).then((allowed) => !allowed);
  }

  /**
   * Limpar cache de permissões
   */
  clearCache(resource?: Resource, action?: Action): void {
    if (!resource || !action) {
      // Limpar tudo
      this.cache.clear();
      console.log('[PermissionManager] Cache cleared');
    } else {
      // Limpar específico
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${resource}:${action}`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.cache.delete(key));
      console.log(`[PermissionManager] Cache cleared for ${resource}:${action}`);
    }
  }

  /**
   * Conceder permissão temporária a um usuário
   */
  async grantTempPermission(
    userId: string,
    resource: Resource,
    action: Action,
    durationHours: number = 24,
    reason?: string
  ): Promise<boolean> {
    if (!this.supabase || !this.currentTenantId) {
      console.error('[PermissionManager] Not initialized properly');
      return false;
    }

    try {
      const { data, error } = await this.supabase.rpc('grant_temp_permission', {
        p_user_id: userId,
        p_tenant_id: this.currentTenantId,
        p_resource: resource,
        p_action: action,
        p_duration_hours: durationHours,
        p_reason: reason || null,
      });

      if (error) {
        console.error('[PermissionManager] Error granting temp permission:', error);
        return false;
      }

      console.log(`✅ [PermissionManager] Temp permission granted: ${userId} -> ${resource}:${action}`);
      return true;
    } catch (error) {
      console.error('[PermissionManager] Exception:', error);
      return false;
    }
  }

  /**
   * Obter permissões de um usuário específico
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    if (!this.supabase || !this.currentTenantId) {
      return [];
    }

    try {
      // Buscar role do usuário
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .eq('tenant_id', this.currentTenantId)
        .single();

      if (userError || !user) {
        console.error('[PermissionManager] Error fetching user:', userError);
        return [];
      }

      return ROLE_PERMISSIONS[user.role as Role] || [];
    } catch (error) {
      console.error('[PermissionManager] Exception:', error);
      return [];
    }
  }

  /**
   * Listar todos os logs de auditoria de permissões
   */
  async getAuditLog(limit: number = 100): Promise<any[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('permission_audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[PermissionManager] Error fetching audit log:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[PermissionManager] Exception:', error);
      return [];
    }
  }

  /**
   * Atualizar role do usuário (apenas admin)
   */
  async updateUserRole(userId: string, newRole: Role): Promise<boolean> {
    if (!this.supabase) {
      console.error('[PermissionManager] Not initialized');
      return false;
    }

    if (this.currentUserRole !== Role.ADMIN) {
      console.error('[PermissionManager] Only admin can update roles');
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        console.error('[PermissionManager] Error updating role:', error);
        return false;
      }

      console.log(`✅ [PermissionManager] User role updated: ${userId} -> ${newRole}`);
      this.clearCache(); // Limpar cache após mudança
      return true;
    } catch (error) {
      console.error('[PermissionManager] Exception:', error);
      return false;
    }
  }

  /**
   * Helpers privados
   */

  private generateCacheKey(resource: Resource, action: Action, targetId?: string): string {
    return targetId ? `${resource}:${action}:${targetId}` : `${resource}:${action}`;
  }

  private isCacheExpired(entry: PermissionCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Obter informações de status
   */
  getStatus() {
    return {
      initialized: this.supabase !== null,
      currentUserRole: this.currentUserRole,
      currentTenantId: this.currentTenantId,
      cacheSize: this.cache.size,
      cacheTTL: `${this.cacheTTL / 1000}s`,
    };
  }
}

// Export singleton
export const permissionManager = new PermissionManager();
