
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import ObrasView from './views/ObrasView';
import PlanejamentoView from './views/PlanejamentoView';
import GanttChartView from './views/GanttChartView';
import FinanceiroView from './views/FinanceiroView';
import RecursosView from './views/RecursosView';
import DiarioView from './views/DiarioView';
import EquipeView from './views/EquipeView';
import ProfileView from './views/ProfileView';
import LoginView from './views/LoginView';
import MasterAdminView from './views/MasterAdminView';
import AuditView from './views/AuditView';
import UpgradeModal from './components/UpgradeModal';
import { User, Project, Task, Resource, DailyLog, Role, Tenant, LicenseStatus, GlobalConfig, PlanTemplate } from './types';
import { AlertCircle, MessageSquare, Wifi, WifiOff, CheckCircle, Clock } from 'lucide-react';
import { Toaster } from 'sonner';
import { dataSyncService } from './services/dataService';
import { authService } from './services/authService';
import { permissionManager } from './services/permissionManager';
import { TenantGuard, useTenantGuard } from './src/middleware/tenantGuard';

const App: React.FC = () => {
  // PILAR 3: Autenticação agora vem do Supabase Auth, não do localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('ep_activeTab') || 'dashboard');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Estados de sincronização
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing'>('offline');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(() => {
    const saved = localStorage.getItem('ep_global_config');
    return saved ? JSON.parse(saved) : {
      softwareName: 'PROJEX MASTER',
      systemLogoUrl: '',
      primaryColor: '#3b82f6'
    };
  });

  const [plansConfig, setPlansConfig] = useState<PlanTemplate[]>(() => {
    const saved = localStorage.getItem('ep_plans_config');
    return saved ? JSON.parse(saved) : [];
  });

  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem('ep_all_tenants');
    return saved ? JSON.parse(saved) : [];
  });

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ep_all_users');
    return saved ? JSON.parse(saved) : [];
  });

  // PILAR 3: currentUser agora vem do Supabase Auth
  const [currentUser, setCurrentUser] = useState<User>({ 
    id: 'anon', 
    nome: 'Visitante', 
    email: '', 
    tenantId: '', 
    role: Role.LEITURA, 
    ativo: false 
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);

  // Camada de Segurança: Filtros por Tenant (Empresa)
  const tenantProjects = useMemo(() => projects.filter(p => p.tenantId === currentUser.tenantId), [projects, currentUser.tenantId]);
  const tenantTasks = useMemo(() => tasks.filter(t => t.tenantId === currentUser.tenantId), [tasks, currentUser.tenantId]);
  const tenantResources = useMemo(() => resources.filter(r => r.tenantId === currentUser.tenantId), [resources, currentUser.tenantId]);
  const tenantLogs = useMemo(() => dailyLogs.filter(l => l.tenantId === currentUser.tenantId), [dailyLogs, currentUser.tenantId]);
  const tenantUsers = useMemo(() => allUsers.filter(u => u.tenantId === currentUser.tenantId), [allUsers, currentUser.tenantId]);

  const emptyTenant = useMemo<Tenant>(() => ({
    id: '',
    nome: '',
    cnpj: '',
    logoUrl: '',
    limiteUsuarios: 0,
    limiteObras: 0,
    limiteMaoDeObra: 0,
    limiteMaquinario: 0,
    limiteCargos: 0,
    planoId: (plansConfig[0]?.id ?? 'BASIC') as PlanTemplate['id'],
    dataFimLicenca: '',
    status: LicenseStatus.SUSPENSA
  }), [plansConfig]);

  const activeTenant = useMemo(() => {
    if (currentUser.role === Role.SUPERADMIN) {
      return tenants[0] || null;
    }
    return tenants.find(t => t.id === currentUser.tenantId) || null;
  }, [tenants, currentUser.tenantId, currentUser.role]);

  const tenantForUI = activeTenant || emptyTenant;

  // --- NOVA LÓGICA DINÂMICA DE RECURSOS ---
  const activePlanFeatures = useMemo(() => {
    if (!activeTenant) return [];
    const plan = plansConfig.find(p => p.id === activeTenant.planoId);
    return plan ? plan.recursos : [];
  }, [plansConfig, activeTenant?.planoId]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    const saved = localStorage.getItem('ep_selectedProject');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tenantId === currentUser.tenantId) return parsed;
    }
    return null;
  });

  // Referência para tenant guard (criado uma única vez)
  const tenantGuardRef = useRef<TenantGuard | null>(null);

  // =====================================================
  // INICIALIZAÇÃO DO SUPABASE E CARREGAMENTO DE DADOS
  // =====================================================
  useEffect(() => {
    const initializeSupabase = async () => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('[App] Supabase not configured, using localStorage fallback');
        setSyncStatus('offline');
        setAuthInitialized(true);
        loadFromLocalStorage();
        return;
      }

      // Inicializar o serviço de autenticação (PILAR 3)
      const authInit = authService.initialize(supabaseUrl, supabaseKey);
      
      // Inicializar o serviço de sincronização
      const dataInit = dataSyncService.initialize(supabaseUrl, supabaseKey);
      
      // Registrar callback de erro de permissão
      dataSyncService.setPermissionErrorCallback((message) => {
        showNotification(message, 'error');
      });
      
      if (!authInit || !dataInit) {
        console.error('[App] Failed to initialize Supabase');
        setSyncStatus('offline');
        setAuthInitialized(true);
        loadFromLocalStorage();
        return;
      }

      // Inicializar tenant guard para validações de segurança
      if (dataSyncService.supabase) {
        tenantGuardRef.current = new TenantGuard(dataSyncService.supabase);
      }

      setSyncStatus('online');

      // Carregar templates de planos direto do Supabase
      await loadPlanTemplatesFromSupabase();
      
      // Carregar configuração global (branding) do Supabase
      await loadGlobalConfigFromSupabase();
      
      // Carregar fila de sincronização pendente
      dataSyncService.loadQueueFromStorage();

      // Expor dataSyncService globalmente apenas em DEV (evitar vazamento em produção)
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        (window as any).__dataSyncService = dataSyncService;
        console.log('[App] 🛠️ DataSync service exposed as window.__dataSyncService');
        console.log('[App] 📋 Debug commands: __dataSyncService.clearQueue(), .clearQueueItem(id), .getQueue()');
      }

      // Verificar sessão existente (PILAR 3)
      const session = await authService.getSession();
      if (session) {
        const user = await authService.getCurrentUser();
        if (user && user.ativo) {
          setCurrentUser(user);
          setIsLoggedIn(true);
          console.log('[App] Sessão restaurada:', user.email);
          
          // Carregar dados se não for master
          if (user.tenantId && user.role !== Role.SUPERADMIN) {
            await loadDataFromSupabase();
          }
        }
      }

      setAuthInitialized(true);
    };

    initializeSupabase();

    // Cleanup ao desmontar
    return () => {
      dataSyncService.cleanup();
    };
  }, []);

  // =====================================================
  // BLINDAGEM DEVTOOLS (DETERRENTE) - PRODUÇÃO
  // =====================================================
  useEffect(() => {
    if (!import.meta.env.PROD || typeof window === 'undefined') return;

    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const preventDevToolsShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isF12 = key === 'f12' || event.keyCode === 123;
      const isCtrlShiftI = event.ctrlKey && event.shiftKey && key === 'i';
      const isCtrlShiftJ = event.ctrlKey && event.shiftKey && key === 'j';
      const isCtrlShiftC = event.ctrlKey && event.shiftKey && key === 'c';
      if (isF12 || isCtrlShiftI || isCtrlShiftJ || isCtrlShiftC) {
        const shortcut = isF12
          ? 'Uso de tecla F12'
          : isCtrlShiftI
            ? 'Atalho Ctrl+Shift+I'
            : isCtrlShiftJ
              ? 'Atalho Ctrl+Shift+J'
              : 'Atalho Ctrl+Shift+C';
        dataSyncService.logSecurityEvent(shortcut, window.location.href);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    // Detecção simples de DevTools (não é infalível, apenas deterrente)
    let trapInterval: number | undefined;
    const devToolsDetector = () => {
      const threshold = 160;
      const widthDiff = Math.abs(window.outerWidth - window.innerWidth);
      const heightDiff = Math.abs(window.outerHeight - window.innerHeight);
      const detected = widthDiff > threshold || heightDiff > threshold;
      if (detected) {
        dataSyncService.logSecurityEvent('Abertura de Console/DevTools', window.location.href);
        debugger; // trap leve quando DevTools estiver aberto
      }
    };

    window.addEventListener('contextmenu', preventContextMenu, { capture: true });
    window.addEventListener('keydown', preventDevToolsShortcuts, { capture: true });
    trapInterval = window.setInterval(devToolsDetector, 1000);

    return () => {
      window.removeEventListener('contextmenu', preventContextMenu, { capture: true } as any);
      window.removeEventListener('keydown', preventDevToolsShortcuts, { capture: true } as any);
      if (trapInterval) window.clearInterval(trapInterval);
    };
  }, []);

  // =====================================================
  // ESCUTAR MUDANÇAS DE AUTENTICAÇÃO (PILAR 3 + PILAR 4)
  // =====================================================
  useEffect(() => {
    if (!authInitialized) return;

    const unsubscribe = authService.onAuthStateChange(async (event, session) => {
      console.log('[App] Auth state changed:', event);

      if (event === 'SIGNED_IN' && session) {
        const user = await authService.getCurrentUser();
        if (user && user.ativo) {
          setCurrentUser(user);
          setIsLoggedIn(true);
          showNotification('Login realizado com sucesso!', 'success');
          
          // PILAR 4: Inicializar Permission Manager
          if (user.tenantId && dataSyncService.supabase) {
            permissionManager.initialize(dataSyncService.supabase, user.tenantId, user.role);
            console.log('[App] Permission Manager initialized for:', user.email);
          }
          
          // Carregar dados
          if (user.role === Role.SUPERADMIN) {
            // SUPERADMIN: Carregar TODOS os tenants para Gestão de Empresas
            const allTenantsData = await dataSyncService.loadAllTenants();
            setTenants(allTenantsData);
            console.log('[App] SUPERADMIN: Loaded all tenants for Master Console');
            const allUsersData = await dataSyncService.loadAllUsers();
            setAllUsers(allUsersData);
            console.log('[App] SUPERADMIN: Loaded all users for Master Console');
          } else if (user.tenantId) {
            // User regular: Carregar dados do seu tenant
            await loadDataFromSupabase();
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser({ 
          id: 'anon', 
          nome: 'Visitante', 
          email: '', 
          tenantId: '', 
          role: Role.LEITURA, 
          ativo: false 
        });
        setIsLoggedIn(false);
        setActiveTab('dashboard');
        showNotification('Logout realizado', 'success');
        
        // PILAR 4: Limpar Permission Manager
        permissionManager.clearCache();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('[App] Token refreshed');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [authInitialized]);

  const loadPlanTemplatesFromSupabase = async () => {
    try {
      const templates = await dataSyncService.loadPlanTemplates();
      if (templates.length) {
        setPlansConfig(templates);
        localStorage.setItem('ep_plans_config', JSON.stringify(templates));
        console.log(`[App] Loaded ${templates.length} plan templates from Supabase`);
      } else {
        console.warn('[App] No plan templates returned from Supabase; keeping existing plansConfig');
      }
    } catch (error) {
      console.error('[App] Error loading plan templates:', error);
    }
  };

  const loadGlobalConfigFromSupabase = async () => {
    try {
      const config = await dataSyncService.loadGlobalConfig();
      if (config) {
        setGlobalConfig(config);
        localStorage.setItem('ep_global_config', JSON.stringify(config));
        console.log('[App] Global config loaded from Supabase');
        
        // Aplicar primaryColor ao CSS root para tema global
        if (config.primaryColor) {
          document.documentElement.style.setProperty('--primary-color', config.primaryColor);
          console.log('[App] CSS variable --primary-color applied:', config.primaryColor);
        }
      } else {
        console.warn('[App] No global config in database; using defaults');
      }
    } catch (error) {
      console.error('[App] Error loading global config:', error);
    }
  };

  // Carregar dados do Supabase
  const loadDataFromSupabase = async () => {
    if (!currentUser.tenantId || currentUser.role === Role.SUPERADMIN) return;
    
    setIsLoadingData(true);
    setSyncStatus('syncing');
    
    try {
      // Carregar dados do tenant primeiro
      const tenantData = await dataSyncService.loadTenantData(currentUser.tenantId);
      if (tenantData) {
        // Atualizar o tenant na lista com dados frescos do banco
        setTenants(prevTenants => {
          const updated = prevTenants.map(t => 
            t.id === currentUser.tenantId ? tenantData : t
          );
          // Se o tenant não existe na lista, adicionar
          if (!updated.find(t => t.id === currentUser.tenantId)) {
            updated.push(tenantData);
          }
          return updated;
        });
        console.log(`[App] Tenant name synchronized from database: ${tenantData.nome}`);
      } else {
        console.warn(`[App] Failed to load tenant data for ${currentUser.tenantId}, using cached value`);
      }

      // Carregar dados dos projetos, tarefas, etc.
      const data = await dataSyncService.loadInitialData(currentUser.tenantId);
      
      setProjects(data.projects);
      setTasks(data.tasks);
      setResources(data.resources);
      setDailyLogs(data.dailyLogs);
      
      // Backup no localStorage
      localStorage.setItem('ep_projects', JSON.stringify(data.projects));
      localStorage.setItem('ep_tasks', JSON.stringify(data.tasks));
      localStorage.setItem('ep_resources', JSON.stringify(data.resources));
      localStorage.setItem('ep_dailyLogs', JSON.stringify(data.dailyLogs));
      
      setSyncStatus('online');
      showNotification('✅ Dados sincronizados com sucesso', 'success');
      console.log('[App] Data loaded from Supabase successfully');
    } catch (error) {
      console.error('[App] Error loading from Supabase:', error);
      setSyncStatus('offline');
      showNotification('⚠️ Erro ao carregar dados. Usando backup local.', 'warning');
      loadFromLocalStorage();
    } finally {
      setIsLoadingData(false);
    }
  };

  // Fallback: Carregar do localStorage
  const loadFromLocalStorage = () => {
    const savedProjects = localStorage.getItem('ep_projects');
    const savedTasks = localStorage.getItem('ep_tasks');
    const savedResources = localStorage.getItem('ep_resources');
    const savedLogs = localStorage.getItem('ep_dailyLogs');

    if (savedProjects) setProjects(JSON.parse(savedProjects));
    if (savedTasks) setTasks(JSON.parse(savedTasks));
    if (savedResources) setResources(JSON.parse(savedResources));

    if (savedLogs) setDailyLogs(JSON.parse(savedLogs));

    console.log('[App] Data loaded from localStorage');
  };

  // Recarregar dados quando usuário faz login
  useEffect(() => {
    if (isLoggedIn && currentUser.tenantId && currentUser.role !== Role.SUPERADMIN) {
      if (dataSyncService.isAvailable()) {
        loadDataFromSupabase();
      }
    }
  }, [isLoggedIn, currentUser.tenantId]);

  // =====================================================
  // VALIDAÇÃO CONTÍNUA DE TENANT (PILAR 2 SEGURANÇA)
  // =====================================================
  useEffect(() => {
    if (!isLoggedIn || !tenantGuardRef.current) {
      return;
    }

    console.log('[TenantGuard] Iniciando validação de sessão');

    // Validar session imediatamente
    const validateSession = async () => {
      const result = await tenantGuardRef.current!.validateCurrentUser();
      
      if (!result.isValid && result.shouldLogout) {
        console.error(
          '🔴 [SEGURANÇA] Sessão inválida detectada:',
          result.error
        );
        showNotification(
          `⚠️ Sessão encerrada: ${result.error}`,
          'error'
        );
        
        // Forçar logout
        setIsLoggedIn(false);
        setCurrentUser({
          id: 'anon',
          nome: 'Visitante',
          email: '',
          tenantId: '',
          role: Role.LEITURA,
          ativo: false,
        });
        setActiveTab('dashboard');
      }
    };

    validateSession();

    // Monitorar sessão a cada 30 segundos
    const monitor = setInterval(() => {
      tenantGuardRef.current!.monitorSession(() => {
        setIsLoggedIn(false);
        showNotification(
          '⚠️ Sessão encerrada por razões de segurança',
          'error'
        );
      });
    }, 30000);

    return () => clearInterval(monitor);
  }, [isLoggedIn, currentUser.id]);

  // Sincronizar projects com Supabase quando mudarem
  useEffect(() => {
    if (!isLoggedIn || !currentUser.tenantId || currentUser.tenantId === 'master' || projects.length === 0) {
      return;
    }

    const syncWithDelay = async () => {
      try {
        console.log('[App] Triggering project sync for', projects.length, 'projects');
        await syncProjectsWithSupabase(projects);
      } catch (error) {
        console.error('[App] Failed to sync projects:', error);
      }
    };

    // Pequeno delay para evitar múltiplas sincronizações rápidas
    const timer = setTimeout(syncWithDelay, 500);
    return () => clearTimeout(timer);
  }, [projects, isLoggedIn, currentUser.tenantId]);

  // Sincronizar resources com Supabase quando mudarem
  useEffect(() => {
    if (!isLoggedIn || !currentUser.tenantId || currentUser.tenantId === 'master' || resources.length === 0) {
      return;
    }

    const syncWithDelay = async () => {
      try {
        console.log('[App] Triggering resource sync for', resources.length, 'resources');
        await syncResourcesWithSupabase(resources);
      } catch (error) {
        console.error('[App] Failed to sync resources:', error);
      }
    };

    const timer = setTimeout(syncWithDelay, 500);
    return () => clearTimeout(timer);
  }, [resources, isLoggedIn, currentUser.tenantId]);

  // Sincronizar daily logs com Supabase quando mudarem
  useEffect(() => {
    if (!isLoggedIn || !currentUser.tenantId || currentUser.tenantId === 'master' || dailyLogs.length === 0) {
      return;
    }

    const syncWithDelay = async () => {
      try {
        console.log('[App] Triggering daily log sync for', dailyLogs.length, 'logs');
        await syncDailyLogsWithSupabase(dailyLogs);
      } catch (error) {
        console.error('[App] Failed to sync daily logs:', error);
      }
    };

    const timer = setTimeout(syncWithDelay, 1000);
    return () => clearTimeout(timer);
  }, [dailyLogs, isLoggedIn, currentUser.tenantId]);

  // Salvar no localStorage (backup) sempre que os dados mudarem
  // PILAR 3: Não salvar mais isLoggedIn e currentUser (vem do JWT)
  useEffect(() => {
    localStorage.setItem('ep_projects', JSON.stringify(projects));
    localStorage.setItem('ep_tasks', JSON.stringify(tasks));
    localStorage.setItem('ep_resources', JSON.stringify(resources));
    localStorage.setItem('ep_dailyLogs', JSON.stringify(dailyLogs));
    if (selectedProject) localStorage.setItem('ep_selectedProject', JSON.stringify(selectedProject));
    else localStorage.removeItem('ep_selectedProject');
    localStorage.setItem('ep_activeTab', activeTab);
    localStorage.setItem('ep_all_tenants', JSON.stringify(tenants));
    localStorage.setItem('ep_all_users', JSON.stringify(allUsers));
    localStorage.setItem('ep_global_config', JSON.stringify(globalConfig));
    localStorage.setItem('ep_plans_config', JSON.stringify(plansConfig));
  }, [projects, tasks, resources, dailyLogs, selectedProject, activeTab, tenants, allUsers, globalConfig, plansConfig]);

  // Sistema de notificações
  const showNotification = (message: string, type: 'success' | 'warning' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  // =====================================================
  // REAL-TIME LISTENERS (SUPABASE)
  // =====================================================
  useEffect(() => {
    if (!isLoggedIn || !currentUser.tenantId || currentUser.tenantId === 'master') {
      return;
    }

    if (!dataSyncService.isAvailable()) {
      return;
    }

    console.log('[App] Setting up real-time listeners for tenant:', currentUser.tenantId);

    // Listener para Tasks
    dataSyncService.setupRealtimeListener(currentUser.tenantId, 'tasks', (payload) => {
      console.log('[Realtime] Task change:', payload);
      
      if (payload.eventType === 'INSERT') {
        setTasks(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new : t));
      } else if (payload.eventType === 'DELETE') {
        setTasks(prev => prev.filter(t => t.id === payload.old.id));
      }
    });

    // Listener para Projects
    dataSyncService.setupRealtimeListener(currentUser.tenantId, 'projects', (payload) => {
      console.log('[Realtime] Project change:', payload);
      
      if (payload.eventType === 'INSERT') {
        setProjects(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setProjects(prev => prev.map(p => p.id === payload.new.id ? payload.new : p));
      } else if (payload.eventType === 'DELETE') {
        setProjects(prev => prev.filter(p => p.id === payload.old.id));
      }
    });

    // Listener para Resources
    dataSyncService.setupRealtimeListener(currentUser.tenantId, 'resources', (payload) => {
      console.log('[Realtime] Resource change:', payload);
      
      if (payload.eventType === 'INSERT') {
        setResources(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setResources(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
      } else if (payload.eventType === 'DELETE') {
        setResources(prev => prev.filter(r => r.id === payload.old.id));
      }
    });

    // Listener para Daily Logs
    dataSyncService.setupRealtimeListener(currentUser.tenantId, 'daily_logs', (payload) => {
      console.log('[Realtime] Daily log change:', payload);
      
      if (payload.eventType === 'INSERT') {
        setDailyLogs(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setDailyLogs(prev => prev.map(l => l.id === payload.new.id ? payload.new : l));
      } else if (payload.eventType === 'DELETE') {
        setDailyLogs(prev => prev.filter(l => l.id === payload.old.id));
      }
    });

    // Cleanup ao desmontar ou mudar de tenant
    return () => {
      dataSyncService.removeAllListeners();
    };
  }, [isLoggedIn, currentUser.tenantId]);

  // =====================================================
  // FUNÇÕES DE SINCRONIZAÇÃO COM SUPABASE
  // =====================================================
  const syncTasksWithSupabase = async (updatedTasks: Task[]) => {
    if (!dataSyncService.isAvailable()) {
      showNotification('⚠️ Offline - Salvando localmente', 'warning');
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.bulkSyncTasks(updatedTasks, currentUser.id, currentUser.tenantId);

      if (idConversions.size > 0) {
        console.log('[App] Updating local task IDs with converted UUIDs:', Array.from(idConversions.entries()));
        setTasks(prev => prev.map(t => {
          const newId = idConversions.get(t.id);
          return newId ? { ...t, id: newId } : t;
        }));
      }
      setSyncStatus('online');
    } catch (error) {
      console.error('[App] Error syncing tasks:', error);
      setSyncStatus('offline');
      showNotification('⚠️ Dados salvos localmente. Sincronizando quando online...', 'warning');
    }
  };

  const syncProjectsWithSupabase = async (updatedProjects: Project[]) => {
    if (!dataSyncService.isAvailable()) {
      console.warn('[App] Supabase not available, saving locally');
      return;
    }

    setSyncStatus('syncing');
    try {
      console.log('[App] Syncing', updatedProjects.length, 'projects to Supabase');
      const idConversions = await dataSyncService.syncProjects(updatedProjects, currentUser.id, currentUser.tenantId);
      
      // Atualizar IDs temporários para UUIDs reais no estado local
      if (idConversions.size > 0) {
        console.log('[App] Updating local state with converted IDs:', Array.from(idConversions.entries()));
        setProjects(prev => prev.map(p => {
          const newId = idConversions.get(p.id);
          return newId ? { ...p, id: newId } : p;
        }));
      }
      
      setSyncStatus('online');
      console.log('[App] Projects sync completed successfully');
    } catch (error: any) {
      console.error('[App] Error syncing projects:', error);
      setSyncStatus('offline');
      showNotification(
        `⚠️ Erro ao sincronizar: ${error.message || 'Dados salvos localmente'}`,
        'warning'
      );
    }
  };

  const syncResourcesWithSupabase = async (updatedResources: Resource[]) => {
    if (!dataSyncService.isAvailable()) {
      showNotification('⚠️ Offline - Salvando localmente', 'warning');
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.syncResources(updatedResources, currentUser.id, currentUser.tenantId);

      if (idConversions.size > 0) {
        console.log('[App] Updating local resource IDs with converted UUIDs:', Array.from(idConversions.entries()));
        setResources(prev => prev.map(r => {
          const newId = idConversions.get(r.id);
          return newId ? { ...r, id: newId } : r;
        }));
      }
      setSyncStatus('online');
    } catch (error) {
      console.error('[App] Error syncing resources:', error);
      setSyncStatus('offline');
      showNotification('⚠️ Dados salvos localmente. Sincronizando quando online...', 'warning');
    }
  };

  const syncDailyLogsWithSupabase = async (updatedLogs: DailyLog[]) => {
    if (!dataSyncService.isAvailable()) {
      showNotification('⚠️ Offline - Salvando localmente', 'warning');
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.syncDailyLogs(updatedLogs, currentUser.id, currentUser.tenantId);

      if (idConversions.size > 0) {
        console.log('[App] Updating local daily log IDs with converted UUIDs:', Array.from(idConversions.entries()));
        setDailyLogs(prev => prev.map(l => {
          const newId = idConversions.get(l.id);
          return newId ? { ...l, id: newId } : l;
        }));
      }
      setSyncStatus('online');
    } catch (error) {
      console.error('[App] Error syncing daily logs:', error);
      setSyncStatus('offline');
      showNotification('⚠️ Dados salvos localmente. Sincronizando quando online...', 'warning');
    }
  };

  /* =====================================================
     AUTENTICAÇÃO COM VALIDAÇÃO DE SENHA (PRODUÇÃO)
     ===================================================== */
  // =====================================================
  // HANDLERS DE AUTENTICAÇÃO (PILAR 3)
  // =====================================================
  
  const handleLogin = async (email: string, password: string = '') => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Master admin bypass (temporário - pode ser removido após migração completa)
    if (normalizedEmail === 'master@plataforma.com' || normalizedEmail === 'wallacejoaosilva@gmail.com') {
      setCurrentUser({ 
        id: 'master', 
        nome: 'Super Administrador', 
        email: 'master@plataforma.com', 
        tenantId: '00000000-0000-0000-0000-000000000000', 
        role: Role.SUPERADMIN, 
        ativo: true, 
        cargo: 'Plataforma Owner' 
      });
      setActiveTab('master-dash');
      setIsLoggedIn(true);
      return;
    }
    
    // PILAR 3: Login real via Supabase Auth
    // O authService.login() já faz toda a validação e atualiza o estado via onAuthStateChange
    // Não precisamos fazer mais nada aqui - o listener de auth state cuida de tudo
  };

  const handleLogout = async () => {
    // PILAR 3: Logout via Supabase Auth
    await authService.logout();
    
    // O listener de auth state vai atualizar os estados automaticamente
    // Mas fazemos cleanup de qualquer coisa local
    setSelectedProject(null);
    setProjects([]);
    setTasks([]);
    setResources([]);
    setDailyLogs([]);
  };

  const openUpgrade = () => setShowUpgradeModal(true);

  const renderContent = () => {
    if (currentUser.role === Role.SUPERADMIN) {
      switch (activeTab) {
        case 'master-dash':
        case 'tenants':
        case 'subscriptions':
        case 'system-branding':
        case 'payments':
          return (
            <MasterAdminView 
              activeTab={activeTab} 
              globalConfig={globalConfig} 
              onUpdateGlobalConfig={setGlobalConfig}
              allTenants={tenants} 
              onUpdateTenants={setTenants}
              allUsers={allUsers}
              onUpdateUsers={setAllUsers}
              allProjects={projects}
              allDailyLogs={dailyLogs}
              plansConfig={plansConfig}
              onUpdatePlansConfig={setPlansConfig}
              onSimulateAccess={(user) => { setCurrentUser(user); setActiveTab('dashboard'); }}
            />
          );
        case 'config':
          return <ProfileView plansConfig={plansConfig} user={currentUser} onUpdateUser={setCurrentUser} tenant={tenantForUI} onUpdateTenant={(t) => setTenants(prev => prev.map(item => item.id === t.id ? t : item))} allUsers={allUsers} onUpdateUsers={setAllUsers} globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} />;
        case 'audit':
          return <AuditView />;
        default:
          return <MasterAdminView activeTab="master-dash" globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} allTenants={tenants} onUpdateTenants={setTenants} allUsers={allUsers} onUpdateUsers={setAllUsers} allProjects={projects} allDailyLogs={dailyLogs} plansConfig={plansConfig} onUpdatePlansConfig={setPlansConfig} onSimulateAccess={(user) => { setCurrentUser(user); setActiveTab('dashboard'); }} />;
      }
    }

    const renderObrasView = () => (
      <ObrasView 
        projects={tenantProjects} 
        activeTenant={tenantForUI}
        onOpenUpgrade={openUpgrade}
        onSelectProject={(p) => { setSelectedProject(p); setActiveTab('planejamento'); }} 
        onAddProject={(p) => setProjects(prev => [...prev.filter(x => x.id !== p.id), { ...p, tenantId: currentUser.tenantId }])} 
        onRemoveProject={(id) => {
          setProjects(p => p.filter(x => x.id !== id));
          // Limpar dailyLogs da obra deletada e resetar selectedProject se necessário
          setDailyLogs(logs => logs.filter(l => l.obraId !== id));
          if (selectedProject?.id === id) {
            setSelectedProject(null);
          }
        }} 
      />
    );

    switch (activeTab) {
      case 'dashboard': return <Dashboard projects={tenantProjects} tasks={tenantTasks} resources={tenantResources} dailyLogs={tenantLogs} />;
      case 'obras': return renderObrasView();
      case 'planejamento': return ( 
        <PlanejamentoView 
          project={selectedProject} 
          activeTenant={tenantForUI} 
          planFeatures={activePlanFeatures} 
          onOpenUpgrade={openUpgrade} 
          tasks={tenantTasks} 
          resources={tenantResources} 
          onTasksChange={(updatedTasks) => { 
            const otherTenantsTasks = tasks.filter(t => t.tenantId !== currentUser.tenantId); 
            const sanitized = updatedTasks.map(t => ({ ...t, tenantId: currentUser.tenantId })); 
            const newTasks = [...otherTenantsTasks, ...sanitized];
            setTasks(newTasks); 
            syncTasksWithSupabase(sanitized);
          }} 
          dailyLogs={tenantLogs}
          setActiveTab={setActiveTab}
        /> 
      );
      case 'gantt': return (
        <GanttChartView 
          projects={tenantProjects}
          tasks={tenantTasks}
          resources={tenantResources}
          dailyLogs={tenantLogs}
          tenant={tenantForUI}
          onTasksChange={(updatedTasks) => { 
            const otherTenantsTasks = tasks.filter(t => t.tenantId !== currentUser.tenantId); 
            const sanitized = updatedTasks.map(t => ({ ...t, tenantId: currentUser.tenantId })); 
            const newTasks = [...otherTenantsTasks, ...sanitized];
            setTasks(newTasks); 
            syncTasksWithSupabase(sanitized);
          }}
          setActiveTab={setActiveTab}
          selectedProjectId={selectedProject?.id || ''}
        />
      );
      case 'financeiro': return (
        <FinanceiroView 
          projects={tenantProjects} 
          project={selectedProject} 
          planFeatures={activePlanFeatures} 
          onOpenUpgrade={openUpgrade}
          tasks={tenantTasks} 
          resources={tenantResources} 
          dailyLogs={tenantLogs}
          setActiveTab={setActiveTab}
        />
      );
      case 'recursos': return <RecursosView tasks={tenantTasks} projects={tenantProjects} resources={tenantResources} />;
      case 'diario': return (
      <DiarioView 
        project={selectedProject} 
        projects={tenantProjects} 
        tenant={tenantForUI}
        globalConfig={globalConfig}
        resources={tenantResources}
        allUsers={tenantUsers} // Passando os usuários da empresa para mapeamento de funções
        planFeatures={activePlanFeatures} 
        onOpenUpgrade={openUpgrade} 
        tasks={tenantTasks} 
        onTasksChange={(updatedTasks) => { 
          const otherTenantsTasks = tasks.filter(t => t.tenantId !== currentUser.tenantId); 
          const sanitized = updatedTasks.map(t => ({ ...t, tenantId: currentUser.tenantId })); 
          const newTasks = [...otherTenantsTasks, ...sanitized];
          setTasks(newTasks); 
          syncTasksWithSupabase(sanitized);
        }} 
        onAddDailyLog={(log) => setDailyLogs(prev => [...prev, { ...log, tenantId: currentUser.tenantId }])} 
        onRemoveDailyLog={(id) => setDailyLogs(l => l.filter(x => x.id !== id))} 
        dailyLogs={tenantLogs} 
        user={currentUser}
        setActiveTab={setActiveTab}
      />
    );
      case 'usuarios': return (
        <EquipeView 
          activeTenant={tenantForUI} 
          planFeatures={activePlanFeatures} 
          plansConfig={plansConfig}
          onOpenUpgrade={openUpgrade} 
          resources={tenantResources} 
          tasks={tenantTasks} 
          projects={tenantProjects} 
          allUsers={tenantUsers} 
          onAddResource={r => setResources(prev => [...prev.filter(x => x.id !== r.id), { ...r, tenantId: currentUser.tenantId }])} 
          onRemoveResource={(id) => {
            // Ação 1: Remover o recurso do estado de recursos
            setResources(prev => prev.filter(r => r.id !== id));

            // Ação 2: Limpeza em cascata nas tarefas (remover alocações vinculadas ao recurso)
            setTasks(prev => {
              const otherTenantsTasks = prev.filter(t => t.tenantId !== currentUser.tenantId);
              const updatedTenantTasks = prev
                .filter(t => t.tenantId === currentUser.tenantId)
                .map(t => {
                  const rawAloc = (t as any).alocacoes;
                  let wasString = false;
                  let alocArray: any[] = [];

                  if (Array.isArray(rawAloc)) {
                    alocArray = rawAloc;
                  } else if (typeof rawAloc === 'string' && rawAloc.trim()) {
                    wasString = true;
                    try {
                      const parsed = JSON.parse(rawAloc);
                      alocArray = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      alocArray = [];
                    }
                  } else {
                    alocArray = [];
                  }

                  const normalizeId = (v: any) => String(v || '').trim().toLowerCase();
                  const targetId = normalizeId(id);

                  // Filtra removendo qualquer item cujo recursoId (ou ID direto) seja igual ao ID excluído
                  const filtered = alocArray.filter((item: any) => {
                    if (typeof item === 'string') {
                      return normalizeId(item) !== targetId;
                    }
                    if (item && typeof item === 'object') {
                      const candidate =
                        item.recursoId ??
                        item.resourceId ??
                        item.recurso_id ??
                        item.resource_id ??
                        item.id ??
                        item.userId ??
                        item.user_id ??
                        item.usuarioId ??
                        item.usuario_id;
                      return normalizeId(candidate) !== targetId;
                    }
                    return true;
                  });

                  if (wasString) {
                    // Se originalmente era string, mantém como string
                    return { ...t, alocacoes: JSON.stringify(filtered) } as unknown as Task;
                  }
                  // Caso padrão: mantém array (objetos ou strings)
                  return { ...t, alocacoes: filtered } as Task;
                });

              return [...otherTenantsTasks, ...updatedTenantTasks];
            });
          }} 
        />
      );
      case 'config': return <ProfileView plansConfig={plansConfig} user={currentUser} onUpdateUser={setCurrentUser} tenant={tenantForUI} onUpdateTenant={(t) => setTenants(prev => prev.map(item => item.id === t.id ? t : item))} allUsers={tenantUsers} onUpdateUsers={(updatedTenantUsers) => { const otherUsers = allUsers.filter(u => u.tenantId !== currentUser.tenantId); setAllUsers([...otherUsers, ...updatedTenantUsers]); }} globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} />;
      case 'audit': return <AuditView />;
      default: return <Dashboard projects={tenantProjects} tasks={tenantTasks} resources={tenantResources} dailyLogs={tenantLogs} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} globalConfig={globalConfig} />;
  }

  // Trava de Licença Expirada (Restaurada do Backup)
  if (activeTenant && activeTenant.status === LicenseStatus.EXPIRADA && currentUser.role !== Role.SUPERADMIN) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0f172a] text-white p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-red-500 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-red-500/20">
            <AlertCircle size={48} className="text-white" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter uppercase">Acesso Bloqueado</h1>
            <p className="text-slate-400 font-medium">A licença de uso da <span className="text-white font-black">{activeTenant.nome}</span> expirou em {new Date(activeTenant.dataFimLicenca).toLocaleDateString()}.</p>
          </div>
          <div className="space-y-4">
            <a href="https://wa.me/5511999999999" className="w-full py-5 bg-white text-slate-900 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-105 transition-all">
              Falar com Financeiro <MessageSquare size={18} />
            </a>
            <button onClick={handleLogout} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors">Voltar para Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={currentUser} 
        tenant={tenantForUI} 
        planFeatures={activePlanFeatures} 
        globalConfig={globalConfig} 
        onLogout={handleLogout} 
        onOpenUpgrade={openUpgrade}
        syncStatus={syncStatus}
        queueSize={dataSyncService.getQueueSize()}
      >
        {renderContent()}
      </Layout>
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} activeTenant={tenantForUI} />
      <Toaster position="bottom-right" richColors closeButton />
      
      {/* Sistema de Notificações */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <div className={`
            px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-md
            ${notification.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${notification.type === 'warning' ? 'bg-yellow-500 text-slate-900' : ''}
            ${notification.type === 'error' ? 'bg-red-500 text-white' : ''}
          `}>
            {notification.type === 'success' && <CheckCircle size={20} />}
            {notification.type === 'warning' && <Clock size={20} />}
            {notification.type === 'error' && <AlertCircle size={20} />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay durante carregamento inicial */}
      {isLoadingData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4">
            <Clock size={48} className="animate-spin text-blue-500" />
            <p className="text-lg font-semibold">Carregando dados...</p>
            <p className="text-sm text-gray-500">Sincronizando com servidor</p>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
