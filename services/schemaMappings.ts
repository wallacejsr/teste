/**
 * MAPEAMENTO DE ENTIDADES: TypeScript (camelCase) ↔ PostgreSQL (snake_case + camelCase híbrido)
 * 
 * Este arquivo centraliza toda a lógica de tradução entre o código frontend e o schema do banco.
 * IMPORTANTE: O banco tem nomenclatura MISTA e INCONSISTENTE. Este arquivo documenta cada caso.
 * 
 * NÃO altere colunas do banco sem atualizar estas funções!
 */

import { Project, Task, Resource, DailyLog, User, Tenant, RoleDefinition } from '../types';

// ============================================================================
// HELPERS DE CONVERSÃO
// ============================================================================

/**
 * Parse JSON string ou retorna array/objeto como está
 */
function parseIfJson<T>(value: any): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

/**
 * Stringify se for array/objeto, senão retorna como está
 */
function stringifyIfNeeded(value: any): any {
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return JSON.stringify(value);
  }
  return value;
}

// ============================================================================
// PROJECTS: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapProjectToDb(project: Project, tenantId: string): any {
  return {
    id: project.id,
    tenant_id: tenantId,
    nome: project.nome,
    descricao: project.descricao || null,
    cliente_nome: project.clienteNome || null,
    local: project.local || '',
    status: project.status || 'PLANEJAMENTO',
    data_inicio: project.dataInicio,
    data_fim: project.dataFim,
    orcamento_total: project.orcamento ?? 0,
    logo_url: project.logoUrl || null,
    baseline_set: project.baselineSet ?? false,
    updated_at: new Date().toISOString()
  };
}

/**
 * Projects: PostgreSQL → TypeScript (LEITURA)
 */
export function mapProjectFromDb(row: any): Project {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    nome: row.nome,
    descricao: row.descricao || undefined,
    clienteNome: row.cliente_nome || undefined,
    local: row.local || '',
    status: row.status || 'PLANEJAMENTO',
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    orcamento: row.orcamento_total ?? 0,
    logoUrl: row.logo_url || undefined,
    baselineSet: row.baseline_set ?? false
  };
}

// ============================================================================
// TASKS: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapTaskToDb(task: Task, tenantId: string): any {
  return {
    id: task.id,
    tenant_id: tenantId,
    obra_id: task.obraId,
    nome: task.nome,
    descricao: task.descricao || null,
    wbs: task.wbs,
    inicio_planejado: task.inicioPlanejado,
    fim_planejado: task.fimPlanejado,
    inicio_real: task.inicioReal || null,
    fim_real: task.fimReal || null,
    duracao_dias: task.duracaoDias,
    qtd_planejada: task.qtdPlanejada,
    qtd_realizada: task.qtdRealizada,
    unidade_medida: task.unidadeMedida || task.unidadeId || null,
    peso: task.peso,
    is_auto_weight: task.isAutoWeight ?? true,
    dependencias: stringifyIfNeeded(task.dependencias),
    alocacoes: stringifyIfNeeded(task.alocacoes),
    // ⚠️ ATENÇÃO: Estas colunas estão em camelCase no banco (anomalia!)
    custoPlanejado: task.custoPlanejado ?? 0,
    custoRealizado: task.custoRealizado ?? 0,
    updated_at: new Date().toISOString()
  };
}

/**
 * Tasks: PostgreSQL → TypeScript (LEITURA)
 */
export function mapTaskFromDb(row: any): Task {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    obraId: row.obra_id,
    nome: row.nome,
    descricao: row.descricao || undefined,
    wbs: row.wbs,
    duracaoDias: row.duracao_dias,
    inicioPlanejado: row.inicio_planejado,
    fimPlanejado: row.fim_planejado,
    inicioReal: row.inicio_real || undefined,
    fimReal: row.fim_real || undefined,
    dependencias: parseIfJson<string[]>(row.dependencias) || [],
    unidadeId: row.unidade_medida || 'und',
    unidadeMedida: row.unidade_medida || undefined,
    qtdPlanejada: row.qtd_planejada ?? 0,
    qtdRealizada: row.qtd_realizada ?? 0,
    peso: row.peso ?? 0,
    isAutoWeight: row.is_auto_weight ?? true,
    custoPlanejado: row.custoPlanejado ?? 0,
    custoRealizado: row.custoRealizado ?? 0,
    alocacoes: parseIfJson<any[]>(row.alocacoes) || []
  };
}

// ============================================================================
// RESOURCES: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapResourceToDb(resource: Resource, tenantId: string): any {
  return {
    id: resource.id,
    tenant_id: tenantId,
    nome: resource.nome,
    tipo: resource.tipo,
    cargo_id: resource.cargoId || null,
    cargo_nome: resource.cargoNome || null,
    user_id: resource.userId || null,
    ativo: resource.ativo ?? true,
    custo_hora: resource.custoHora ?? 0,
    updated_at: new Date().toISOString()
  };
}

/**
 * Resources: PostgreSQL → TypeScript (LEITURA)
 */
export function mapResourceFromDb(row: any): Resource {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo as 'HUMANO' | 'EQUIPAMENTO',
    tenantId: row.tenant_id,
    custoHora: row.custo_hora ?? 0,
    userId: row.user_id || undefined,
    cargoId: row.cargo_id || undefined,
    cargoNome: row.cargo_nome || undefined,
    ativo: row.ativo ?? true,
    especialidade: row.especialidade || undefined,
    categoria: row.categoria || undefined,
    placaId: row.placa_id || undefined
  };
}

