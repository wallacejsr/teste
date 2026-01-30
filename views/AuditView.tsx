import React, { useState, useEffect } from 'react';
import { dataSyncService } from '../services/dataService';
import { permissionManager } from '../services/permissionManager';
import { Role, Resource, Action } from '../types/permissions';
import { usePermission } from '../hooks/usePermission';
import {
  Download,
  Search,
  Filter,
  ChevronDown,
  Check,
  X,
  Shield,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  tenant_id: string;
  action: string;
  resource: string;
  target_id?: string;
  allowed: boolean;
  reason: string;
  timestamp: string;
}

interface SecurityLog {
  id: string;
  tenant_id: string;
  user_id: string;
  user_name: string; // Nome do usuário (JOIN com users)
  event_type: string;
  context: string;
  created_at: string;
}

interface AuditStats {
  total: number;
  allowed: number;
  denied: number;
  superadminBypass: number;
  uniqueUsers: number;
  timeRange: string;
}

export const AuditView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'permissions' | 'security'>('permissions');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total: 0,
    allowed: 0,
    denied: 0,
    superadminBypass: 0,
    uniqueUsers: 0,
    timeRange: 'Últimas 24 horas',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterResource, setFilterResource] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // 🔐 PROTEÇÃO: Auditoria é exclusiva para SUPERADMIN
  const permStatus = permissionManager.getStatus();
  const isSuperAdmin = permStatus.currentUserRole === Role.SUPERADMIN;
  
  // Hook de permissão corretamente - verifica Resource.AUDIT e Action.READ
  const { allowed: canReadAudit, loading: permLoading } = usePermission(Resource.AUDIT, Action.READ);
  
  // Acesso: SUPERADMIN ou com permissão explícita (redundante, mas seguro)
  const hasAuditAccess = isSuperAdmin || canReadAudit;

  // Carregar logs de auditoria - aguarda permissões carregarem
  useEffect(() => {
    // Se ainda está carregando permissões, aguarda
    if (permLoading) return;
    
    // Se não tem acesso, não carrega
    if (!hasAuditAccess) return;
    
    loadAuditLogs();
    if (isSuperAdmin) {
      loadSecurityLogs();
    }
  }, [dateRange, permLoading, hasAuditAccess, isSuperAdmin]);

  // Aplicar filtros
  useEffect(() => {
    applyFilters();
  }, [logs, searchText, filterResource, filterAction, filterStatus]);

  const loadAuditLogs = async () => {
    if (!hasAuditAccess) {
      setError('Sem permissão para acessar logs de auditoria');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = dataSyncService.getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const now = new Date();
      let startDate = new Date();

      // Calcular data de início baseado no filtro
      if (dateRange === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (dateRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      }

      const { data, error: err } = await supabase
        .from('permission_audit_log')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', now.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (err) {
        throw err;
      }

      setLogs(data || []);
      calculateStats(data || []);
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err);
      setError('Falha ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  };

  const loadSecurityLogs = async () => {
    if (!isSuperAdmin) {
      setSecurityError('Acesso restrito a SUPERADMIN');
      return;
    }

    setSecurityLoading(true);
    setSecurityError(null);

    try {
      const supabase = dataSyncService.getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      const now = new Date();
      let startDate = new Date();

      if (dateRange === '24h') {
        startDate.setHours(startDate.getHours() - 24);
      } else if (dateRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (dateRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      }

      const { data, error: err } = await supabase
        .from('security_logs')
        .select(`
          *,
          users:user_id (
            nome
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString())
        .order('created_at', { ascending: false })
        .limit(1000);

      if (err) {
        throw err;
      }

      // Processar dados para extrair nome do usuário com fallback
      const processedLogs = (data || []).map((log: any) => ({
        ...log,
        user_name: log.users?.nome || 'Usuário Desconhecido'
      }));

      setSecurityLogs(processedLogs);
    } catch (err) {
      console.error('Erro ao carregar logs de segurança:', err);
      setSecurityError('Falha ao carregar logs de segurança');
    } finally {
      setSecurityLoading(false);
    }
  };

  const calculateStats = (auditLogs: AuditLog[]) => {
    const allowed = auditLogs.filter((log) => log.allowed).length;
    const denied = auditLogs.filter((log) => !log.allowed).length;
    const superadminBypass = auditLogs.filter(
      (log) => log.reason && log.reason.includes('SuperAdmin')
    ).length;
    const uniqueUsers = new Set(auditLogs.map((log) => log.user_id)).size;

    setStats({
      total: auditLogs.length,
      allowed,
      denied,
      superadminBypass,
      uniqueUsers,
      timeRange:
        dateRange === '24h'
          ? 'Últimas 24 horas'
          : dateRange === '7d'
            ? 'Últimos 7 dias'
            : 'Últimos 30 dias',
    });
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Filtro de texto (busca em user_id, resource, action)
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.user_id?.toLowerCase().includes(search) ||
          log.resource?.toLowerCase().includes(search) ||
          log.action?.toLowerCase().includes(search) ||
          log.reason?.toLowerCase().includes(search)
      );
    }

    // Filtro de recurso
    if (filterResource) {
      filtered = filtered.filter((log) => log.resource === filterResource);
    }

    // Filtro de ação
    if (filterAction) {
      filtered = filtered.filter((log) => log.action === filterAction);
    }

    // Filtro de status
    if (filterStatus) {
      const status = filterStatus === 'allowed';
      filtered = filtered.filter((log) => log.allowed === status);
    }

    setFilteredLogs(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Usuário', 'Recurso', 'Ação', 'Status', 'Motivo', 'Data/Hora'];
    const rows = filteredLogs.map((log) => [
      log.user_id,
      log.resource,
      log.action,
      log.allowed ? 'Permitido' : 'Negado',
      log.reason,
      new Date(log.timestamp).toLocaleString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const hasRecentSecurityAlerts = securityLogs.some((log) => {
    const timestamp = new Date(log.created_at).getTime();
    return Date.now() - timestamp <= 24 * 60 * 60 * 1000;
  });

  const getResourceColor = (resource: string): string => {
    const colors: Record<string, string> = {
      projects: 'bg-blue-100 text-blue-800',
      tasks: 'bg-purple-100 text-purple-800',
      resources: 'bg-green-100 text-green-800',
      users: 'bg-orange-100 text-orange-800',
      reports: 'bg-red-100 text-red-800',
      settings: 'bg-gray-100 text-gray-800',
      tenants: 'bg-pink-100 text-pink-800',
      audit: 'bg-indigo-100 text-indigo-800',
    };
    return colors[resource] || 'bg-gray-100 text-gray-800';
  };

  const getActionColor = (action: string): string => {
    const colors: Record<string, string> = {
      create: 'text-green-600',
      read: 'text-blue-600',
      update: 'text-yellow-600',
      delete: 'text-red-600',
      manage: 'text-purple-600',
    };
    return colors[action] || 'text-gray-600';
  };

  // Aguardar carregamento de permissões
  if (permLoading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block">
          <div className="animate-spin">
            <Clock className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
        <p className="text-gray-600 mt-4">Validando permissões...</p>
      </div>
    );
  }

  if (!hasAuditAccess) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
        <p className="text-gray-600">Apenas SUPERADMIN pode acessar logs de auditoria.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">Auditoria de Permissões</h1>
        </div>
        <p className="text-gray-600">Monitore todas as ações de acesso e permissões do sistema</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="inline-flex items-center rounded-xl bg-white shadow-sm border border-gray-200 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
              activeTab === 'permissions'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Permissões
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Segurança
              {hasRecentSecurityAlerts && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              )}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'permissions' && (
        <>
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        {/* Card: Total */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total de Acessos</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.timeRange}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        {/* Card: Permitido */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Permitidos</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.allowed}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.total > 0 ? Math.round((stats.allowed / stats.total) * 100) : 0}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-200" />
          </div>
        </div>

        {/* Card: Negado */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Negados</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.denied}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.total > 0 ? Math.round((stats.denied / stats.total) * 100) : 0}%
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-200" />
          </div>
        </div>

        {/* Card: SuperAdmin Bypass */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">SuperAdmin Bypasses</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{stats.superadminBypass}</p>
              <p className="text-xs text-gray-500 mt-1">Acessos irstritos</p>
            </div>
            <Shield className="w-8 h-8 text-purple-200" />
          </div>
        </div>

        {/* Card: Usuários Únicos */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Usuários Únicos</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{stats.uniqueUsers}</p>
              <p className="text-xs text-gray-500 mt-1">Que fizeram ações</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-200" />
          </div>
        </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center gap-4 flex-wrap">
          {/* Busca */}
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por usuário, recurso, ação ou motivo..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de Data */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '24h' | '7d' | '30d')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
          </select>

          {/* Filtro de Recurso */}
          <select
            value={filterResource}
            onChange={(e) => setFilterResource(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Todos os Recursos</option>
            <option value="projects">Projetos</option>
            <option value="tasks">Tarefas</option>
            <option value="resources">Recursos</option>
            <option value="users">Usuários</option>
            <option value="reports">Relatórios</option>
            <option value="settings">Configurações</option>
            <option value="tenants">Tenants</option>
            <option value="audit">Auditoria</option>
          </select>

          {/* Filtro de Ação */}
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Todas as Ações</option>
            <option value="create">Criar</option>
            <option value="read">Ler</option>
            <option value="update">Atualizar</option>
            <option value="delete">Deletar</option>
            <option value="manage">Gerenciar</option>
          </select>

          {/* Filtro de Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Todos os Status</option>
            <option value="allowed">Permitido</option>
            <option value="denied">Negado</option>
          </select>

          {/* Botão de Exportar */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <Download className="w-5 h-5" />
            Exportar CSV
          </button>

          {/* Botão de Limpar Filtros */}
          {(searchText || filterResource || filterAction || filterStatus) && (
            <button
              onClick={() => {
                setSearchText('');
                setFilterResource('');
                setFilterAction('');
                setFilterStatus('');
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Limpar Filtros
            </button>
          )}
            </div>
          </div>

          {/* Tabela de Logs */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block">
              <div className="animate-spin">
                <Clock className="w-8 h-8 text-indigo-600" />
              </div>
            </div>
            <p className="text-gray-600 mt-4">Carregando logs de auditoria...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-red-600 mb-2">
              <X className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={loadAuditLogs}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Tentar Novamente
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Filter className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">Nenhum log encontrado com os filtros aplicados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Recurso
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Ação
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Data/Hora
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Motivo
                  </th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition"
                      onClick={() =>
                        setExpandedRow(expandedRow === log.id ? null : log.id)
                      }
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium truncate">
                        {log.user_id?.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getResourceColor(log.resource)}`}>
                          {log.resource}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`font-medium ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {log.allowed ? (
                            <>
                              <Check className="w-5 h-5 text-green-600" />
                              <span className="text-green-600 font-medium">Permitido</span>
                            </>
                          ) : (
                            <>
                              <X className="w-5 h-5 text-red-600" />
                              <span className="text-red-600 font-medium">Negado</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">
                        {log.reason}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <ChevronDown
                          className={`w-5 h-5 text-gray-400 transition transform ${
                            expandedRow === log.id ? 'rotate-180' : ''
                          }`}
                        />
                      </td>
                    </tr>
                    {expandedRow === log.id && (
                      <tr className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-gray-600 font-medium">ID do Usuário:</p>
                                <p className="text-gray-900 font-mono break-all">{log.user_id}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 font-medium">ID do Tenant:</p>
                                <p className="text-gray-900 font-mono break-all">{log.tenant_id}</p>
                              </div>
                              {log.target_id && (
                                <div>
                                  <p className="text-gray-600 font-medium">ID do Alvo:</p>
                                  <p className="text-gray-900 font-mono break-all">{log.target_id}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-600 font-medium">Timestamp:</p>
                                <p className="text-gray-900 font-mono">
                                  {log.timestamp}
                                </p>
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-600 font-medium">Motivo Completo:</p>
                              <p className="text-gray-900 bg-white p-2 rounded border border-gray-200 break-all">
                                {log.reason}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Exibindo {filteredLogs.length} de {logs.length} logs
            </div>
          </div>
        )}
          </div>
        </>
      )}

      {activeTab === 'security' && !isSuperAdmin && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Shield className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h3>
          <p className="text-gray-600">A aba de Segurança é exclusiva para SUPERADMIN.</p>
        </div>
      )}

      {activeTab === 'security' && isSuperAdmin && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {securityLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block">
                <div className="animate-spin">
                  <Clock className="w-8 h-8 text-indigo-600" />
                </div>
              </div>
              <p className="text-gray-600 mt-4">Carregando alertas de segurança...</p>
            </div>
          ) : securityError ? (
            <div className="p-8 text-center">
              <div className="text-red-600 mb-2">
                <X className="w-8 h-8 mx-auto" />
              </div>
              <p className="text-gray-600">{securityError}</p>
              <button
                onClick={loadSecurityLogs}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Tentar Novamente
              </button>
            </div>
          ) : securityLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">Nenhum alerta de segurança nas últimas {stats.timeRange.toLowerCase()}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Usuário
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Tipo de Violação
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Contexto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {securityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td 
                        className="px-6 py-4 text-sm text-gray-900 font-medium"
                        title={log.user_id}
                      >
                        {log.user_name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                          {log.event_type || 'Alerta de Segurança'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {log.context || 'Contexto indisponível'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                Exibindo {securityLogs.length} alertas
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AuditView;
