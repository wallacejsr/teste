/**
 * PILAR 4: RBAC Granular Permissions
 * Sistema de Controle de Acesso Baseado em Papéis com permissões granulares
 */

// ================================================
// TIPOS DE PAPÉIS (ROLES)
// ================================================

export enum Role {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR',
  ENGENHEIRO = 'ENGENHEIRO',
  OPERADOR = 'OPERADOR',
  LEITURA = 'LEITURA',
  SUPERADMIN = 'SUPERADMIN',
}

// ================================================
// RECURSOS E AÇÕES (Permissions)
// ================================================

export enum Resource {
  PROJECTS = 'projects',
  TASKS = 'tasks',
  RESOURCES = 'resources',
  USERS = 'users',
  REPORTS = 'reports',
  SETTINGS = 'settings',
  TENANTS = 'tenants',
  AUDIT = 'audit',
}

export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // full control
}

// ================================================
// PERMISSÃO INDIVIDUALIZADA
// ================================================

export interface Permission {
  resource: Resource;
  action: Action;
  allowed: boolean;
  conditional?: {
    // Permissão condicional (ex: só pode ver dados do seu tenant)
    field: string;
    operator: 'equals' | 'contains' | 'in';
    value: any;
  };
}

// ================================================
// DEFINIÇÃO DE ROLES E SUAS PERMISSÕES
// ================================================

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // ============ SUPERADMIN - Acesso Total Irrestrito ============
  [Role.SUPERADMIN]: [
    // SuperAdmin tem acesso a TUDO - bypass de todas as verificações
    { resource: Resource.PROJECTS, action: Action.MANAGE, allowed: true },
    { resource: Resource.TASKS, action: Action.MANAGE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.MANAGE, allowed: true },
    { resource: Resource.USERS, action: Action.MANAGE, allowed: true },
    { resource: Resource.REPORTS, action: Action.MANAGE, allowed: true },
    { resource: Resource.SETTINGS, action: Action.MANAGE, allowed: true },
    { resource: Resource.TENANTS, action: Action.MANAGE, allowed: true },
    { resource: Resource.AUDIT, action: Action.MANAGE, allowed: true },
  ],

  // ============ ADMIN - Acesso Total ============
  [Role.ADMIN]: [
    // Projects
    { resource: Resource.PROJECTS, action: Action.CREATE, allowed: true },
    { resource: Resource.PROJECTS, action: Action.READ, allowed: true },
    { resource: Resource.PROJECTS, action: Action.UPDATE, allowed: true },
    { resource: Resource.PROJECTS, action: Action.DELETE, allowed: true },
    { resource: Resource.PROJECTS, action: Action.MANAGE, allowed: true },

    // Tasks
    { resource: Resource.TASKS, action: Action.CREATE, allowed: true },
    { resource: Resource.TASKS, action: Action.READ, allowed: true },
    { resource: Resource.TASKS, action: Action.UPDATE, allowed: true },
    { resource: Resource.TASKS, action: Action.DELETE, allowed: true },
    { resource: Resource.TASKS, action: Action.MANAGE, allowed: true },

    // Resources
    { resource: Resource.RESOURCES, action: Action.CREATE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.READ, allowed: true },
    { resource: Resource.RESOURCES, action: Action.UPDATE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.DELETE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.MANAGE, allowed: true },

    // Users
    { resource: Resource.USERS, action: Action.CREATE, allowed: true },
    { resource: Resource.USERS, action: Action.READ, allowed: true },
    { resource: Resource.USERS, action: Action.UPDATE, allowed: true },
    { resource: Resource.USERS, action: Action.DELETE, allowed: true },
    { resource: Resource.USERS, action: Action.MANAGE, allowed: true },

    // Reports
    { resource: Resource.REPORTS, action: Action.READ, allowed: true },
    { resource: Resource.REPORTS, action: Action.MANAGE, allowed: true },

    // Settings
    { resource: Resource.SETTINGS, action: Action.READ, allowed: true },
    { resource: Resource.SETTINGS, action: Action.UPDATE, allowed: true },
    { resource: Resource.SETTINGS, action: Action.MANAGE, allowed: true },

    // Tenants
    { resource: Resource.TENANTS, action: Action.MANAGE, allowed: true },
  ],

  // ============ GESTOR - Gerencia Tudo no Seu Tenant ============
  [Role.GESTOR]: [
    // Projects
    { resource: Resource.PROJECTS, action: Action.CREATE, allowed: true },
    { resource: Resource.PROJECTS, action: Action.READ, allowed: true },
    { resource: Resource.PROJECTS, action: Action.UPDATE, allowed: true },
    { resource: Resource.PROJECTS, action: Action.DELETE, allowed: true },

    // Tasks
    { resource: Resource.TASKS, action: Action.CREATE, allowed: true },
    { resource: Resource.TASKS, action: Action.READ, allowed: true },
    { resource: Resource.TASKS, action: Action.UPDATE, allowed: true },
    { resource: Resource.TASKS, action: Action.DELETE, allowed: true },

    // Resources
    { resource: Resource.RESOURCES, action: Action.CREATE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.READ, allowed: true },
    { resource: Resource.RESOURCES, action: Action.UPDATE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.DELETE, allowed: true },

    // Users (gerenciar apenas dentro do tenant)
    { resource: Resource.USERS, action: Action.READ, allowed: true },
    { resource: Resource.USERS, action: Action.UPDATE, allowed: true },

    // Reports
    { resource: Resource.REPORTS, action: Action.READ, allowed: true },

    // Settings (apenas tenant)
    { resource: Resource.SETTINGS, action: Action.READ, allowed: true },
    { resource: Resource.SETTINGS, action: Action.UPDATE, allowed: true },
  ],

  // ============ ENGENHEIRO - Cria e Edita Projetos/Recursos ============
  [Role.ENGENHEIRO]: [
    // Projects
    { resource: Resource.PROJECTS, action: Action.CREATE, allowed: true },
    { resource: Resource.PROJECTS, action: Action.READ, allowed: true },
    { resource: Resource.PROJECTS, action: Action.UPDATE, allowed: true },

    // Tasks
    { resource: Resource.TASKS, action: Action.CREATE, allowed: true },
    { resource: Resource.TASKS, action: Action.READ, allowed: true },
    { resource: Resource.TASKS, action: Action.UPDATE, allowed: true },

    // Resources
    { resource: Resource.RESOURCES, action: Action.CREATE, allowed: true },
    { resource: Resource.RESOURCES, action: Action.READ, allowed: true },
    { resource: Resource.RESOURCES, action: Action.UPDATE, allowed: true },

    // Users (apenas ler)
    { resource: Resource.USERS, action: Action.READ, allowed: true },

    // Reports (apenas ler)
    { resource: Resource.REPORTS, action: Action.READ, allowed: true },
  ],

  // ============ OPERADOR - Executa Tarefas, Atualiza Status ============
  [Role.OPERADOR]: [
    // Projects (apenas leitura)
    { resource: Resource.PROJECTS, action: Action.READ, allowed: true },

    // Tasks (pode atualizar - mudar status)
    { resource: Resource.TASKS, action: Action.READ, allowed: true },
    { resource: Resource.TASKS, action: Action.UPDATE, allowed: true },

    // Resources (apenas leitura)
    { resource: Resource.RESOURCES, action: Action.READ, allowed: true },

    // Users (apenas leitura)
    { resource: Resource.USERS, action: Action.READ, allowed: true },

    // Reports (apenas leitura)
    { resource: Resource.REPORTS, action: Action.READ, allowed: true },
  ],

  // ============ LEITURA - Apenas Visualizar ============
  [Role.LEITURA]: [
    // Projects (apenas leitura)
    { resource: Resource.PROJECTS, action: Action.READ, allowed: true },

    // Tasks (apenas leitura)
    { resource: Resource.TASKS, action: Action.READ, allowed: true },

    // Resources (apenas leitura)
    { resource: Resource.RESOURCES, action: Action.READ, allowed: true },

    // Users (apenas leitura)
    { resource: Resource.USERS, action: Action.READ, allowed: true },

    // Reports (apenas leitura)
    { resource: Resource.REPORTS, action: Action.READ, allowed: true },
  ],
};

