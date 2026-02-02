import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  HardHat, 
  CalendarDays, 
  TrendingUp,
  LineChart, 
  BarChart3, 
  BookOpen, 
  Users, 
  Settings,
  LogOut,
  Building,
  Zap,
  ChevronLeft,
  ChevronRight,
  Globe,
  Building2,
  CreditCard,
  Palette,
  Lock,
  Wallet,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalConfig, Tenant, User, Role } from '../types';
import { usePermission } from '../hooks/usePermission';
import { Resource as PermissionResource, Action } from '../types/permissions';

// Interface de menu atualizada para suportar checagem dinâmica de recursos
interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  requiredFeature?: string; // Vincula o menu ao recurso do Master Admin
  role?: Role[];
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User;
  tenant: Tenant;
  planFeatures: string[]; // Recebe a lista dinâmica do App.tsx
  globalConfig: GlobalConfig;
  onLogout: () => void;
  onOpenUpgrade: () => void;
  syncStatus?: 'online' | 'offline' | 'syncing';
  queueSize?: number;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  user, 
  tenant, 
  planFeatures, 
  globalConfig, 
  onLogout, 
  onOpenUpgrade,
  syncStatus = 'offline',
  queueSize = 0 
}) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const { allowed: canViewSettings } = usePermission(PermissionResource.SETTINGS, Action.READ);
  const { allowed: canManageTenants } = usePermission(PermissionResource.TENANTS, Action.MANAGE);

  // Mapeamento dos Menus aos Recursos configuráveis no Master Admin
  const clientMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'obras', label: 'Projetos', icon: HardHat },
    { 
      id: 'planejamento', 
      label: 'Cronograma', 
      icon: CalendarDays, 
      requiredFeature: 'Cronograma Básico' 
    },
    { 
      id: 'gantt', 
      label: 'Gantt (CPM)', 
      icon: TrendingUp, 
      requiredFeature: 'Cronograma Básico' 
    },
    { 
      id: 'financeiro', 
      label: 'Financeiro', 
      icon: LineChart, 
      requiredFeature: 'Gestão Financeira' 
    },
    { id: 'recursos', label: 'Recursos', icon: BarChart3 },
    { 
      id: 'diario', 
      label: 'Diário (RDO)', 
      icon: BookOpen, 
      requiredFeature: 'Diário de Obra' 
    },
    { id: 'usuarios', label: 'Equipe', icon: Users, role: [Role.ADMIN] },
    { id: 'config', label: 'Ajustes', icon: Settings },
  ];

  const masterMenuItems: MenuItem[] = [
    { id: 'master-dash', label: 'Dashboard Global', icon: Globe },
    { id: 'tenants', label: 'Gestão de Empresas', icon: Building2 },
    { id: 'subscriptions', label: 'Licenciamento', icon: CreditCard },
    { id: 'payments', label: 'Pagamentos', icon: Wallet },
    { id: 'system-branding', label: 'Config. White-label', icon: Palette },
    { id: 'audit', label: 'Auditoria', icon: Shield },
    { id: 'config', label: 'Meu Perfil', icon: Settings },
  ];

  const filteredClientMenuItems = clientMenuItems.filter((item) => {
    // Config (Ajustes) sempre visível para todos os usuários autenticados
    if (item.id === 'config') return true;
    return true;
  });

  const filteredMasterMenuItems = masterMenuItems.filter((item) => {
    // Auditoria só para SUPERADMIN (sempre mostrar se for SUPERADMIN)
    if (item.id === 'audit' && user.role !== Role.SUPERADMIN) return false;
    // Config (Meu Perfil) sempre visível para SUPERADMIN
    if (item.id === 'config' && user.role !== Role.SUPERADMIN && !canViewSettings) return false;
    return true;
  });

  const menuItems = user.role === Role.SUPERADMIN
    ? filteredMasterMenuItems
    : filteredClientMenuItems;
  const primaryColor = globalConfig.primaryColor || '#3b82f6';

  // Lógica de clique atualizada para consultar a lista de recursos (planFeatures)
  const handleTabClick = (item: MenuItem) => {
    const isFeatureLocked = item.requiredFeature && 
                           !planFeatures.includes(item.requiredFeature) && 
                           user.role !== Role.SUPERADMIN;

    if (isFeatureLocked) {
      onOpenUpgrade();
      return;
    }
    setActiveTab(item.id);
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-['Inter'] relative text-slate-900">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-400/10 blur-[100px] rounded-full pointer-events-none"></div>

      <motion.aside 
        initial={false}
        animate={{ width: isSidebarExpanded ? 288 : 96 }}
        className="m-6 rounded-[32px] bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col z-50 overflow-hidden shrink-0 h-[calc(100vh-3rem)]"
      >
        <div className={`p-8 flex items-center shrink-0 ${isSidebarExpanded ? 'gap-3' : 'flex-col gap-4 justify-center'}`}>
          <button 
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            className="p-1 text-slate-500/50 hover:text-white transition-colors hover:bg-white/5 rounded-md shrink-0"
          >
            {isSidebarExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg relative group shrink-0 aspect-square overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
             <div className="absolute inset-0 blur-lg opacity-0 group-hover:opacity-40 transition-opacity" style={{ backgroundColor: primaryColor }}></div>
             {globalConfig.systemLogoUrl ? (
               <img src={globalConfig.systemLogoUrl} className="w-full h-full object-cover block relative z-10" alt="Logo" />
             ) : (
               <Zap className="text-white relative z-10" size={24} strokeWidth={3} />
             )}
          </div>
          
          {isSidebarExpanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate min-w-0 flex-1">
              <span className="font-black text-sm tracking-tighter bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent uppercase leading-none block truncate">
                {globalConfig.softwareName}
              </span>
              <p className="text-[9px] font-black text-white/30 tracking-[0.2em] uppercase mt-1 truncate">
                {user.role === Role.SUPERADMIN ? 'Master Console' : globalConfig.softwareSubtitle || 'Engineering Suite'}
              </p>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto scrollbar-hide flex flex-col">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            
            // Verificação dinâmica de bloqueio baseada na lista de recursos
            const isLocked = item.requiredFeature && 
                            !planFeatures.includes(item.requiredFeature) && 
                            user.role !== Role.SUPERADMIN;

            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item)}
                className={`w-full flex items-center rounded-[20px] transition-all relative group h-14 shrink-0 ${
                  isSidebarExpanded ? 'px-6 gap-4' : 'justify-center'
                } ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'} ${isLocked ? 'opacity-60 grayscale' : ''}`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="slidingIndicator"
                    className="absolute inset-0 rounded-[20px] shadow-lg shadow-blue-500/20"
                    style={{ backgroundColor: primaryColor }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative z-10 shrink-0">
                  <item.icon size={20} strokeWidth={isActive ? 3 : 2} />
                  {isLocked && (
                    <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-lg border-2 border-slate-900">
                      <Lock size={8} fill="currentColor" strokeWidth={4} />
                    </div>
                  )}
                </div>
                {isSidebarExpanded && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-bold text-sm tracking-tight relative z-10 truncate">
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          <div className="p-6 border-t border-white/5">
            <button 
              onClick={onLogout}
              className={`w-full flex items-center rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all h-14 ${isSidebarExpanded ? 'px-6 gap-4' : 'justify-center'}`}
            >
              <LogOut size={20} />
              {isSidebarExpanded && <span className="font-bold text-sm uppercase tracking-widest truncate">Sair</span>}
            </button>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col overflow-hidden relative p-6 pl-0">
        <header className="h-20 flex items-center justify-between px-10 shrink-0 mb-2">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">
              {menuItems.find(m => m.id === activeTab)?.label}
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {user.role !== Role.SUPERADMIN && (
              <div className="text-right flex flex-col hidden sm:flex">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Empresa</span>
                <span className="text-sm font-black text-slate-900 uppercase tracking-tighter truncate max-w-[150px]">
                  {tenant?.nome || 'Empresa não identificada'}
                </span>
                {/* Status de Conexão */}
                <div className="flex items-center gap-1.5 mt-1.5 justify-end">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === 'online' ? 'bg-green-500' : 
                    syncStatus === 'offline' ? 'bg-gray-400' : 
                    'bg-blue-500 animate-pulse'
                  }`}></div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${
                    syncStatus === 'online' ? 'text-green-600' : 
                    syncStatus === 'offline' ? 'text-gray-500' : 
                    'text-blue-600'
                  }`}>
                    {syncStatus === 'online' && 'Online'}
                    {syncStatus === 'offline' && 'Offline'}
                    {syncStatus === 'syncing' && 'Sincronizando'}
                    {queueSize > 0 && ` (${queueSize})`}
                  </span>
                </div>
              </div>
            )}
            
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-xl flex items-center justify-center overflow-hidden shrink-0 aspect-square">
               {user.role === Role.SUPERADMIN ? (
                 <Globe className="text-slate-300" size={24} />
               ) : tenant.logoUrl ? (
                 <img src={tenant.logoUrl} className="w-full h-full object-cover block" alt="Tenant Logo" />
               ) : (
                 <Building className="text-slate-200" size={20} />
               )}
            </div>

            <div className="w-px h-8 bg-slate-200 mx-1"></div>

            <div className="w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden flex items-center justify-center bg-slate-800 text-white font-black text-xs uppercase cursor-pointer hover:scale-105 transition-transform shrink-0 aspect-square">
               {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover block" /> : user.nome[0]}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative bg-white/40 backdrop-blur-sm rounded-[48px] border border-white/60 shadow-inner flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex-1 overflow-y-auto p-10 scrollbar-hide"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Layout;