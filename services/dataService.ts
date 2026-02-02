import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Project, Task, Resource, DailyLog, Tenant, User, PlanTemplate, GlobalConfig, RoleDefinition } from '../types';
import { authService } from './authService';
import { getSupabaseClient } from './supabaseClient';
import { 
  mapProjectFromDb, mapProjectToDb,
  mapTaskFromDb, mapTaskToDb,
  mapResourceFromDb, mapResourceToDb,
  mapDailyLogFromDb, mapDailyLogToDb,
  mapUserFromDb, mapUserToDb,
  mapTenantFromDb, mapTenantToDb,
  mapRoleFromDb, mapRoleToDb
} from './schemaMappings';

// Interface para itens na fila de sincronização
interface SyncQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: 'projects' | 'tasks' | 'resources' | 'daily_logs' | 'tenants' | 'users' | 'roles';
  data: any;
  timestamp: number;
  retries: number;
  tenantId: string;
}

// Interface para detecção de conflitos
interface ConflictResolution {
  hasConflict: boolean;
  serverData?: any;
  message?: string;
}

/**
 * Serviço de Sincronização com Supabase
 * Implementa fila offline, retry exponencial e detecção de conflitos
 * SINGLETON: Cliente Supabase é criado apenas uma vez e compartilhado
 */
class DataSyncService {
  private static instance: DataSyncService | null = null;
  private supabase: SupabaseClient | null = null;
  private syncQueue: SyncQueueItem[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private isProcessingQueue = false;
  private channels: Map<string, RealtimeChannel> = new Map();
  
  // Sistema de notificação de erros de permissão
  private permissionErrorCallback: ((message: string) => void) | null = null;
  private lastPermissionErrorTime: number = 0;
  private readonly PERMISSION_ERROR_DEBOUNCE = 3000; // 3 segundos

  // Debounce para logs de segurança (5 minutos)
  private securityLogDebounce: Map<string, number> = new Map();
  private readonly SECURITY_LOG_DEBOUNCE = 5 * 60 * 1000;

  /**
   * Registrar callback para notificações de erro de permissão
   */
  setPermissionErrorCallback(callback: (message: string) => void) {
    this.permissionErrorCallback = callback;
  }

  /**
   * Verificar se o erro é de permissão (403 Forbidden / 42501 RLS Violation)
   */
  private isPermissionError(error: any): boolean {
    if (!error) return false;
    
    // Verificar código de erro PostgreSQL (42501 = insufficient_privilege)
    const code = error.code || error.error_code || '';
    if (code === '42501' || code === 'PGRST301') return true;
    
    // Verificar status HTTP 403
    const status = error.status || error.statusCode || 0;
    if (status === 403) return true;
    
    // Verificar mensagem de erro
    const message = (error.message || '').toLowerCase();
    if (message.includes('permission') || 
        message.includes('forbidden') || 
        message.includes('rls') ||
        message.includes('policy')) return true;
    
    return false;
  }

  /**
   * Notificar erro de permissão (com debounce anti-spam)
   */
  private notifyPermissionError() {
    const now = Date.now();
    
    // Prevenir spam: só notifica se passou tempo suficiente desde última notificação
    if (now - this.lastPermissionErrorTime < this.PERMISSION_ERROR_DEBOUNCE) {
      console.log('[DataSync] Permission error suppressed (debounce)');
      return;
    }
    
    this.lastPermissionErrorTime = now;
    
    if (this.permissionErrorCallback) {
      this.permissionErrorCallback('Acesso Negado: Você não tem permissão de Administrador para realizar esta ação.');
    }
    
    console.warn('[DataSync] Permission error detected - user notified');
  }

  /**
   * Processar erro e verificar se é de permissão
   */
  private handleError(error: any, context: string) {
    const errorMsg = error?.message || String(error);
    const errorCode = error?.code || error?.error_code || '';
    const errorStatus = error?.status || error?.statusCode || 0;
    
    console.error(`[DataSync] Error in ${context}:`, {
      message: errorMsg,
      code: errorCode,
      status: errorStatus,
      fullError: error
    });
    
    if (this.isPermissionError(error)) {
      this.notifyPermissionError();
    }
    
    // Log específico para PGRST204 (invalid column)
    if (errorMsg.includes('PGRST204') || errorMsg.includes('column') || errorMsg.includes('does not exist')) {
      console.error('[DataSync] ⚠️ COLUMN ERROR - Verifique se o nome da coluna no schema.sql corresponde ao mapeamento em schemaMappings.ts');
      console.error('[DataSync] Error details:', errorMsg);
    }
  }

  /**
   * Obter instância Singleton do DataSyncService
   */
  static getInstance(): DataSyncService {
    if (!DataSyncService.instance) {
      DataSyncService.instance = new DataSyncService();
    }
    return DataSyncService.instance;
  }

  /**
   * Construtor privado (Singleton pattern)
   */
  private constructor() {}

  /**
   * Inicializar cliente Supabase (Singleton - chamado apenas uma vez)
   */
  static initialize(supabaseUrl: string, supabaseKey: string): boolean {
    const instance = DataSyncService.getInstance();
    
    // Se já foi inicializado, pular
    if (instance.supabase !== null) {
      return true;
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('[DataSync] Supabase credentials missing');
      return false;
    }

    try {
      instance.supabase = getSupabaseClient(supabaseUrl, supabaseKey);

      // Iniciar processamento automático da fila a cada 5 segundos
      instance.syncInterval = setInterval(() => {
        instance.processPendingQueue();
      }, 5000);

      return true;
    } catch (error) {
      console.error('[DataSync] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Verificar se o Supabase está disponível
   */
  isAvailable(): boolean {
    return this.supabase !== null;
  }

  /**
   * Carregar todos os dados iniciais do Supabase
   */
  async loadInitialData(tenantId: string): Promise<{
    projects: Project[];
    tasks: Task[];
    resources: Resource[];
    dailyLogs: DailyLog[];
  }> {
    if (!this.supabase) {
      throw new Error('Supabase not initialized');
    }

    try {
      const [projectsData, tasksData, resourcesData, logsData] = await Promise.all([
        this.supabase.from('projects').select('*').eq('tenant_id', tenantId),
        this.supabase.from('tasks').select('*').eq('tenant_id', tenantId),
        this.supabase.from('resources').select('*').eq('tenant_id', tenantId),
        this.supabase.from('daily_logs').select('*').eq('tenant_id', tenantId)
      ]);

      return {
        projects: (projectsData.data || []).map(mapProjectFromDb),
        tasks: (tasksData.data || []).map(mapTaskFromDb),
        resources: (resourcesData.data || []).map(mapResourceFromDb),
        dailyLogs: (logsData.data || []).map(mapDailyLogFromDb)
      };
    } catch (error) {
      console.error('[DataSync] Error loading initial data:', error);
      throw error;
    }
  }

  /**
   * Carregar cargos por tenant
   */
  async loadRoles(tenantId: string): Promise<RoleDefinition[]> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot load roles');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('roles')
        .select('*')
        .eq('tenantId', tenantId)
        .order('nome', { ascending: true });

      if (error) {
        console.error('[DataSync] Error loading roles:', error);
        return [];
      }

      return (data || []).map((role: any) => ({
        id: role.id,
        tenantId: role.tenantId,
        nome: role.nome || '',
        hhPadrao: role.hh_padrao ?? 0,
        categoria: role.categoria || ''
      }));
    } catch (error) {
      console.error('[DataSync] Exception loading roles:', error);
      return [];
    }
  }

  /**
   * Buscar dados do tenant logado (para sincronizar nome da empresa no header)
   */
  async loadTenantData(tenantId: string): Promise<Tenant | null> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot load tenant data');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Row not found
          console.warn(`[DataSync] Tenant ${tenantId} not found in database`);
          return null;
        }
        throw error;
      }

