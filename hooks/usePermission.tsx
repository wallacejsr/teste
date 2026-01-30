/**
 * PILAR 4: usePermission Hook
 * Hook React para verificar permissões nos componentes
 */

import { useState, useEffect, useCallback } from 'react';
import { Resource, Action } from '../types/permissions';
import { permissionManager } from '../services/permissionManager';

interface UsePermissionResult {
  allowed: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para verificar permissão única
 * @example
 * const { allowed, loading } = usePermission(Resource.PROJECTS, Action.CREATE);
 * if (!loading && allowed) {
 *   return <button>Criar Projeto</button>;
 * }
 */
export function usePermission(resource: Resource, action: Action): UsePermissionResult {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await permissionManager.checkPermission(resource, action);
        setAllowed(result.allowed);
      } catch (err: any) {
        console.error('[usePermission] Error:', err);
        setError(err.message || 'Erro ao verificar permissão');
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermission();
  }, [resource, action]);

  return { allowed, loading, error };
}

/**
 * Hook para verificar múltiplas permissões
 * @example
 * const permissions = usePermissions([
 *   { resource: Resource.PROJECTS, action: Action.CREATE },
 *   { resource: Resource.PROJECTS, action: Action.DELETE },
 * ]);
 * if (permissions.allowed) { ... }
 */
export function usePermissions(
  checks: Array<{ resource: Resource; action: Action }>
): UsePermissionResult & { results: Map<string, boolean> } {
  const [results, setResults] = useState<Map<string, boolean>>(new Map());
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        setLoading(true);
        setError(null);

        const permResults = await permissionManager.checkPermissions(checks);
        setResults(permResults);

        // Verificar se TODAS as permissões são permitidas
        const allAllowed = Array.from(permResults.values()).every((p) => p);
        setAllowed(allAllowed);
      } catch (err: any) {
        console.error('[usePermissions] Error:', err);
        setError(err.message || 'Erro ao verificar permissões');
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    };

    if (checks.length > 0) {
      checkPermissions();
    }
  }, [checks]);

  return { allowed, loading, error, results };
}

/**
 * Hook para verificar permissão com re-verificação periódica
 * Útil para verificar em tempo real enquanto usuário navega
 */
export function usePermissionWithRefresh(
  resource: Resource,
  action: Action,
  refreshIntervalMs: number = 30000 // 30 segundos
): UsePermissionResult & { refresh: () => void } {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await permissionManager.checkPermission(resource, action);
      setAllowed(result.allowed);
    } catch (err: any) {
      console.error('[usePermissionWithRefresh] Error:', err);
      setError(err.message);
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }, [resource, action]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [resource, action, refreshIntervalMs, refresh]);

  return { allowed, loading, error, refresh };
}

/**
 * Hook para obter todas as permissões do usuário
 */
export function useMyPermissions() {
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLoading(true);
      const perms = permissionManager.getMyPermissions();
      setPermissions(perms);
    } catch (err: any) {
      console.error('[useMyPermissions] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { permissions, loading, error };
}

/**
 * Componente ProtectedElement
 * Renderiza componente apenas se usuário tem permissão
 */
interface ProtectedElementProps {
  resource: Resource;
  action: Action;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

export function ProtectedElement({
  resource,
  action,
  children,
  fallback = null,
  loading = <div>Carregando...</div>,
}: ProtectedElementProps) {
  const { allowed, loading: isLoading } = usePermission(resource, action);

  if (isLoading) {
    return <>{loading}</>;
  }

  return <>{allowed ? children : fallback}</>;
}

/**
 * Componente PermissionBoundary
 * Renderiza conteúdo apenas se todas as permissões são atendidas
 */
interface PermissionBoundaryProps {
  checks: Array<{ resource: Resource; action: Action }>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

export function PermissionBoundary({
  checks,
  children,
  fallback = <div>Acesso negado</div>,
  loading = <div>Carregando...</div>,
}: PermissionBoundaryProps) {
  const { allowed, loading: isLoading } = usePermissions(checks);

  if (isLoading) {
    return <>{loading}</>;
  }

  return <>{allowed ? children : fallback}</>;
}

/**
 * Hook para habilitar/desabilitar elemento baseado em permissão
 * @example
 * const isDisabled = usePermissionDisabled(Resource.PROJECTS, Action.DELETE);
 * <button disabled={isDisabled}>Deletar</button>
 */
export function usePermissionDisabled(resource: Resource, action: Action): boolean {
  const { allowed } = usePermission(resource, action);
  return !allowed;
}

/**
 * Hook para obter mensagem de erro de permissão
 */
export function usePermissionDeniedMessage(resource: Resource, action: Action): string {
  const { allowed } = usePermission(resource, action);

  if (allowed) return '';

  return `Você não tem permissão para ${action} ${resource}`;
}
