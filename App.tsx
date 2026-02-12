
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
import ModernLoading from './components/ModernLoading';
import ConfirmationDialog from './components/ConfirmationDialog';
import { useConfirmation } from './hooks/useConfirmation';
import { User, Project, Task, Resource, DailyLog, Role, Tenant, LicenseStatus, GlobalConfig, PlanTemplate } from './types';
import { AlertCircle, MessageSquare, Wifi, WifiOff } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { dataSyncService } from './services/dataService';
import { DataSyncService } from './services/dataService';
import { authService } from './services/authService';
import { permissionManager } from './services/permissionManager';
import { TenantGuard, useTenantGuard } from './src/middleware/tenantGuard';

/**
 * ==========================================
 * ESTRATÉGIA DE SEGURANÇA - ROLE PERSISTENCE
 * ==========================================
 * 
 * PROBLEMA RESOLVIDO: Refresh (F5) causava "Acesso Negado" para SUPERADMIN
 * 
 * SOLUÇÃO IMPLEMENTADA (Multi-camada):
 * 
 * 1. FAIL-SAFE CACHE (localStorage):
 *    - Salva role/id no localStorage apenas como CACHE TEMPORÁRIO
 *    - Usado APENAS para evitar race condition durante refresh
 *    - NUNCA usado como fonte de verdade para autenticação
 * 
 * 2. VALIDAÇÃO OBRIGATÓRIA (Supabase):
 *    - Todo acesso valida JWT via authService.getCurrentUser()
 *    - Cache é descartado se sessão não validar
 *    - Logout limpa cache automaticamente
 * 
 * 3. AUTH GUARD REFORÇADO:
 *    - Aguarda role estar definida antes de renderizar
 *    - Limpa cache de permissões no refresh (permissionManager.clearCache())
 *    - ModernLoading visível até validação completa
 * 
 * 4. MENUS GARANTIDOS:
 *    - Layout.tsx força visibilidade de 'config' e 'audit' para SUPERADMIN
 *    - Independente de canViewSettings (que pode ter cache sujo)
 * 
 * SEGURANÇA MANTIDA:
 * - Cache não pode ser injetado via DevTools (validação JWT obrigatória)
 * - Sessão inválida = logout automático
 * - Tenant Guard continua validando todas as operações RLS
 */