      if (!data) {
        console.warn(`[DataSync] Tenant ${tenantId} returned no data (RLS issue?)`);
        return null;
      }

      console.log(`[DataSync] Tenant ${tenantId} loaded successfully:`, data.nome);
      return data as Tenant;
    } catch (error) {
      console.error('[DataSync] Error loading tenant data:', error);
      return null;
    }
  }

  /**
   * Buscar TODOS os tenants (uso exclusivo do SUPERADMIN)
   * Sem filtros, sem RLS - para Master Console visualizar todas as empresas
   */
  async loadAllTenants(): Promise<Tenant[]> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot load all tenants');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('tenants')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error('[DataSync] Error loading all tenants:', error);
        return [];
      }

      console.log(`[DataSync] Loaded ${data?.length || 0} tenants for SUPERADMIN`);
      return (data as Tenant[]) || [];
    } catch (error) {
      console.error('[DataSync] Exception loading all tenants:', error);
      return [];
    }
  }

  /**
   * Buscar TODOS os usuários (uso exclusivo do SUPERADMIN)
   * Sem filtros, sem RLS - para Master Console visualizar administradores
   */
  async loadAllUsers(): Promise<User[]> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot load all users');
      return [];
    }

    try {
      // SUPERADMIN precisa buscar todos os usuários sem filtro de tenant
      // Como RLS pode bloquear, vamos buscar explicitamente admins de todos os tenants
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .or('role.eq.ADMIN,role.eq.SUPERADMIN')
        .order('nome', { ascending: true });

      if (error) {
        console.error('[DataSync] Error loading all users:', error);
        console.error('[DataSync] Error details:', JSON.stringify(error));
        
        // Fallback: tentar buscar sem filtro de role
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from('users')
          .select('*')
          .order('nome', { ascending: true });
        
        if (fallbackError) {
          console.error('[DataSync] Fallback query also failed:', fallbackError);
          return [];
        }
        
        console.log(`[DataSync] Fallback loaded ${fallbackData?.length || 0} users`);
        return (fallbackData || []).map(mapUserFromDb);
      }

      console.log(`[DataSync] Loaded ${data?.length || 0} users for SUPERADMIN`);
      return (data || []).map(mapUserFromDb);
    } catch (error) {
      console.error('[DataSync] Exception loading all users:', error);
      return [];
    }
  }

  /**
   * Buscar templates de planos diretamente do banco (plan_templates)
   */
  async loadPlanTemplates(): Promise<PlanTemplate[]> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot load plan templates');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('plan_templates')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('[DataSync] Error loading plan templates:', error);
        return [];
      }

      const normalizePlan = (plan: any): PlanTemplate => {
        const normalizedId = (plan.id || '').toString().toUpperCase() as PlanTemplate['id'];

        return {
          id: normalizedId,
          nome: plan.nome || '',
          precoMensal: plan.preco_mensal ?? plan.precoMensal ?? 0,
          limiteUsuarios: plan.limite_usuarios ?? plan.limiteUsuarios ?? 0,
          limiteObras: plan.limite_obras ?? plan.limiteObras ?? 0,
          limiteMaoDeObra: plan.limite_mao_de_obra ?? plan.limiteMaoDeObra ?? 0,
          limiteMaquinario: plan.limite_maquinario ?? plan.limiteMaquinario ?? 0,
          limiteCargos: plan.limite_cargos ?? plan.limiteCargos ?? 0,
          recursos: Array.isArray(plan.recursos) ? plan.recursos : [],
          cor: plan.cor || '#3b82f6'
        };
      };

      return (data || []).map(normalizePlan);
    } catch (error) {
      console.error('[DataSync] Exception loading plan templates:', error);
      return [];
    }
  }

  /**
   * Atualizar/salvar múltiplos templates de plano no Supabase
   * Realiza upsert em plan_templates usando o id como chave
   */
  async upsertPlanTemplates(plans: PlanTemplate[]): Promise<boolean> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot save plan templates');
      return false;
    }

    try {
      console.log('💾 [DataSync] Saving plan templates:', plans);

      // Normalizar dados para o Supabase (camelCase → snake_case)
      const plansData = plans.map(plan => ({
        id: plan.id,
        nome: plan.nome,
        preco_mensal: plan.precoMensal,
        limite_usuarios: plan.limiteUsuarios,
        limite_obras: plan.limiteObras,
        limite_mao_de_obra: plan.limiteMaoDeObra,
        limite_maquinario: plan.limiteMaquinario,
        limite_cargos: plan.limiteCargos,
        recursos: plan.recursos,
        cor: plan.cor,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await this.supabase
        .from('plan_templates')
        .upsert(plansData, { onConflict: 'id' });

      if (error) {
        console.error('[DataSync] Error upserting plan templates:', error);
        return false;
      }

      console.log('✅ [DataSync] Plan templates saved successfully');
      return true;
    } catch (error) {
      console.error('[DataSync] Exception upserting plan templates:', error);
      return false;
    }
  }

  /**
   * Criar ou atualizar cargo para um tenant
   */
  async upsertRole(role: RoleDefinition, tenantId: string): Promise<RoleDefinition | null> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot save role');
      this.enqueueOperation('update', 'roles', role, tenantId);
      throw new Error('Supabase not initialized');
    }

    try {
      const payload = {
        id: role.id,
        tenantId: tenantId,
        nome: role.nome,
        hh_padrao: role.hhPadrao,
        categoria: role.categoria
      };

      const { data, error } = await this.supabase
        .from('roles')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        tenantId: data.tenantId,
        nome: data.nome || '',
        hhPadrao: data.hh_padrao ?? 0,
        categoria: data.categoria || ''
      };
    } catch (error) {
      console.error('[DataSync] Error upserting role:', error);
      this.enqueueOperation('update', 'roles', role, tenantId);
      throw error;
    }
  }

  /**
   * Excluir cargo do tenant
   */
  async deleteRole(roleId: string, tenantId: string): Promise<boolean> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot delete role');
      this.enqueueOperation('delete', 'roles', { id: roleId }, tenantId);
      throw new Error('Supabase not initialized');
    }

    try {
      const { error } = await this.supabase
        .from('roles')
        .delete()
        .eq('id', roleId)
        .eq('tenantId', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[DataSync] Error deleting role:', error);
      this.enqueueOperation('delete', 'roles', { id: roleId }, tenantId);
      throw error;
    }
  }

  /**
   * Sincronizar limites de plano para todos os tenants que usam aquele plano
   * Executa uma atualização cascata: quando um plano é alterado, todos os tenants
   * que utilizam aquele plano recebem os novos limites
   */
  async syncPlanLimitsToTenants(plans: PlanTemplate[]): Promise<{ success: boolean; errors: string[] }> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot sync plan limits');
      return { success: false, errors: ['Supabase not initialized'] };
    }

    const errors: string[] = [];

    try {
      console.log('🔄 [DataSync] Sincronizando limites de plano para tenants...');

      for (const plan of plans) {
        // Aceita tanto camelCase (UI) quanto snake_case (DB) como fonte
        const limiteUsuarios = (plan as any).limiteUsuarios ?? (plan as any).limite_usuarios ?? 0;
        const limiteObras = (plan as any).limiteObras ?? (plan as any).limite_obras ?? 0;
        const limiteMaoDeObra = (plan as any).limiteMaoDeObra ?? (plan as any).limite_mao_de_obra ?? 0;
        const limiteMaquinario = (plan as any).limiteMaquinario ?? (plan as any).limite_maquinario ?? 0;
        const limiteCargos = (plan as any).limiteCargos ?? (plan as any).limite_cargos ?? 0;

        const { error } = await this.supabase
          .from('tenants')
          .update({
            limiteUsuarios,
            limiteObras,
            limiteMaoDeObra,
            limiteMaquinario,
            limiteCargos,
          })
          .eq('planoId', plan.id);

        if (error) {
          const msg = `[DataSync] Error syncing plan ${plan.id}: ${error.message || 'unknown error'}`;
          console.warn(msg, error);
          errors.push(msg);
        } else {
          console.log(`✅ [DataSync] Plan ${plan.id} limits synced to tenants (filter planoId)`);
        }
      }

      return { success: errors.length === 0, errors };
    } catch (error: any) {
      const msg = `[DataSync] Exception syncing plan limits: ${error?.message || error}`;
      console.error(msg);
      errors.push(msg);
      return { success: false, errors };
    }
  }

  /**
   * Carregar configuração global do sistema (branding, cores, logos)
   */
  async loadGlobalConfig(): Promise<GlobalConfig | null> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot load global config');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('global_configs')
        .select('*')
        .single();

      if (error) {
        // Se não existe ainda, retornar config padrão
        if (error.code === 'PGRST116') {
          console.warn('[DataSync] No global config found in database, using defaults');
          return null;
        }
        console.error('[DataSync] Error loading global config:', error);
        return null;
      }

      const config: GlobalConfig = {
        softwareName: data.software_name || 'PROJEX MASTER',
        softwareSubtitle: data.software_subtitle || '',
        systemLogoUrl: data.system_logo_url || '',
        primaryColor: data.primary_color || '#3b82f6',
        gatewayType: data.gateway_type || undefined,
        publicKey: data.public_key || undefined,
        secretKey: data.secret_key || undefined,
      };

      console.log('[DataSync] Global config loaded successfully');
      return config;
    } catch (error) {
      console.error('[DataSync] Exception loading global config:', error);
      return null;
    }
  }

  /**
   * Salvar/atualizar configuração global do sistema
   * Persiste para o tenant de administração com IDs pré-definidos
   */
  async upsertGlobalConfig(config: GlobalConfig): Promise<boolean> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, cannot save global config');
      return false;
    }

    try {
      // Usar IDs âncora para administração global
      // Nota: gateway_type, public_key, secret_key não existem no schema global_configs
      const configData = {
        id: '00000000-0000-0000-0000-000000000001',
        tenant_id: '00000000-0000-0000-0000-000000000000',
        software_name: config.softwareName,
        software_subtitle: config.softwareSubtitle || null,
        system_logo_url: config.systemLogoUrl || null,
        primary_color: config.primaryColor,
        updated_at: new Date().toISOString(),
      };

      const { error } = await this.supabase
        .from('global_configs')
        .upsert(configData, { onConflict: 'id' });

      if (error) {
        console.error('[DataSync] Error upserting global config:', error);
        return false;
      }

      console.log('✅ [DataSync] Global config saved with administration anchor IDs');
      return true;
    } catch (error) {
      console.error('[DataSync] Exception upserting global config:', error);
      return false;
    }
  }

  /**
   * Sincronizar uma única tarefa com detecção de conflitos (Last-Write-Wins)
   */
  async syncTask(task: Task, userId: string, tenantId: string): Promise<Task | null> {
    if (!this.supabase) {
      // Enfileirar para sincronização posterior
      this.enqueueOperation('update', 'tasks', task, tenantId);
      throw new Error('Offline - operação enfileirada');
    }

    try {
      // 1. Verificar conflito: buscar versão do servidor
      const conflict = await this.detectConflict('tasks', task.id, task.updated_at || new Date().toISOString());

      if (conflict.hasConflict) {
        console.warn(`[Sync] Conflito detectado para tarefa ${task.id}`, conflict.message);
        return null; // Retorna null para trigger UI de refetch
      }

      // 2. Preparar dados para upsert
      const taskData = {
        ...task,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
        last_modified_by: userId,
        version_number: (task.version_number || 0) + 1
      };

      // 3. Fazer upsert no Supabase
      const { data, error } = await this.supabase
        .from('tasks')
        .upsert(taskData, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;

      console.log(`[Sync] Task ${task.id} synchronized successfully`);
      return data as Task;
    } catch (error) {
      console.error('[DataSync] Error syncing task:', error);
      
      // Enfileirar para retry
      this.enqueueOperation('update', 'tasks', task, tenantId);
      throw error;
    }
  }

  /**
   * Sincronização em lote de múltiplas tarefas
   */
  async bulkSyncTasks(tasks: Task[], userId: string, tenantId: string): Promise<Map<string, string>> {
    const idConversions = new Map<string, string>();
    if (!this.supabase) {
      tasks.forEach(task => this.enqueueOperation('update', 'tasks', task, tenantId));
      throw new Error('Offline - operações enfileiradas');
    }

    try {
      const batchSize = 100;
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        
        // Usar mapeamento correto para tasks
        const tasksData = batch.map(t => {
          let finalId = t.id;
          if (t.id && t.id.startsWith('task-')) {
            finalId = crypto.randomUUID();
            idConversions.set(t.id, finalId);
            console.log(`[Sync] Converting temporary task ID ${t.id} → ${finalId}`);
          }

          const dbTask = mapTaskToDb({ ...t, id: finalId }, tenantId);
          return {
            ...dbTask,
            last_modified_by: userId,
            version_number: 1
          };
        });

        const { error } = await this.supabase
          .from('tasks')
          .upsert(tasksData, { onConflict: 'id' });

        if (error) throw error;
      }

      console.log(`[Sync] ${tasks.length} tasks synchronized in bulk`);
      return idConversions;
    } catch (error) {
      this.handleError(error, 'bulkSyncTasks');
      tasks.forEach(task => this.enqueueOperation('update', 'tasks', task, tenantId));
      throw error;
    }
  }

  /**
   * Sincronizar projetos
   * Retorna um mapa de IDs convertidos: { oldId: newId }
   */
  async syncProjects(projects: Project[], userId: string, tenantId: string): Promise<Map<string, string>> {
    const idConversions = new Map<string, string>();
    
    if (!this.supabase) {
      projects.forEach(p => this.enqueueOperation('update', 'projects', p, tenantId));
      throw new Error('Offline - operações enfileiradas');
    }

    try {
      if (projects.length === 0) {
        console.log('[Sync] No projects to sync');
        return idConversions;
      }

      const projectsData = projects.map(p => {
        if (!p.id || !p.nome || !p.dataInicio || !p.dataFim) {
          throw new Error(`Invalid project data: missing required fields. Project: ${JSON.stringify(p)}`);
        }

        // Converter IDs temporários (p-timestamp) para UUID real
        let finalId = p.id;
        if (p.id.startsWith('p-')) {
          finalId = crypto.randomUUID();
          idConversions.set(p.id, finalId);
          console.log(`[Sync] Converting temporary ID ${p.id} → ${finalId}`);
        }

        // Usar mapeamento correto
        const dbProject = mapProjectToDb({ ...p, id: finalId }, tenantId);
        return dbProject;
      });

      console.log('[Sync] Syncing projects:', projectsData.map(p => ({ id: p.id, nome: p.nome })));

      const { error, data } = await this.supabase
        .from('projects')
        .upsert(projectsData, { onConflict: 'id' });

      if (error) {
        throw new Error(`Supabase error [${error.code}]: ${error.message}`);
      }
      console.log(`[Sync] ${projects.length} projects synchronized successfully`);
      
      return idConversions;
    } catch (error) {
      this.handleError(error, 'syncProjects');
      projects.forEach(p => this.enqueueOperation('update', 'projects', p, tenantId));
      throw error;
    }
  }

  /**
   * Sincronizar recursos
   */
  async syncResources(resources: Resource[], userId: string, tenantId: string): Promise<Map<string, string>> {
    const idConversions = new Map<string, string>();
    if (!this.supabase) {
      resources.forEach(r => {
        let finalId = r.id;
        if (r.id && (r.id.startsWith('r-') || r.id.startsWith('res-'))) {
          finalId = crypto.randomUUID();
          idConversions.set(r.id, finalId);
          console.log(`[Sync] Converting resource ID ${r.id} → ${finalId}`);
        }

        const resourceForQueue = finalId === r.id ? r : { ...r, id: finalId };
        this.enqueueOperation('update', 'resources', resourceForQueue, tenantId);
      });
      throw new Error('Offline - operações enfileiradas');
    }

    try {
      const resourcesData = resources.map(r => {
        let finalId = r.id;
        if (r.id && (r.id.startsWith('r-') || r.id.startsWith('res-'))) {
          finalId = crypto.randomUUID();
          idConversions.set(r.id, finalId);
          console.log(`[Sync] Converting resource ID ${r.id} → ${finalId}`);
        }

        const dbResource = mapResourceToDb({ ...r, id: finalId }, tenantId);
        return dbResource;
      });

      const { error } = await this.supabase
        .from('resources')
        .upsert(resourcesData, { onConflict: 'id' });

      if (error) throw error;
      console.log(`[Sync] ${resources.length} resources synchronized`);
      return idConversions;
    } catch (error) {
      this.handleError(error, 'syncResources');
      resources.forEach(r => this.enqueueOperation('update', 'resources', r, tenantId));
      throw error;
    }
  }

  /**
   * Sincronizar logs diários
   */
  async syncDailyLogs(logs: DailyLog[], userId: string, tenantId: string): Promise<Map<string, string>> {
    const idConversions = new Map<string, string>();
    if (!this.supabase) {
      logs.forEach(l => {
        let finalId = l.id;
        if (l.id && l.id.startsWith('log-')) {
          finalId = crypto.randomUUID();
          idConversions.set(l.id, finalId);
          console.log(`[Sync] Converting daily log ID ${l.id} → ${finalId}`);
        }

        const logForQueue = finalId === l.id ? l : { ...l, id: finalId };
        this.enqueueOperation('update', 'daily_logs', logForQueue, tenantId);
      });
      throw new Error('Offline - operações enfileiradas');
    }

    try {
      const logsData = logs.map(l => {
        let finalId = l.id;
        if (l.id && l.id.startsWith('log-')) {
          finalId = crypto.randomUUID();
          idConversions.set(l.id, finalId);
          console.log(`[Sync] Converting daily log ID ${l.id} → ${finalId}`);
        }

        const dbLog = mapDailyLogToDb({ ...l, id: finalId }, tenantId);
        return dbLog;
      });

      const { error } = await this.supabase
        .from('daily_logs')
        .upsert(logsData, { onConflict: 'id' });

      if (error) throw error;
      console.log(`[Sync] ${logs.length} daily_logs synchronized successfully`);
      return idConversions;
    } catch (error) {
      this.handleError(error, 'syncDailyLogs');
      logs.forEach(l => this.enqueueOperation('update', 'daily_logs', l, tenantId));
      throw error;
    }
  }

  /**
   * Sincronizar tenants (inclui fila offline)
   */
  async syncTenants(tenants: Tenant[], tenantId: string): Promise<void> {
    if (!this.supabase) {
      tenants.forEach(t => this.enqueueOperation('update', 'tenants', t, tenantId || t.id));
      throw new Error('Offline - operações enfileiradas');
    }

    try {
      const tenantsData = tenants.map((t) => mapTenantToDb(t));

      const { error } = await this.supabase
        .from('tenants')
        .upsert(tenantsData, { onConflict: 'id' });

      if (error) throw error;
      console.log(`[Sync] ${tenants.length} tenants synchronized`);
    } catch (error) {
      this.handleError(error, 'syncTenants');
      tenants.forEach(t => this.enqueueOperation('update', 'tenants', t, tenantId || t.id));
      throw error;
    }
  }

  /**
   * Sincronizar usuários (criação chama Supabase Auth)
   */
  async syncUsers(users: User[], tenantId: string): Promise<void> {
    const supabaseUnavailable = !this.supabase;
    const authUnavailable = !authService.isAvailable();

    if (supabaseUnavailable || authUnavailable) {
      users.forEach((u) => {
        const action: SyncQueueItem['action'] = (!u.id || u.id.startsWith('temp-') || !!u.password)
          ? 'create'
          : 'update';
        this.enqueueOperation(action, 'users', u, tenantId || u.tenantId);
      });
      throw new Error('Offline - operações enfileiradas');
    }

    for (const user of users) {
      const targetTenantId = user.tenantId || tenantId;
      const isCreate = !user.id || user.id.startsWith('temp-') || !!user.password;

      try {
        if (isCreate) {
          // Precisa criar usuário no Supabase Auth primeiro
          if (!user.password) {
            throw new Error('Senha é obrigatória para criar usuário');
          }

          const signup = await authService.signup({
            email: user.email,
            password: user.password,
            nome: user.nome,
            tenantId: targetTenantId,
            role: user.role
          });

          if (!signup.success || !signup.user) {
            throw new Error(signup.error || 'Falha ao criar usuário no Auth');
          }

          const userRecord = {
            ...user,
            id: signup.user.id,
            tenant_id: targetTenantId,
            ativo: user.ativo ?? true,
            updated_at: new Date().toISOString()
          } as any;

          delete userRecord.password;

          const { error } = await this.supabase
            .from('users')
            .upsert(userRecord, { onConflict: 'id' });

          if (error) throw error;
          console.log(`[Sync] User created via Auth + DB: ${user.email}`);
        } else {
          const userRecord = {
            ...user,
            tenant_id: targetTenantId,
            updated_at: new Date().toISOString()
          } as any;

          delete userRecord.password;

          const { error } = await this.supabase
            .from('users')
            .upsert(userRecord, { onConflict: 'id' });

          if (error) throw error;
          console.log(`[Sync] User updated: ${user.email}`);
        }
      } catch (error) {
        this.handleError(error, `syncUsers (${user.email})`);
        const action: SyncQueueItem['action'] = isCreate ? 'create' : 'update';
        this.enqueueOperation(action, 'users', user, targetTenantId);
      }
    }
  }

  /**
   * Detectar conflito comparando timestamps
   */
  private async detectConflict(
    table: string,
    id: string,
    localTimestamp: string
  ): Promise<ConflictResolution> {
    if (!this.supabase) {
      return { hasConflict: false };
    }

    try {
      const { data: serverData } = await this.supabase
        .from(table)
        .select('updated_at, version_number')
        .eq('id', id)
        .single();

      if (!serverData) {
        // Registro não existe no servidor, sem conflito
        return { hasConflict: false };
      }

      const serverTime = new Date(serverData.updated_at).getTime();
      const localTime = new Date(localTimestamp).getTime();

      if (serverTime > localTime) {
        return {
          hasConflict: true,
          serverData,
          message: `Servidor tem versão mais recente (v${serverData.version_number})`
        };
      }

      return { hasConflict: false };
    } catch (error) {
      console.error('[DataSync] Error detecting conflict:', error);
      return { hasConflict: false };
    }
  }

  /**
   * Enfileirar operação para sincronização offline
   */
  private enqueueOperation(
    action: SyncQueueItem['action'],
    table: SyncQueueItem['table'],
    data: any,
    tenantId: string
  ) {
    const queueItem: SyncQueueItem = {
      id: `${table}-${data.id || Date.now()}`,
      action,
      table,
      data,
      timestamp: Date.now(),
      retries: 0,
      tenantId
    };

    this.syncQueue.push(queueItem);
    console.log(`[Sync] Operation enqueued: ${action} ${table} (queue size: ${this.syncQueue.length})`);

    // Salvar fila no localStorage para persistência
    try {
      localStorage.setItem('ep_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[DataSync] Error saving queue to localStorage:', error);
    }
  }

  /**
   * Processar fila de sincronização pendente com retry exponencial
   */
  async processPendingQueue(): Promise<void> {
    if (!this.supabase || this.isProcessingQueue || this.syncQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log(`[Sync] Processing queue (${this.syncQueue.length} items)`);

    const itemsToRemove: string[] = [];

    for (const item of this.syncQueue) {
      // Retry exponencial: 2^n segundos
      const delayMs = Math.pow(2, item.retries) * 1000;
      const timeSinceEnqueue = Date.now() - item.timestamp;

      if (timeSinceEnqueue < delayMs) {
        continue; // Ainda não é hora de tentar
      }

      try {
        // Executar operação baseada no tipo
        if (item.table === 'users' && item.action === 'create') {
          await this.handleQueuedUserCreate(item);
        } else if (item.action === 'delete') {
          const { error } = await this.supabase
            .from(item.table)
            .delete()
            .eq('id', item.data.id);

          if (error) throw error;
        } else {
          const payload = this.buildPayloadForUpsert(item);
          const { error } = await this.supabase
            .from(item.table)
            .upsert(payload, { onConflict: 'id' });

          if (error) throw error;
        }

        // Sucesso: remover da fila
        itemsToRemove.push(item.id);
        console.log(`[Sync] Queue item processed: ${item.id}`);
      } catch (error) {
        console.error(`[Sync] Error processing queue item ${item.id}:`, error);
        item.retries++;
        
        if (item.retries > 5) {
          // Máximo de retries excedido
          console.error(`[Sync] Max retries exceeded for ${item.id}, removing from queue`);
          itemsToRemove.push(item.id);
        }
      }
    }

    // Remover itens processados da fila
    this.syncQueue = this.syncQueue.filter(item => !itemsToRemove.includes(item.id));

    // Atualizar localStorage
    try {
      localStorage.setItem('ep_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('[DataSync] Error updating queue in localStorage:', error);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Monta payload consistente para upsert em qualquer tabela suportada
   */
  private buildPayloadForUpsert(item: SyncQueueItem) {
    if (item.table === 'resources') {
      const resource = item.data as Resource;
      let finalId = resource.id;

      if (finalId && (finalId.startsWith('r-') || finalId.startsWith('res-'))) {
        finalId = crypto.randomUUID();
        console.log(`[Sync] Converting resource ID ${resource.id} → ${finalId}`);
      }

      return mapResourceToDb({ ...resource, id: finalId }, item.tenantId || resource.tenantId);
    }

    const base = {
      ...item.data,
      updated_at: new Date().toISOString()
    } as any;

    // Tabela tenants não possui tenant_id
    if (item.table === 'tenants') {
      return base;
    }

    // Outras tabelas mantêm tenant_id
    base.tenant_id = item.tenantId || item.data.tenantId;

    if (item.table === 'users') {
      delete base.password; // Nunca salvar senha no public.users
    }

    return base;
  }

  /**
   * Trata criação de usuário enfileirada (Auth + tabela pública)
   */
  private async handleQueuedUserCreate(item: SyncQueueItem): Promise<void> {
    if (!authService.isAvailable()) {
      throw new Error('Auth service unavailable for user creation');
    }

    const tenantId = item.data.tenantId || item.tenantId;
    if (!item.data.password) {
      throw new Error('Senha é obrigatória para criar usuário');
    }

    const signup = await authService.signup({
      email: item.data.email,
      password: item.data.password,
      nome: item.data.nome,
      tenantId,
      role: item.data.role
    });

    if (!signup.success || !signup.user) {
      throw new Error(signup.error || 'Falha ao criar usuário no Auth');
    }

    const payload = {
      ...item.data,
      id: signup.user.id,
      tenant_id: tenantId,
      ativo: item.data.ativo ?? true,
      updated_at: new Date().toISOString()
    } as any;

    delete payload.password;

    const { error } = await this.supabase!
      .from('users')
      .upsert(payload, { onConflict: 'id' });

    if (error) throw error;
  }

  /**
   * Carregar fila do localStorage (ao iniciar app)
   */
  loadQueueFromStorage() {
    try {
      const saved = localStorage.getItem('ep_sync_queue');
      if (saved) {
        this.syncQueue = JSON.parse(saved);
        console.log(`[Sync] Loaded ${this.syncQueue.length} items from queue`);
      }
    } catch (error) {
      console.error('[DataSync] Error loading queue from localStorage:', error);
    }
  }

  /**
   * Configurar listener real-time para uma tabela
   */
  setupRealtimeListener(
    tenantId: string,
    table: 'projects' | 'tasks' | 'resources' | 'daily_logs' | 'tenants' | 'users' | 'roles',
    callback: (payload: any) => void
  ): void {
    if (!this.supabase) {
      console.error('[DataSync] Cannot setup realtime: Supabase not initialized');
      return;
    }

    const channelKey = `${table}:${tenantId}`;

    // Remover canal existente se houver
    if (this.channels.has(channelKey)) {
      this.channels.get(channelKey)?.unsubscribe();
    }

    // Criar novo canal
    const channel = this.supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: `tenant_id=eq.${tenantId}`
        },
        (payload) => {
          console.log(`[Realtime] Change detected in ${table}:`, payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Channel ${channelKey} status:`, status);
      });

    this.channels.set(channelKey, channel);
  }

  /**
   * Remover todos os listeners
   */
  removeAllListeners(): void {
    this.channels.forEach((channel, key) => {
      channel.unsubscribe();
      console.log(`[Realtime] Unsubscribed from ${key}`);
    });
    this.channels.clear();
  }

  /**
   * Limpar recursos ao desmontar
   */
  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.removeAllListeners();
    console.log('[DataSync] Cleanup completed');
  }

  /**
   * Obter tamanho atual da fila
   */
  getQueueSize(): number {
    return this.syncQueue.length;
  }

  /**
   * Forçar sincronização imediata da fila
   */
  async forceSyncQueue(): Promise<void> {
    await this.processPendingQueue();
  }

  /**
   * Registrar evento de segurança (com debounce de 5 minutos)
   */
  async logSecurityEvent(eventType: string, context: string): Promise<boolean> {
    if (!this.supabase) {
      console.warn('[DataSync] Supabase not initialized, skipping security log');
      return false;
    }

    try {
      const session = await authService.getSession();
      const userId = session?.user?.id || null;
      const tenantId = authService.getTenantIdFromSession(session);

      if (!userId || !tenantId) {
        console.warn('[DataSync] Missing userId/tenantId, skipping security log');
        return false;
      }

      const key = `${userId}:${eventType}:${context}`;
      const now = Date.now();
      const last = this.securityLogDebounce.get(key) || 0;

      if (now - last < this.SECURITY_LOG_DEBOUNCE) {
        return false;
      }

      this.securityLogDebounce.set(key, now);

      const { error } = await this.supabase
        .from('security_logs')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          event_type: eventType,
          context,
        });

      if (error) {
        this.handleError(error, 'logSecurityEvent');
        return false;
      }

      return true;
    } catch (error) {
      this.handleError(error, 'logSecurityEvent');
      return false;
    }
  }

  /**
   * Obter cliente Supabase (para operações diretas de leitura)
   */
  getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  /**
   * Limpar item específico da fila de sincronização
   */
  clearQueueItem(itemId: string): boolean {
    const initialSize = this.syncQueue.length;
    this.syncQueue = this.syncQueue.filter(item => item.id !== itemId);
    
    try {
      localStorage.setItem('ep_sync_queue', JSON.stringify(this.syncQueue));
      console.log(`[Sync] Removed queue item ${itemId}. Queue size: ${initialSize} → ${this.syncQueue.length}`);
      return true;
    } catch (error) {
      console.error('[DataSync] Error updating queue in localStorage:', error);
      return false;
    }
  }

  /**
   * Limpar toda a fila de sincronização
   */
  clearQueue(): boolean {
    this.syncQueue = [];
    
    try {
      localStorage.removeItem('ep_sync_queue');
      console.log('[Sync] Queue cleared completely');
      return true;
    } catch (error) {
      console.error('[DataSync] Error clearing queue from localStorage:', error);
      return false;
    }
  }

  /**
   * Obter todos os itens da fila (para debug)
   */
  getQueue(): SyncQueueItem[] {
    return [...this.syncQueue];
  }
}

// Exportar classe para uso de Singleton pattern
export { DataSyncService };

// Exportar instância legada para compatibilidade
export const dataSyncService = DataSyncService.getInstance();
