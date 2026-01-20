import React, { useState, useRef, useMemo } from 'react';
import { User, Tenant, Role, GlobalConfig, PlanTemplate } from '../types';
import { 
  User as UserIcon, 
  Building, 
  Users, 
  Shield, 
  Camera, 
  Upload, 
  PenTool, 
  Trash2,
  X,
  CreditCard,
  ChevronRight,
  Plus,
  Edit2,
  Palette,
  Terminal,
  Activity,
  CheckCircle2,
  Calendar,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ProfileViewProps {
  user: User;
  onUpdateUser: (u: User) => void;
  tenant: Tenant;
  onUpdateTenant: (t: Tenant) => void;
  allUsers: User[];
  onUpdateUsers: (u: User[]) => void;
  plansConfig: PlanTemplate[]; // Propriedade adicionada para sincronismo
  globalConfig: GlobalConfig;
  onUpdateGlobalConfig: (c: GlobalConfig) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
  user, 
  onUpdateUser, 
  tenant, 
  onUpdateTenant, 
  allUsers, 
  onUpdateUsers,
  plansConfig,
  globalConfig,
  onUpdateGlobalConfig
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'perfil' | 'empresa' | 'equipe' | 'branding'>('perfil');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sysLogoInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = user.role === Role.SUPERADMIN;
  const isAdmin = user.role === Role.ADMIN || isSuperAdmin;
  const primaryColor = globalConfig.primaryColor || '#3b82f6';

  // --- LÓGICA DE SINCRONIZAÇÃO DINÂMICA DE LIMITES (Master Admin) ---
  const currentPlan = useMemo(() => {
    return plansConfig.find(p => p.id === tenant.planoId);
  }, [plansConfig, tenant.planoId]);

  // Se o plano global mudou (ex: de 5 para 50), o sistema prioriza o valor do modelo de plano
  const effectiveUserLimit = currentPlan ? currentPlan.limiteUsuarios : tenant.limiteUsuarios;

  const handleInviteUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Bloqueio corrigido usando o limite efetivo de 50
    if (allUsers.length >= effectiveUserLimit) {
      alert("Capacidade da licença atingida. Solicite upgrade no Master Admin.");
      return;
    }
    const formData = new FormData(e.currentTarget);
    const newUser: User = {
      id: `u-${Date.now()}`,
      nome: formData.get('nome') as string,
      email: formData.get('email') as string,
      tenantId: tenant.id,
      role: formData.get('role') as Role,
      cargo: formData.get('cargo') as string,
      ativo: true
    };
    onUpdateUsers([...allUsers, newUser]);
    setShowInviteModal(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'signature' | 'logo' | 'syslogo') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (type === 'signature') onUpdateUser({ ...user, signatureUrl: result });
      else if (type === 'logo') onUpdateTenant({ ...tenant, logoUrl: result });
      else if (type === 'syslogo') onUpdateGlobalConfig({ ...globalConfig, systemLogoUrl: result });
    };
    reader.readAsDataURL(file);
  };

  const rolesToInvite = Object.values(Role).filter(r => isSuperAdmin ? true : r !== Role.SUPERADMIN);

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto pb-12">
      
      {/* Sub-navegação Lateral */}
      <aside className="w-full lg:w-72 space-y-2">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8 px-4 flex items-center gap-2">
          <Terminal size={14} className="text-blue-500" /> Comando Central
        </h2>
        
        <button 
          onClick={() => setActiveSubTab('perfil')}
          className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'perfil' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
          style={{ color: activeSubTab === 'perfil' ? primaryColor : undefined }}
        >
          <div className="flex items-center gap-4">
            <UserIcon size={18} />
            <span className="text-[11px] font-black uppercase tracking-widest">Meu Perfil</span>
          </div>
          <ChevronRight size={14} className={activeSubTab === 'perfil' ? 'opacity-100' : 'opacity-0'} />
        </button>

        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveSubTab('empresa')}
              className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'empresa' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
              style={{ color: activeSubTab === 'empresa' ? primaryColor : undefined }}
            >
              <div className="flex items-center gap-4">
                <Building size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest">Empresa</span>
              </div>
              <ChevronRight size={14} className={activeSubTab === 'empresa' ? 'opacity-100' : 'opacity-0'} />
            </button>

            <button 
              onClick={() => setActiveSubTab('equipe')}
              className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'equipe' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
              style={{ color: activeSubTab === 'equipe' ? primaryColor : undefined }}
            >
              <div className="flex items-center gap-4">
                <Users size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest">Minha Equipe</span>
              </div>
              <ChevronRight size={14} className={activeSubTab === 'equipe' ? 'opacity-100' : 'opacity-0'} />
            </button>
          </>
        )}

        {isSuperAdmin && (
          <button 
            onClick={() => setActiveSubTab('branding')}
            className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'branding' ? 'bg-slate-900 text-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
          >
            <div className="flex items-center gap-4">
              <Palette size={18} />
              <span className="text-[11px] font-black uppercase tracking-widest">SaaS Branding</span>
            </div>
            <ChevronRight size={14} className={activeSubTab === 'branding' ? 'opacity-100' : 'opacity-0'} />
          </button>
        )}

        <div className="pt-10">
           <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[32px] text-white shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none"><CreditCard size={80} /></div>
              <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">Status Licença</p>
              <p className="text-sm font-black uppercase mb-6 tracking-tight">Active Plan</p>
              
              <div className="space-y-4">
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                       <CheckCircle2 size={14} className="text-emerald-500" />
                       <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Válido até</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Calendar size={18} className="text-emerald-500" />
                       <span className="text-base font-black text-emerald-500 tracking-tight">
                          {new Date(tenant.dataFimLicenca).toLocaleDateString()}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* Conteúdo Principal Flexível */}
      <div className="flex-1">
        {activeSubTab === 'perfil' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-8 mb-8">
              <div className="relative group shrink-0 w-20 h-20 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-md">
                <div 
                  className="w-full h-full flex items-center justify-center font-black text-2xl text-white transition-transform group-hover:scale-105"
                  style={{ backgroundColor: primaryColor }}
                >
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover block" /> : user.nome[0]}
                </div>
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                  <Camera size={20} />
                </div>
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate max-w-md">{user.nome}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-500">{user.role}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.cargo || 'Cargo não definido'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                <input type="text" value={user.nome} onChange={e => onUpdateUser({...user, nome: e.target.value})} className="w-full bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail Corporativo</label>
                <input type="email" value={user.email} readOnly className="w-full bg-slate-100 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed" />
              </div>
              
              <div className="md:col-span-2 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-3">Assinatura Digital (PNG Transparente)</label>
                <div 
                  onClick={() => sigInputRef.current?.click()}
                  className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all relative group overflow-hidden hover:border-blue-300"
                >
                  {user.signatureUrl ? (
                    <img src={user.signatureUrl} className="max-h-[80%] object-contain block" alt="Assinatura" />
                  ) : (
                    <div className="flex flex-col items-center">
                       <PenTool size={28} className="text-slate-300 mb-1" />
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clique para upload</p>
                    </div>
                  )}
                  <input ref={sigInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, 'signature')} className="hidden" />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-end">
               <button className="px-8 py-3 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: primaryColor }}>Salvar Alterações</button>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'empresa' && isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
              <Building size={16} style={{ color: primaryColor }} /> Identidade Visual do Cliente
            </h3>
            
            <div className="flex flex-col md:flex-row gap-8">
               <div className="shrink-0 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Logo da Empresa</label>
                  <div 
                    onClick={() => logoInputRef.current?.click()}
                    className="w-40 h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-all overflow-hidden group shadow-inner aspect-square mx-auto"
                  >
                    {tenant.logoUrl ? (
                      <img src={tenant.logoUrl} className="w-full h-full object-cover block" alt="Logo" />
                    ) : (
                      <Upload size={24} className="text-slate-200" />
                    )}
                    <input ref={logoInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, 'logo')} className="hidden" />
                  </div>
               </div>

               <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Razão Social</label>
                    <input type="text" value={tenant.nome} onChange={e => onUpdateTenant({...tenant, nome: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CNPJ</label>
                    <input type="text" value={tenant.cnpj} onChange={e => onUpdateTenant({...tenant, cnpj: e.target.value})} placeholder="00.000.000/0000-00" className="w-full bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="pt-2">
                     <div className="p-5 bg-slate-900 rounded-2xl text-white flex items-center justify-between shadow-xl">
                        <div>
                           <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Capacidade Total</p>
                           <h4 className="text-sm font-black uppercase tracking-tighter">{effectiveUserLimit} Usuários Permitidos</h4>
                        </div>
                        <Activity size={20} style={{ color: primaryColor }} />
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'equipe' && isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 pointer-events-none"><Users size={100} /></div>
              <div className="flex-1 space-y-4 relative z-10 w-full">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Utilização de Licença</p>
                  {/* EXIBIÇÃO CORRIGIDA: Usa o limite efetivo de 50 */}
                  <p className="text-xs font-black uppercase tracking-tighter">{allUsers.length} / {effectiveUserLimit} USUÁRIOS</p>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full rounded-full shadow-lg" 
                    style={{ width: `${(allUsers.length / effectiveUserLimit) * 100}%`, backgroundColor: primaryColor }}
                  ></div>
                </div>
              </div>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="w-full md:w-auto px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 relative z-10 text-white hover:brightness-110"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={16} /> Convidar Usuário
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-4">Membro da Equipe</th>
                    <th className="px-8 py-4">Acesso (Role)</th>
                    <th className="px-8 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-[10px] uppercase overflow-hidden shrink-0 aspect-square border border-white/10 shadow-sm">
                             {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover block" /> : u.nome[0]}
                          </div>
                          <div className="min-w-0">
                             <p className="text-xs font-black text-slate-700 uppercase tracking-tight truncate">{u.nome}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                         <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-500">
                           {u.role}
                         </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"><Edit2 size={16} /></button>
                           <button onClick={() => onUpdateUsers(allUsers.filter(x => x.id !== u.id))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"><Trash2 size={16} /></button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'branding' && isSuperAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-950 p-8 rounded-[40px] border border-white/5 shadow-2xl text-white">
            <h3 className="text-xs font-black uppercase tracking-[0.4em] mb-8 flex items-center gap-3" style={{ color: primaryColor }}>
              <Palette size={18} /> Branding Experience
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
               <div className="space-y-4 text-center">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] block">Logo Sidebar</label>
                  <div 
                    onClick={() => sysLogoInputRef.current?.click()}
                    className="w-40 h-40 bg-white/5 border-2 border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-all overflow-hidden group shadow-inner aspect-square mx-auto"
                  >
                    {globalConfig.systemLogoUrl ? (
                      <img src={globalConfig.systemLogoUrl} className="w-full h-full object-cover block" alt="Sys Logo" />
                    ) : (
                      <Upload size={32} className="text-white/20" />
                    )}
                    <input ref={sysLogoInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, 'syslogo')} className="hidden" />
                  </div>
               </div>

               <div className="space-y-6 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Nome do Software</label>
                    <input type="text" value={globalConfig.softwareName} onChange={e => onUpdateGlobalConfig({...globalConfig, softwareName: e.target.value.toUpperCase()})} className="w-full bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-white" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Subtítulo Estratégico</label>
                    <input type="text" value={globalConfig.softwareSubtitle || ''} onChange={e => onUpdateGlobalConfig({...globalConfig, softwareSubtitle: e.target.value})} placeholder="SaaS Engineering" className="w-full bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-white/60" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] px-1">Cor Primária</label>
                    <div className="flex gap-4">
                      <input type="color" value={globalConfig.primaryColor} onChange={e => onUpdateGlobalConfig({...globalConfig, primaryColor: e.target.value})} className="w-14 h-12 bg-white/5 border border-white/10 rounded-xl cursor-pointer p-1 overflow-hidden" />
                      <input type="text" value={globalConfig.primaryColor} onChange={e => onUpdateGlobalConfig({...globalConfig, primaryColor: e.target.value})} className="flex-1 bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl text-xs font-black uppercase outline-none" />
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* JANELA DE MODAL TRIPARTITE (CONVITE) - ESTRUTURA 500PX ALTURA */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
            
            {/* 1. HEADER FIXO */}
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Convidar Novo Usuário</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-80">Gestão de credenciais de acesso</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors hover:text-slate-600"><X size={20} /></button>
            </div>
            
            {/* 2. BODY COM SCROLL INTERNO E ALTA DENSIDADE */}
            <form id="invite-form-final" onSubmit={handleInviteUser} className="px-8 py-6 overflow-y-auto flex-1 scrollbar-hide bg-slate-50/20">
               <div className="grid grid-cols-2 gap-4">
                 
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                    <input name="nome" required type="text" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ex: Engenheiro Roberto Almeida" />
                 </div>

                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail Corporativo</label>
                    <input name="email" required type="email" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="usuario@empresa.com.br" />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nível de Acesso (Role)</label>
                    <select name="role" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer appearance-none focus:ring-2 focus:ring-blue-100">
                       {rolesToInvite.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cargo / Função</label>
                    <input name="cargo" type="text" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ex: Eng. de Produção" />
                 </div>

                 <div className="col-span-2 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 mt-2">
                    <Shield size={16} className="text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase">
                      As instruções de login serão enviadas ao e-mail informado.
                    </p>
                 </div>
               </div>
            </form>

            {/* 3. FOOTER FIXO */}
            <div className="px-8 py-5 border-t border-slate-100 shrink-0 bg-white flex items-center justify-between gap-4">
               <button 
                type="button" 
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
               >
                 Cancelar
               </button>
               <button 
                form="invite-form-final"
                type="submit" 
                className="flex-1 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:brightness-110"
                style={{ backgroundColor: primaryColor }}
               >
                  Enviar Convite
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;