// ================================================
// FUNÇÃO UTILITÁRIA
// ================================================

/**
 * Verifica se um papel tem permissão para uma ação
 */
export function hasPermission(
  role: Role,
  resource: Resource,
  action: Action
): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.some(
    (p) => p.resource === resource && p.action === action && p.allowed
  );
}

/**
 * Obter todas as permissões de um papel
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Mapear role para label legível
 */
export const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Administrador',
  [Role.GESTOR]: 'Gestor',
  [Role.ENGENHEIRO]: 'Engenheiro',
  [Role.OPERADOR]: 'Operador',
  [Role.LEITURA]: 'Leitura',
  [Role.SUPERADMIN]: 'Super Administrador',
};

/**
 * Mapear resource para label legível
 */
export const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.PROJECTS]: 'Projetos',
  [Resource.TASKS]: 'Tarefas',
  [Resource.RESOURCES]: 'Recursos',
  [Resource.USERS]: 'Usuários',
  [Resource.REPORTS]: 'Relatórios',
  [Resource.SETTINGS]: 'Configurações',
  [Resource.TENANTS]: 'Tenants',
  [Resource.AUDIT]: 'Auditoria',
};

/**
 * Mapear action para label legível
 */
export const ACTION_LABELS: Record<Action, string> = {
  [Action.CREATE]: 'Criar',
  [Action.READ]: 'Ler',
  [Action.UPDATE]: 'Editar',
  [Action.DELETE]: 'Deletar',
  [Action.MANAGE]: 'Gerenciar',
};