const App: React.FC = () => {
  // PILAR 3: Autenticação agora vem do Supabase Auth, não do localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('ep_activeTab') || 'dashboard');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Hook de confirmação customizado
  const confirmation = useConfirmation();
  
  // Estados de sincronização
  const [syncStatus, setSyncStatus] = useState<'online' | 'offline' | 'syncing'>('offline');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // 🎨 ANTI-FLICKER: Inicializar com valores vazios para evitar 'ghost branding' (ex: PROJEX MASTER)
  // Valores reais serão carregados do banco ANTES de authInitialized=true
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>(() => {
    const saved = localStorage.getItem('ep_global_config');
    return saved ? JSON.parse(saved) : {
      softwareName: '',
      systemLogoUrl: '',
      primaryColor: '#3b82f6'
    };
  });
  
  // 🔒 BRANDING READY: Flag para garantir que branding foi carregado antes de mostrar UI
  const [brandingReady, setBrandingReady] = useState(false);
  
  // 🖼️ LOGIN IMAGE PRELOADED: Flag para garantir que imagem de fundo foi precarregada
  const [loginImagePreloaded, setLoginImagePreloaded] = useState(false);
  
  // ✅ LOGIN READY: Combinação de branding + imagem = RevElação da LoginView
  const loginReady = brandingReady && loginImagePreloaded;

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
      console.log('🚀 [App] Iniciando inicialização do sistema...');
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('🔑 [App] Supabase URL:', supabaseUrl ? 'Configurado' : '❌ AUSENTE');
      console.log('🔑 [App] Supabase Key:', supabaseKey ? 'Configurado' : '❌ AUSENTE');

      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ [App] Supabase não configurado! Sistema ficará offline.');
        setSyncStatus('offline');
        setAuthInitialized(true);
        loadFromLocalStorage();
        return;
      }

      console.log('🔧 [App] Inicializando authService...');
      const authInit = authService.initialize(supabaseUrl, supabaseKey);
      console.log('🔧 [App] authService inicializado:', authInit ? '✅' : '❌');
      
      console.log('🔧 [App] Inicializando DataSyncService...');
      const dataInit = DataSyncService.initialize(supabaseUrl, supabaseKey);
      console.log('🔧 [App] DataSyncService inicializado:', dataInit ? '✅' : '❌');
      
      // Obter instância singleton para uso posterior
      const dataSyncInstance = DataSyncService.getInstance();
      
      // Registrar callback de erro de permissão
      dataSyncInstance.setPermissionErrorCallback((message) => {
        toast.error(message);
      });
      
      if (!authInit || !dataInit) {
        console.error('❌ [App] Falha na inicialização! Sistema ficará offline.');
        setSyncStatus('offline');
        setAuthInitialized(true);
        loadFromLocalStorage();
        return;
      }

      // Inicializar tenant guard para validações de segurança
      const supabaseClient = dataSyncService.getSupabaseClient();
      console.log('🔧 [App] Supabase client obtido:', supabaseClient ? '✅' : '❌');
      
      if (supabaseClient) {
        tenantGuardRef.current = new TenantGuard(supabaseClient);
      }

      setSyncStatus('online');
      console.log('✅ [App] Sistema ONLINE! Iniciando carregamento de branding...');

      // 🎨 PRIORIDADE 1: Carregar BRANDING primeiro (anti-flicker)
      // Configurar marca/cores ANTES de authInitialized=true para evitar flashes
      await loadGlobalConfigFromSupabase();
      
      // PRIORIDADE 2: Carregar templates de planos
      await loadPlanTemplatesFromSupabase();
      
      // Carregar fila de sincronização pendente
      dataSyncService.loadQueueFromStorage();

      // PRIORIDADE 3: Verificar sessão existente (PILAR 3)
      const session = await authService.getSession();
      if (session) {
        const user = await authService.getCurrentUser();
        if (user && user.ativo) {
          setCurrentUser(user);
          setIsLoggedIn(true);
          
          // 🔒 SEGURANÇA: Cache de role REMOVIDO - sempre validar via JWT/authService
          // Limpar cache antigo de permissões (força revalidação)
          permissionManager.clearCache();
          
          // � PILAR 4: Inicializar Permission Manager com credenciais atuais
          if (user.tenantId && supabaseClient) {
            permissionManager.initialize(supabaseClient, user.tenantId, user.role);
          }
          
          // �🔑 PRIORIDADE 4: Carregar dados conforme role
          if (user.role === Role.SUPERADMIN) {
            // SUPERADMIN: Carregar TODOS os tenants para Gestão de Empresas
            const allTenantsData = await dataSyncService.loadAllTenants();
            setTenants(allTenantsData);
            const allUsersData = await dataSyncService.loadAllUsers();
            setAllUsers(allUsersData);
          } else if (user.tenantId) {
            // User regular: Carregar dados do seu tenant
            await loadDataFromSupabase();
          }
        }
      } else {
        // 🔒 SEGURANÇA: Cache de role REMOVIDO - sempre validar via JWT/authService
        // Sem sessão: manter usuário anônimo até validação completa
        setCurrentUser({
          id: 'anon',
          nome: 'Visitante',
          email: '',
          tenantId: '',
          role: Role.LEITURA,
          ativo: false
        });
      }

      // ✅ authInitialized=true APENAS APÓS branding + dados carregados
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
      if (event === 'SIGNED_IN' && session) {
        const user = await authService.getCurrentUser();
        if (user && user.ativo) {
          setCurrentUser(user);
          setIsLoggedIn(true);
          toast.success('✅ Login realizado com sucesso!');
          
          // 🔒 SEGURANÇA: Cache de role REMOVIDO - sempre validar via JWT/authService
          // PILAR 4: Limpar cache antigo e reinicializar Permission Manager
          permissionManager.clearCache();
          const supabaseClient = dataSyncService.getSupabaseClient();
          if (user.tenantId && supabaseClient) {
            permissionManager.initialize(supabaseClient, user.tenantId, user.role);
          }
          
          // Carregar dados conforme role
          if (user.role === Role.SUPERADMIN) {
            // SUPERADMIN: Carregar TODOS os tenants para Gestão de Empresas
            const allTenantsData = await dataSyncService.loadAllTenants();
            setTenants(allTenantsData);
            const allUsersData = await dataSyncService.loadAllUsers();
            setAllUsers(allUsersData);
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
        toast.success('Logout realizado');
        
        // 🔒 SEGURANÇA: Cache de role REMOVIDO - Permission Manager usa apenas JWT
        permissionManager.clearCache();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [authInitialized]);

  // =====================================================
  // SINCRONIZAÇÃO DE ROLE E RESET DE TAB (AGRESSIVA)
  // =====================================================
  useEffect(() => {
    if (!authInitialized || !isLoggedIn || !currentUser.id || currentUser.id === 'anon') return;

    const isSuperAdmin = currentUser.role === Role.SUPERADMIN;
    const isCommonUser = currentUser.role !== Role.SUPERADMIN;

    // MODO AGRESSIVO: Se SUPERADMIN, sempre force master-dash
    // Exceto se a tab atual for explicitamente SUPERADMIN
    const superadminTabs = ['master-dash', 'tenants', 'users', 'subscriptions', 'system-branding', 'payments', 'config', 'audit'];
    if (isSuperAdmin && !superadminTabs.includes(activeTab)) {
      setActiveTab('master-dash');
      localStorage.setItem('ep_activeTab', 'master-dash');
      // Limpar localStorage de dados de tenant comum para evitar vazamento
      localStorage.removeItem('ep_selectedProject');
    }

    // Se usuário comum mas tab é admin-only, reset para dashboard
    if (isCommonUser && activeTab === 'master-dash') {
      setActiveTab('dashboard');
      localStorage.setItem('ep_activeTab', 'dashboard');
    }
  }, [authInitialized, isLoggedIn, currentUser.role, currentUser.id, activeTab]);

  const loadPlanTemplatesFromSupabase = async () => {
    try {
      const templates = await dataSyncService.loadPlanTemplates();
      if (templates.length) {
        setPlansConfig(templates);
        localStorage.setItem('ep_plans_config', JSON.stringify(templates));
      }
    } catch (error) {
      }
  };

  const loadGlobalConfigFromSupabase = async () => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 segundo
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`🔍 [App] Tentativa ${attempt}/${MAX_RETRIES} - Carregando branding do banco...`);
        
        const config = await dataSyncService.loadGlobalConfig();
        
        console.log('🔍 [App] Config retornado:', config);
        console.log('🔍 [App] softwareName:', config?.softwareName);
        console.log('🔍 [App] softwareName tipo:', typeof config?.softwareName);
        console.log('🔍 [App] softwareName length:', config?.softwareName?.length);
        
        if (config) {
          // ✅ ACEITAR qualquer config que retornar do banco (mesmo se campos vazios)
          console.log('✅ [App] Config válido retornado do banco, aplicando...');
          
          setGlobalConfig(config);
          localStorage.setItem('ep_global_config', JSON.stringify(config));
          
          // Aplicar primaryColor ao CSS root
          if (config.primaryColor) {
            document.documentElement.style.setProperty('--primary-color', config.primaryColor);
          }
          
          console.log('✅ [App] Branding aplicado:', {
            nome: config.softwareName || '(vazio)',
            cor: config.primaryColor,
            logo: config.systemLogoUrl ? 'Sim' : 'Não'
          });
          
          setBrandingReady(true);
          return; // ✅ Sucesso, sair da função
        } else {
          // ⚠️ Config retornou NULL
          console.warn(`⚠️ [App] Tentativa ${attempt} - loadGlobalConfig retornou NULL`);
          
          if (attempt < MAX_RETRIES) {
            console.log(`🔄 [App] Aguardando ${RETRY_DELAY}ms antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            continue; // Tentar novamente
          }
        }
      } catch (error) {
        console.error(`❌ [App] Tentativa ${attempt} - Erro ao carregar branding:`, error);
        
        if (attempt < MAX_RETRIES) {
          console.log(`🔄 [App] Aguardando ${RETRY_DELAY}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          continue; // Tentar novamente
        }
      }
    }
    
    // 🚨 FALHA APÓS TODAS AS TENTATIVAS
    console.error('🚨 [App] FALHA CRÍTICA: Não foi possível carregar branding do banco após 3 tentativas!');
    console.error('🚨 [App] loadGlobalConfig retornou NULL em todas as tentativas');
    console.error('🚨 [App] Verifique os logs [DataSync] acima para mais detalhes');
    
    // ⚠️ NÃO setar brandingReady(true) - sistema fica travado no ModernLoading
  };
  
  // 🖼️ PRELOAD DA IMAGEM DE FUNDO: Carregar em memória ANTES de revelar LoginView
  useEffect(() => {
    if (!brandingReady) return; // Só preload DEPOIS do branding estar pronto
    
    const imageUrl = globalConfig.loginBackgroundUrl || "https://images.unsplash.com/photo-1589492477543-e4f4c8ee3a7d?w=1200&h=1600&fit=crop&q=80";
    
    // Criar objeto Image para pré-carregar
    const img = new Image();
    
    img.onload = () => {
      console.log('✅ [App] Imagem de fundo precarregada com sucesso');
      setLoginImagePreloaded(true);
    };
    
    img.onerror = () => {
      console.warn('⚠️ [App] Erro ao precarregar imagem, continuando...');
      setLoginImagePreloaded(true); // Fail-safe: continuar mesmo com erro
    };
    
    console.log('🖼️ [App] Iniciando preload da imagem:', imageUrl);
    img.src = imageUrl;
  }, [brandingReady, globalConfig.loginBackgroundUrl]);

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
      toast.success('✅ Dados sincronizados com sucesso');
    } catch (error) {
      setSyncStatus('offline');
      toast.warning('⚠️ Erro ao carregar dados. Usando backup local.');
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

    // Validar session imediatamente
    const validateSession = async () => {
      const result = await tenantGuardRef.current!.validateCurrentUser();
      
      if (!result.isValid && result.shouldLogout) {
        toast.error(`⚠️ Sessão encerrada: ${result.error}`);
        
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
        toast.error('⚠️ Sessão encerrada por razões de segurança');
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
        await syncProjectsWithSupabase(projects);
      } catch (error) {
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
        await syncResourcesWithSupabase(resources);
      } catch (error) {
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
        await syncDailyLogsWithSupabase(dailyLogs);
      } catch (error) {
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

  // =====================================================
  // REAL-TIME LISTENERS (SUPABASE)
  // =====================================================
  useEffect(() => {
    // BLOQUEIO: Não executar Realtime para SUPERADMIN
    if (currentUser.role === Role.SUPERADMIN) {
      return;
    }

    if (!isLoggedIn || !currentUser.tenantId || currentUser.tenantId === 'master') {
      return;
    }

    if (!dataSyncService.isAvailable()) {
      return;
    }

    // Listener para Tasks
    dataSyncService.setupRealtimeListener(currentUser.tenantId, 'tasks', (payload) => {
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
  }, [isLoggedIn, currentUser.tenantId, currentUser.role]);

  // =====================================================
  // FUNÇÕES DE SINCRONIZAÇÃO COM SUPABASE
  // =====================================================
  const syncTasksWithSupabase = async (updatedTasks: Task[]) => {
    if (!dataSyncService.isAvailable()) {
      toast.warning('⚠️ Offline - Salvando localmente');
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.bulkSyncTasks(updatedTasks, currentUser.id, currentUser.tenantId);

      if (idConversions.size > 0) {
        setTasks(prev => prev.map(t => {
          const newId = idConversions.get(t.id);
          return newId ? { ...t, id: newId } : t;
        }));
      }
      setSyncStatus('online');
    } catch (error) {
      setSyncStatus('offline');
      toast.warning('⚠️ Dados salvos localmente. Sincronizando quando online...');
    }
  };

  const syncProjectsWithSupabase = async (updatedProjects: Project[]) => {
    if (!dataSyncService.isAvailable()) {
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.syncProjects(updatedProjects, currentUser.id, currentUser.tenantId);
      
      // Atualizar IDs temporários para UUIDs reais no estado local
      if (idConversions.size > 0) {
        setProjects(prev => prev.map(p => {
          const newId = idConversions.get(p.id);
          return newId ? { ...p, id: newId } : p;
        }));
      }
      
      setSyncStatus('online');
    } catch (error: any) {
      setSyncStatus('offline');
      toast.warning(`⚠️ Erro ao sincronizar: ${error.message || 'Dados salvos localmente'}`);
    }
  };

  const syncResourcesWithSupabase = async (updatedResources: Resource[]) => {
    if (!dataSyncService.isAvailable()) {
      toast.warning('⚠️ Offline - Salvando localmente');
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.syncResources(updatedResources, currentUser.id, currentUser.tenantId);

      if (idConversions.size > 0) {
        setResources(prev => prev.map(r => {
          const newId = idConversions.get(r.id);
          return newId ? { ...r, id: newId } : r;
        }));
      }
      setSyncStatus('online');
    } catch (error) {
      setSyncStatus('offline');
      toast.warning('⚠️ Dados salvos localmente. Sincronizando quando online...');
    }
  };

  const syncDailyLogsWithSupabase = async (updatedLogs: DailyLog[]) => {
    if (!dataSyncService.isAvailable()) {
      toast.warning('⚠️ Offline - Salvando localmente');
      return;
    }

    setSyncStatus('syncing');
    try {
      const idConversions = await dataSyncService.syncDailyLogs(updatedLogs, currentUser.id, currentUser.tenantId);

      if (idConversions.size > 0) {
        setDailyLogs(prev => prev.map(l => {
          const newId = idConversions.get(l.id);
          return newId ? { ...l, id: newId } : l;
        }));
      }
      setSyncStatus('online');
    } catch (error) {
      setSyncStatus('offline');
      toast.warning('⚠️ Dados salvos localmente. Sincronizando quando online...');
    }
  };

  /* =====================================================
     AUTENTICAÇÃO 100% DELEGADA AO SUPABASE (PILAR 3)
     ===================================================== */
  // =====================================================
  // HANDLERS DE AUTENTICAÇÃO (PILAR 3)
  // =====================================================
  
  const handleLogin = async (email: string, password: string = '') => {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!password) {
      toast.error('⚠️ Senha é obrigatória');
      return;
    }
    
    // PILAR 3: Login real via Supabase Auth
    // Delega 100% ao authService - valida credenciais, busca dados do banco
    // O listener onAuthStateChange (linha 277) injeta automaticamente o usuário correto
    const result = await authService.login({ email: normalizedEmail, password });
    
    if (!result.success) {
      toast.error(result.error || 'Erro ao fazer login');
      return;
    }
    
    // Sucesso: onAuthStateChange já atualizou currentUser com dados do banco
    toast.success('✅ Login realizado com sucesso!');
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
        onRemoveProject={async (id) => {
          const project = projects.find(p => p.id === id);
          const projectName = project?.nome || 'projeto';
          
          // Abrir modal de confirmação customizado
          const confirmed = await confirmation.confirm({
            title: 'Excluir Projeto',
            message: `Tem certeza que deseja excluir permanentemente "${projectName}"?`,
            details: [
              'O projeto/obra será removido',
              'Todas as tarefas planejadas',
              'Diários de obra relacionados',
              'Cronogramas e dependências',
              'Histórico de progressão'
            ],
            type: 'danger',
            confirmText: 'Sim, excluir projeto',
            cancelText: 'Cancelar'
          });

          if (!confirmed) return;

          const loadingToast = toast.loading('Excluindo projeto...');

          try {
            // 1. Chamar banco de dados para exclusão (cascade remove tasks)
            await dataSyncService.deleteProject(id, currentUser.tenantId);
            
            // 2. Atualizar UI após sucesso
            setProjects(p => p.filter(x => x.id !== id));
            setDailyLogs(logs => logs.filter(l => l.obraId !== id));
            if (selectedProject?.id === id) {
              setSelectedProject(null);
            }
            
            toast.dismiss(loadingToast);
            toast.success(`✅ ${projectName} excluído com sucesso!`);
          } catch (error) {
            console.error('❌ Erro ao excluir projeto:', error);
            toast.dismiss(loadingToast);
            toast.error('❌ Erro ao excluir projeto', {
              description: error instanceof Error ? error.message : 'Tente novamente.'
            });
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
        onRemoveDailyLog={async (id) => {
          const log = dailyLogs.find(l => l.id === id);
          const logDate = log?.data ? new Date(log.data).toLocaleDateString('pt-BR') : 'diário';
          
          const confirmed = await confirmation.confirm({
            title: 'Excluir Diário de Obra',
            message: `Tem certeza que deseja excluir o diário de ${logDate}?`,
            details: [
              'Registro completo do dia',
              'Fotos e anexos',
              'Observações e anotações',
              'Clima e condições registradas'
            ],
            type: 'danger',
            confirmText: 'Sim, excluir diário',
            cancelText: 'Cancelar'
          });

          if (!confirmed) return;

          const loadingToast = toast.loading('Excluindo diário...');

          try {
            await dataSyncService.deleteDailyLog(id, currentUser.tenantId);
            setDailyLogs(l => l.filter(x => x.id !== id));
            
            toast.dismiss(loadingToast);
            toast.success('✅ Diário de obra excluído!');
          } catch (error) {
            console.error('❌ Erro ao excluir diário:', error);
            toast.dismiss(loadingToast);
            toast.error('❌ Erro ao excluir diário', {
              description: 'Tente novamente.'
            });
          }
        }} 
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
          onRemoveResource={async (id) => {
            const resource = resources.find(r => r.id === id);
            const resourceName = resource?.nome || 'recurso';
            
            const confirmed = await confirmation.confirm({
              title: 'Excluir Recurso',
              message: `Tem certeza que deseja excluir "${resourceName}"?`,
              details: [
                'O recurso será removido permanentemente',
                'Alocações em tarefas serão removidas',
                'Histórico de utilização será perdido',
                'Relatórios e métricas serão impactados'
              ],
              type: 'danger',
              confirmText: 'Sim, excluir recurso',
              cancelText: 'Cancelar'
            });

            if (!confirmed) return;

            const loadingToast = toast.loading('Excluindo recurso...');

            try {
              // 1. Chamar banco de dados para exclusão
              await dataSyncService.deleteResource(id, currentUser.tenantId);
              
              // 2. Remover do estado local
              setResources(prev => prev.filter(r => r.id !== id));

              // 3. Limpeza em cascata nas tarefas (remover alocações vinculadas)
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
            
            // Sincronizar tarefas atualizadas
            const updatedTasksList = tasks.filter(t => t.tenantId === currentUser.tenantId);
            await syncTasksWithSupabase(updatedTasksList);
            
            toast.dismiss(loadingToast);
            toast.success(`✅ ${resourceName} excluído com sucesso!`);
          } catch (error) {
            console.error('❌ Erro ao excluir recurso:', error);
            toast.dismiss(loadingToast);
            toast.error('❌ Erro ao excluir recurso', {
              description: error instanceof Error ? error.message : 'Tente novamente.'
            });
          }
        }} 
        />
      );
      case 'config': return <ProfileView plansConfig={plansConfig} user={currentUser} onUpdateUser={setCurrentUser} tenant={tenantForUI} onUpdateTenant={(t) => setTenants(prev => prev.map(item => item.id === t.id ? t : item))} allUsers={tenantUsers} onUpdateUsers={(updatedTenantUsers) => { const otherUsers = allUsers.filter(u => u.tenantId !== currentUser.tenantId); setAllUsers([...otherUsers, ...updatedTenantUsers]); }} globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} />;
      case 'audit': return <AuditView />;
      default:
        // BLINDAGEM: Se SUPERADMIN, fallback obrigatório é MasterAdminView
        if (currentUser.role === Role.SUPERADMIN) {
          return <MasterAdminView activeTab="master-dash" globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} allTenants={tenants} onUpdateTenants={setTenants} allUsers={allUsers} onUpdateUsers={setAllUsers} allProjects={projects} allDailyLogs={dailyLogs} plansConfig={plansConfig} onUpdatePlansConfig={setPlansConfig} onSimulateAccess={(user) => { setCurrentUser(user); setActiveTab('dashboard'); }} />;
        }
        // Para usuário comum, fallback é Dashboard
        return <Dashboard projects={tenantProjects} tasks={tenantTasks} resources={tenantResources} dailyLogs={tenantLogs} />;
    }
  };

  // =====================================================
  // AUTH GUARD - Prevenir race condition no refresh
  // =====================================================
  // CRÍTICO: Aguardar role estar definida E dados carregados para evitar "Acesso Negado" no SUPERADMIN
  const isRoleLoaded = useMemo(() => {
    const hasValidUser = currentUser.id !== 'anon' && currentUser.role !== undefined;
    
    // Se não é SUPERADMIN, basta ter role válida
    if (hasValidUser && currentUser.role !== Role.SUPERADMIN) {
      return true;
    }
    
    // Se é SUPERADMIN, aguardar tenants carregados (previne activeTenant=null)
    if (hasValidUser && currentUser.role === Role.SUPERADMIN) {
      return tenants.length > 0;
    }
    
    return false;
  }, [currentUser.id, currentUser.role, tenants.length]);
  
  // 🛑 ESCUDO TOTAL: ModernLoading até branding + imagem estarem 100% prontos
  // Garante que usuário NUNCA vê valores vazios ou carregamento fragmentado
  if (!authInitialized || !loginReady || isLoadingData || (isLoggedIn && !isRoleLoaded)) {
    return (
      <>
        <ModernLoading globalConfig={globalConfig} />
        <Toaster position="bottom-right" richColors closeButton />
      </>
    );
  }

  if (!isLoggedIn) {
    // ✨ REVELAÇÃO: Agora sim, tudo pronto para revelar LoginView com fade-in
    return (
      <>
        <LoginView 
          onLogin={handleLogin} 
          globalConfig={globalConfig} 
          imagePreloaded={true}
          allUsers={allUsers}
          onUpdateUsers={setAllUsers}
        />
        <Toaster position="bottom-right" richColors closeButton />
      </>
    );
  }

  // Trava de Licença Expirada (Restaurada do Backup)
  if (activeTenant && activeTenant.status === LicenseStatus.EXPIRADA && currentUser.role !== Role.SUPERADMIN) {
    return (
      <>
        <div className="h-screen w-full flex items-center justify-center bg-[#0f172a] text-white p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
          <div className="w-24 h-24 bg-red-500 rounded-[32px] flex items-center justify-center mx-auto shadow-2xl shadow-red-500/20">
            <AlertCircle size={48} className="text-white" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter uppercase">Acesso Bloqueado</h1>
            <p className="text-slate-400 font-medium">
              A licença de uso da <span className="text-white font-black">{activeTenant.nome}</span> expirou em{' '}
              {activeTenant.dataFimLicenca && activeTenant.dataFimLicenca !== ''
                ? new Date(activeTenant.dataFimLicenca).toLocaleDateString()
                : 'data não disponível'
              }.
            </p>
          </div>
          <div className="space-y-4">
            <a href="https://wa.me/5511999999999" className="w-full py-5 bg-white text-slate-900 rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-105 transition-all">
              Falar com Financeiro <MessageSquare size={18} />
            </a>
            <button onClick={handleLogout} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors">Voltar para Login</button>
          </div>
        </div>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
      </>
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

      {/* Modal de Confirmação Customizado */}
      <ConfirmationDialog
        isOpen={confirmation.state.isOpen}
        onClose={confirmation.handleClose}
        onConfirm={confirmation.handleConfirm}
        title={confirmation.state.title}
        message={confirmation.state.message}
        details={confirmation.state.details}
        type={confirmation.state.type}
        confirmText={confirmation.state.confirmText}
        cancelText={confirmation.state.cancelText}
        isLoading={confirmation.state.isLoading}
      />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
};

export default App;