// ============================================================================
// DAILY_LOGS: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapDailyLogToDb(log: DailyLog, tenantId: string): any {
  return {
    id: log.id,
    tenant_id: tenantId,
    obra_id: log.obraId,
    data: log.data,
    usuario_id: log.usuarioId,
    observacoes: log.observacoes,
    avancos: stringifyIfNeeded(log.avancos),
    fotos: stringifyIfNeeded(log.fotos || []),
    impedimentos: stringifyIfNeeded(log.impedimentos || []),
    aplicou_cascata: log.aplicouCascata ?? false,
    updated_at: new Date().toISOString()
  };
}

/**
 * DailyLogs: PostgreSQL → TypeScript (LEITURA)
 */
export function mapDailyLogFromDb(row: any): DailyLog {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    obraId: row.obra_id,
    data: row.data,
    usuarioId: row.usuario_id,
    observacoes: row.observacoes || '',
    avancos: parseIfJson<any[]>(row.avancos) || [],
    fotos: parseIfJson<string[]>(row.fotos) || [],
    impedimentos: parseIfJson<any[]>(row.impedimentos) || [],
    aplicouCascata: row.aplicou_cascata ?? false
  };
}

// ============================================================================
// USERS: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapUserToDb(user: User, tenantId: string): any {
  return {
    id: user.id,
    tenant_id: tenantId,
    email: user.email,
    nome: user.nome,
    role: user.role,
    ativo: user.ativo ?? true,
    cargo: user.cargo || null,
    // ⚠️ IMPORTANTE: O banco pode ter: avatarUrl (camelCase), avatar_url, ou avatar_url_storage
    // Supabase/PostgreSQL com snake_case costuma converter automaticamente
    // Mas se a coluna for criada como camelCase, precisa de aspas
    avatarUrl: user.avatarUrl || null, // Tenta camelCase (sem aspas inicialmente)
    lastPasswordChange: user.lastPasswordChange || null,
    updated_at: new Date().toISOString()
  };
}

/**
 * Users: PostgreSQL → TypeScript (LEITURA)
 */
export function mapUserFromDb(row: any): User {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    tenantId: row.tenant_id,
    role: row.role,
    ativo: row.ativo ?? true,
    cargo: row.cargo || undefined,
    avatarUrl: row.avatarUrl || undefined,
    signatureUrl: row.signatureUrl || undefined,
    lastPasswordChange: row.lastPasswordChange || undefined
  };
}

// ============================================================================
// TENANTS: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapTenantToDb(tenant: Tenant): any {
  return {
    id: tenant.id,
    nome: tenant.nome,
    cnpj: tenant.cnpj,
    status: tenant.status,
    logoUrl: tenant.logoUrl || null, // ⚠️ DB usa camelCase (anomalia do schema!)
    planoId: tenant.planoId,
    dataFimLicenca: tenant.dataFimLicenca,
    limiteUsuarios: tenant.limiteUsuarios ?? 10,
    limiteObras: tenant.limiteObras ?? 5,
    limiteMaoDeObra: tenant.limiteMaoDeObra ?? 50,
    limiteMaquinario: tenant.limiteMaquinario ?? 20,
    limiteCargos: tenant.limiteCargos ?? 15,
    updated_at: new Date().toISOString()
  };
}

/**
 * Tenants: PostgreSQL → TypeScript (LEITURA)
 * ⚠️ ATENÇÃO: Banco tem colunas em camelCase (anomalia!)
 */
export function mapTenantFromDb(row: any): Tenant {
  return {
    id: row.id,
    nome: row.nome,
    cnpj: row.cnpj,
    logoUrl: row.logoUrl || undefined,
    limiteUsuarios: row.limiteUsuarios ?? 10,
    limiteObras: row.limiteObras ?? 5,
    limiteMaoDeObra: row.limiteMaoDeObra ?? 50,
    limiteMaquinario: row.limiteMaquinario ?? 20,
    limiteCargos: row.limiteCargos ?? 15,
    planoId: row.planoId || 'BASIC',
    dataFimLicenca: row.dataFimLicenca || '',
    status: row.status || 'SUSPENSA'
  };
}

// ============================================================================
// ROLES: TypeScript → PostgreSQL (ENVIO/UPSERT)
// ============================================================================

export function mapRoleToDb(role: RoleDefinition, tenantId: string): any {
  return {
    id: role.id,
    tenantId: tenantId,
    nome: role.nome,
    categoria: role.categoria,
    // ⚠️ ATENÇÃO: Banco tem AMBAS as colunas (hh_padrao e hhPadrao)
    // Vamos preencher a versão snake_case como padrão
    hh_padrao: role.hhPadrao ?? 0,
    hhPadrao: role.hhPadrao ?? 0, // Manter ambas para compatibilidade
    updated_at: new Date().toISOString()
  };
}

/**
 * Roles: PostgreSQL → TypeScript (LEITURA)
 */
export function mapRoleFromDb(row: any): RoleDefinition {
  return {
    id: row.id,
    tenantId: row.tenantId || row.tenant_id,
    nome: row.nome,
    hhPadrao: row.hh_padrao ?? row.hhPadrao ?? 0,
    categoria: row.categoria || ''
  };
}
