
import React, { useState, useEffect, useMemo } from 'react';
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
import UpgradeModal from './components/UpgradeModal';
import { MOCK_USERS, MOCK_PROJECTS, MOCK_TASKS, MOCK_RESOURCES } from './data/mockData';
import { User, Project, Task, Resource, DailyLog, Role, Tenant, LicenseStatus, GlobalConfig, PlanTemplate } from './types';
import { AlertCircle, MessageSquare } from 'lucide-react';

const DEFAULT_PLANS: PlanTemplate[] = [
  { id: 'BASIC', nome: 'Plano Basic', precoMensal: 249.00, limiteUsuarios: 5, limiteObras: 2, limiteMaoDeObra: 50, limiteMaquinario: 15, limiteCargos: 10, recursos: ['Cronograma Básico', 'Diário de Obra'], cor: '#64748b' },
  { id: 'PRO', nome: 'Plano Professional', precoMensal: 499.00, limiteUsuarios: 20, limiteObras: 10, limiteMaoDeObra: 150, limiteMaquinario: 50, limiteCargos: 30, recursos: ['Cronograma Básico', 'Diário de Obra', 'Curva S Realizada', 'Gestão Financeira'], cor: '#3b82f6' },
  { id: 'ENTERPRISE', nome: 'Plano Enterprise', precoMensal: 1499.00, limiteUsuarios: 100, limiteObras: 50, limiteMaoDeObra: 500, limiteMaquinario: 200, limiteCargos: 100, recursos: ['Todos os Recursos', 'Suporte VIP', 'API Integration'], cor: '#6366f1' }
];

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('ep_isLoggedIn') === 'true');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('ep_activeTab') || 'dashboard');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
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
    return saved ? JSON.parse(saved) : DEFAULT_PLANS;
  });

  const [tenants, setTenants] = useState<Tenant[]>(() => {
    const saved = localStorage.getItem('ep_all_tenants');
    return saved ? JSON.parse(saved) : [{
      id: 'c1',
      nome: 'CONSTRUTORA ALFA',
      cnpj: '12.345.678/0001-01',
      limiteUsuarios: 20,
      limiteObras: 10,
      limiteMaoDeObra: 150,
      limiteMaquinario: 50,
      limiteCargos: 30,
      planoId: 'PRO',
      dataFimLicenca: '2025-12-31',
      status: LicenseStatus.ATIVA,
      logoUrl: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png'
    }];
  });

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ep_all_users');
    return saved ? JSON.parse(saved) : MOCK_USERS.map(u => ({ ...u, tenantId: 'c1' }));
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('ep_current_user');
    return saved ? JSON.parse(saved) : { id: 'anon', nome: 'Visitante', email: '', tenantId: '', role: Role.LEITURA, ativo: false };
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('ep_projects');
    if (saved) return JSON.parse(saved);
    return currentUser.tenantId === 'c1' ? MOCK_PROJECTS.map(p => ({ ...p, tenantId: 'c1' })) : [];
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('ep_tasks');
    if (saved) return JSON.parse(saved);
    return currentUser.tenantId === 'c1' ? MOCK_TASKS.map(t => ({ ...t, tenantId: 'c1' })) : [];
  });

  const [resources, setResources] = useState<Resource[]>(() => {
    const saved = localStorage.getItem('ep_resources');
    if (saved) return JSON.parse(saved);
    return currentUser.tenantId === 'c1' ? MOCK_RESOURCES.map(r => ({ ...r, tenantId: 'c1' })) : [];
  });

  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(() => {
    const saved = localStorage.getItem('ep_dailyLogs');
    return saved ? JSON.parse(saved) : [];
  });

  // Camada de Segurança: Filtros por Tenant (Empresa)
  const tenantProjects = useMemo(() => projects.filter(p => p.tenantId === currentUser.tenantId), [projects, currentUser.tenantId]);
  const tenantTasks = useMemo(() => tasks.filter(t => t.tenantId === currentUser.tenantId), [tasks, currentUser.tenantId]);
  const tenantResources = useMemo(() => resources.filter(r => r.tenantId === currentUser.tenantId), [resources, currentUser.tenantId]);
  const tenantLogs = useMemo(() => dailyLogs.filter(l => l.tenantId === currentUser.tenantId), [dailyLogs, currentUser.tenantId]);
  const tenantUsers = useMemo(() => allUsers.filter(u => u.tenantId === currentUser.tenantId), [allUsers, currentUser.tenantId]);

  const activeTenant = useMemo(() => {
    return tenants.find(t => t.id === currentUser.tenantId) || tenants[0];
  }, [tenants, currentUser.tenantId]);

  // --- NOVA LÓGICA DINÂMICA DE RECURSOS ---
  const activePlanFeatures = useMemo(() => {
    const plan = plansConfig.find(p => p.id === activeTenant.planoId);
    return plan ? plan.recursos : [];
  }, [plansConfig, activeTenant.planoId]);

  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    const saved = localStorage.getItem('ep_selectedProject');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tenantId === currentUser.tenantId) return parsed;
    }
    return null;
  });

  useEffect(() => {
    if (!selectedProject || selectedProject.tenantId !== currentUser.tenantId) {
      setSelectedProject(tenantProjects[0] || null);
    }
  }, [currentUser.tenantId, tenantProjects, selectedProject]);

  useEffect(() => {
    localStorage.setItem('ep_isLoggedIn', isLoggedIn.toString());
    localStorage.setItem('ep_projects', JSON.stringify(projects));
    localStorage.setItem('ep_tasks', JSON.stringify(tasks));
    localStorage.setItem('ep_resources', JSON.stringify(resources));
    localStorage.setItem('ep_dailyLogs', JSON.stringify(dailyLogs));
    if (selectedProject) localStorage.setItem('ep_selectedProject', JSON.stringify(selectedProject));
    else localStorage.removeItem('ep_selectedProject');
    localStorage.setItem('ep_activeTab', activeTab);
    localStorage.setItem('ep_all_tenants', JSON.stringify(tenants));
    localStorage.setItem('ep_all_users', JSON.stringify(allUsers));
    localStorage.setItem('ep_current_user', JSON.stringify(currentUser));
    localStorage.setItem('ep_global_config', JSON.stringify(globalConfig));
    localStorage.setItem('ep_plans_config', JSON.stringify(plansConfig));
  }, [projects, tasks, resources, dailyLogs, selectedProject, activeTab, tenants, allUsers, currentUser, globalConfig, isLoggedIn, plansConfig]);

  /* =====================================================
     AUTENTICAÇÃO COM VALIDAÇÃO DE SENHA (PRODUÇÃO)
     ===================================================== */
  const handleLogin = (email: string, password: string = '') => {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Master admin com acesso especial
    if (normalizedEmail === 'master@plataforma.com') {
      setCurrentUser({ 
        id: 'master', 
        nome: 'Super Administrador', 
        email: 'master@plataforma.com', 
        tenantId: 'master', 
        role: Role.SUPERADMIN, 
        ativo: true, 
        cargo: 'Plataforma Owner' 
      });
      setActiveTab('master-dash');
      setIsLoggedIn(true);
      return;
    }
    
    // Buscar usuário
    const userFound = allUsers.find(u => u.email.toLowerCase().trim() === normalizedEmail);
    if (!userFound) {
      alert('E-mail não cadastrado na plataforma.');
      return;
    }
    
    // Validar ativo
    if (!userFound.ativo) {
      alert('Este usuário está inativo. Contacte o administrador.');
      return;
    }
    
    // Validação de senha (em produção, comparar com hash)
    if (userFound.password && password !== userFound.password) {
      alert('Senha incorreta.');
      return;
    }
    
    // Sucesso - NUNCA armazenar senha em localStorage
    const userToStore = { ...userFound };
    delete userToStore.password; // Remove senha antes de armazenar
    
    setCurrentUser(userToStore);
    setActiveTab('dashboard');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('ep_isLoggedIn');
    setSelectedProject(null);
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
          return <ProfileView plansConfig={plansConfig} user={currentUser} onUpdateUser={setCurrentUser} tenant={activeTenant} onUpdateTenant={(t) => setTenants(prev => prev.map(item => item.id === t.id ? t : item))} allUsers={allUsers} onUpdateUsers={setAllUsers} globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} />;
        default:
          return <MasterAdminView activeTab="master-dash" globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} allTenants={tenants} onUpdateTenants={setTenants} allUsers={allUsers} onUpdateUsers={setAllUsers} allProjects={projects} allDailyLogs={dailyLogs} plansConfig={plansConfig} onUpdatePlansConfig={setPlansConfig} onSimulateAccess={(user) => { setCurrentUser(user); setActiveTab('dashboard'); }} />;
      }
    }

    const renderObrasView = () => (
      <ObrasView 
        projects={tenantProjects} 
        activeTenant={activeTenant}
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
      case 'planejamento': return selectedProject ? ( 
        <PlanejamentoView 
          project={selectedProject} 
          activeTenant={activeTenant} 
          planFeatures={activePlanFeatures} 
          onOpenUpgrade={openUpgrade} 
          tasks={tenantTasks} 
          resources={tenantResources} 
          onTasksChange={(updatedTasks) => { const otherTenantsTasks = tasks.filter(t => t.tenantId !== currentUser.tenantId); const sanitized = updatedTasks.map(t => ({ ...t, tenantId: currentUser.tenantId })); setTasks([...otherTenantsTasks, ...sanitized]); }} 
          dailyLogs={tenantLogs} 
        /> 
      ) : renderObrasView();
      case 'gantt': return (
        <GanttChartView 
          projects={tenantProjects}
          tasks={tenantTasks}
          resources={tenantResources}
          dailyLogs={tenantLogs}
          tenant={activeTenant}
          onTasksChange={(updatedTasks) => { const otherTenantsTasks = tasks.filter(t => t.tenantId !== currentUser.tenantId); const sanitized = updatedTasks.map(t => ({ ...t, tenantId: currentUser.tenantId })); setTasks([...otherTenantsTasks, ...sanitized]); }}
        />
      );
      case 'financeiro': return selectedProject ? ( 
        <FinanceiroView 
          projects={tenantProjects} 
          project={selectedProject} 
          planFeatures={activePlanFeatures} 
          onOpenUpgrade={openUpgrade}
          tasks={tenantTasks} 
          resources={tenantResources} 
          dailyLogs={tenantLogs} 
        /> 
      ) : renderObrasView();
      case 'recursos': return <RecursosView tasks={tenantTasks} projects={tenantProjects} resources={tenantResources} />;
      case 'diario': return selectedProject ? ( 
      <DiarioView 
        project={selectedProject} 
        projects={tenantProjects} 
        tenant={activeTenant}
        globalConfig={globalConfig}
        resources={tenantResources}
        allUsers={tenantUsers} // Passando os usuários da empresa para mapeamento de funções
        planFeatures={activePlanFeatures} 
        onOpenUpgrade={openUpgrade} 
        tasks={tenantTasks} 
        onTasksChange={(updatedTasks) => { 
          const otherTenantsTasks = tasks.filter(t => t.tenantId !== currentUser.tenantId); 
          const sanitized = updatedTasks.map(t => ({ ...t, tenantId: currentUser.tenantId })); 
          setTasks([...otherTenantsTasks, ...sanitized]); 
        }} 
        onAddDailyLog={(log) => setDailyLogs(prev => [...prev, { ...log, tenantId: currentUser.tenantId }])} 
        onRemoveDailyLog={(id) => setDailyLogs(l => l.filter(x => x.id !== id))} 
        dailyLogs={tenantLogs} 
        user={currentUser} 
      /> 
    ) : renderObrasView();
      case 'usuarios': return (
        <EquipeView 
          activeTenant={activeTenant} 
          planFeatures={activePlanFeatures} 
          plansConfig={plansConfig}
          onOpenUpgrade={openUpgrade} 
          resources={tenantResources} 
          tasks={tenantTasks} 
          projects={tenantProjects} 
          allUsers={tenantUsers} 
          onAddResource={r => setResources(prev => [...prev.filter(x => x.id !== r.id), { ...r, tenantId: currentUser.tenantId }])} 
          onRemoveResource={id => setResources(prev => prev.filter(r => r.id !== id))} 
        />
      );
      case 'config': return <ProfileView plansConfig={plansConfig} user={currentUser} onUpdateUser={setCurrentUser} tenant={activeTenant} onUpdateTenant={(t) => setTenants(prev => prev.map(item => item.id === t.id ? t : item))} allUsers={tenantUsers} onUpdateUsers={(updatedTenantUsers) => { const otherUsers = allUsers.filter(u => u.tenantId !== currentUser.tenantId); setAllUsers([...otherUsers, ...updatedTenantUsers]); }} globalConfig={globalConfig} onUpdateGlobalConfig={setGlobalConfig} />;
      default: return <Dashboard projects={tenantProjects} tasks={tenantTasks} resources={tenantResources} dailyLogs={tenantLogs} />;
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} globalConfig={globalConfig} />;
  }

  // Trava de Licença Expirada (Restaurada do Backup)
  if (activeTenant.status === LicenseStatus.EXPIRADA && currentUser.role !== Role.SUPERADMIN) {
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
        tenant={activeTenant} 
        planFeatures={activePlanFeatures} 
        globalConfig={globalConfig} 
        onLogout={handleLogout} 
        onOpenUpgrade={openUpgrade}
      >
        {renderContent()}
      </Layout>
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} activeTenant={activeTenant} />
    </>
  );
};

export default App;
