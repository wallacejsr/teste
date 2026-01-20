
import React, { useState, useMemo, useEffect } from 'react';
import { Resource, Task, Project, Tenant, User, PlanTemplate } from '../types';
import { 
  Users, 
  Truck, 
  Plus, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  Search,
  DollarSign,
  Edit2,
  X,
  Briefcase,
  ChevronDown,
  Lock 
} from 'lucide-react';

interface RoleDefinition {
  id: string;
  nome: string;
  hhPadrao: number;
  categoria: string;
}

const DEFAULT_ROLES: RoleDefinition[] = [
  { id: 'c-1', nome: 'Engenheiro', hhPadrao: 80, categoria: 'Engenharia' },
  { id: 'c-2', nome: 'Mestre de Obras', hhPadrao: 45, categoria: 'Produção' },
  { id: 'c-3', nome: 'Pedreiro', hhPadrao: 25, categoria: 'Produção' },
  { id: 'c-4', nome: 'Eletricista', hhPadrao: 35, categoria: 'Produção' },
  { id: 'c-5', nome: 'Administrativo', hhPadrao: 22, categoria: 'Administrativo' },
  { id: 'c-6', nome: 'Apoio Técnico', hhPadrao: 20, categoria: 'Apoio' },
];

interface EquipeViewProps {
  resources: Resource[];
  tasks: Task[];
  projects: Project[];
  activeTenant: Tenant;
  planFeatures: string[];
  plansConfig: PlanTemplate[]; 
  allUsers: User[];
  onOpenUpgrade: () => void;
  onAddResource: (r: Resource) => void;
  onRemoveResource: (id: string) => void;
}

const EquipeView: React.FC<EquipeViewProps> = ({ 
  resources, 
  tasks, 
  projects, 
  activeTenant, 
  planFeatures,
  plansConfig,
  allUsers, 
  onOpenUpgrade, 
  onAddResource, 
  onRemoveResource 
}) => {
  const [activeTab, setActiveTab] = useState<'human' | 'equip' | 'roles'>('human');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roles, setRoles] = useState<RoleDefinition[]>(DEFAULT_ROLES);

  const currentPlan = useMemo(() => {
    return plansConfig.find(p => p.id === activeTenant.planoId);
  }, [plansConfig, activeTenant.planoId]);

  // Sincronização de limites operacionais vindos do plano
  const effectiveLaborLimit = currentPlan ? currentPlan.limiteMaoDeObra : activeTenant.limiteMaoDeObra;
  const effectiveEquipLimit = currentPlan ? currentPlan.limiteMaquinario : activeTenant.limiteMaquinario;
  const effectiveRolesLimit = currentPlan ? currentPlan.limiteCargos : activeTenant.limiteCargos;

  const currentLaborCount = resources.filter(r => r.tipo === 'HUMANO').length;
  const currentEquipCount = resources.filter(r => r.tipo === 'EQUIPAMENTO').length;
  const currentRolesCount = roles.length;

  const isLaborLimitReached = currentLaborCount >= effectiveLaborLimit;
  const isEquipLimitReached = currentEquipCount >= effectiveEquipLimit;
  const isRolesLimitReached = currentRolesCount >= effectiveRolesLimit;

  const [formData, setFormData] = useState({
    tipo: 'HUMANO' as 'HUMANO' | 'EQUIPAMENTO' | 'CARGO',
    nome: '',
    custoHora: '',
    especialidade: '', 
    placaId: '',      
    categoria: '',     
    cargoId: ''
  });

  const resetForm = () => {
    setFormData({
      tipo: activeTab === 'human' ? 'HUMANO' : activeTab === 'equip' ? 'EQUIPAMENTO' : 'CARGO',
      nome: '',
      custoHora: '',
      especialidade: '',
      placaId: '',
      categoria: '',
      cargoId: ''
    });
    setEditingResource(null);
  };

  const handleOpenAdd = () => {
    if (activeTab === 'human' && isLaborLimitReached) { onOpenUpgrade(); return; }
    if (activeTab === 'equip' && isEquipLimitReached) { onOpenUpgrade(); return; }
    if (activeTab === 'roles' && isRolesLimitReached) { onOpenUpgrade(); return; }
    
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (res: Resource) => {
    setEditingResource(res);
    setFormData({
      tipo: res.tipo as any,
      nome: res.nome,
      custoHora: res.custoHora.toString(),
      especialidade: res.especialidade || '',
      placaId: res.placaId || '',
      categoria: res.categoria || '',
      cargoId: (res as any).cargoId || ''
    });
    setShowAddModal(true);
  };

  useEffect(() => {
    if (formData.tipo === 'HUMANO' && formData.cargoId) {
      const selectedRole = roles.find(r => r.id === formData.cargoId);
      if (selectedRole && !editingResource) {
        setFormData(prev => ({ 
          ...prev, 
          custoHora: selectedRole.hhPadrao.toString(),
          categoria: selectedRole.categoria
        }));
      }
    }
  }, [formData.cargoId, roles, editingResource]);

  const handleSave = () => {
    if (formData.tipo === 'CARGO') {
      if (!formData.nome || !formData.custoHora || !formData.categoria) {
        alert("Preencha todos os campos do cargo");
        return;
      }
      const newRole: RoleDefinition = {
        id: `role-${Date.now()}`,
        nome: formData.nome,
        hhPadrao: Number(formData.custoHora),
        categoria: formData.categoria
      };
      setRoles(prev => [...prev, newRole]);
      setShowAddModal(false);
      resetForm();
      return;
    }

    if (!formData.nome || !formData.custoHora) {
      alert("Nome e Custo são obrigatórios");
      return;
    }

    if (formData.tipo === 'HUMANO' && !formData.cargoId) {
      alert("Selecione um cargo para o colaborador");
      return;
    }

    const selectedRole = formData.tipo === 'HUMANO' ? roles.find(r => r.id === formData.cargoId) : undefined;

    const newResource: Resource = {
      id: editingResource ? editingResource.id : `res-${Date.now()}`,
      tenantId: activeTenant.id, 
      nome: formData.nome,
      tipo: formData.tipo as 'HUMANO' | 'EQUIPAMENTO',
      custoHora: Number(formData.custoHora),
      categoria: formData.categoria,
      ...(formData.tipo === 'HUMANO' 
        ? { especialidade: formData.especialidade, cargoId: formData.cargoId, cargoNome: selectedRole?.nome } 
        : { placaId: formData.placaId }
      )
    } as any;

    onAddResource(newResource);
    setShowAddModal(false);
    resetForm();
  };

  const resourceAnalytics = useMemo(() => {
    const analysis: Record<string, { totalHH: number }> = {};
    resources.forEach(res => {
      analysis[res.id] = { totalHH: 0 };
    });
    tasks.forEach(task => {
      task.alocacoes.forEach(aloc => {
        if (analysis[aloc.recursoId]) {
          const hh = task.duracaoDias * 8 * aloc.quantidade;
          analysis[aloc.recursoId].totalHH += hh;
        }
      });
    });
    return analysis;
  }, [resources, tasks]);

  const filteredResources = resources.filter(r => 
    (activeTab === 'human' ? r.tipo === 'HUMANO' : r.tipo === 'EQUIPAMENTO') &&
    r.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isDefaultHH = useMemo(() => {
    if (formData.tipo !== 'HUMANO' || !formData.cargoId) return true;
    const role = roles.find(r => r.id === formData.cargoId);
    return role ? Number(formData.custoHora) === role.hhPadrao : true;
  }, [formData.custoHora, formData.cargoId, roles]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 font-['Inter']">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-[#1e293b] uppercase tracking-tight">Gestão de Equipe & Recursos</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm font-medium">
              {activeTab === 'human' ? 'Controle de Mão de Obra' : activeTab === 'equip' ? 'Gestão de Maquinário' : 'Configuração de Cargos & HH'}
            </p>
            {/* Contadores Visuais sincronizados com os limites operacionais */}
            {activeTab === 'human' && (
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${isLaborLimitReached ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                {currentLaborCount}/{effectiveLaborLimit} PROFISSIONAIS
              </span>
            )}
            {activeTab === 'equip' && (
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${isEquipLimitReached ? 'bg-amber-50 text-amber-600' : 'bg-orange-50 text-orange-600'}`}>
                {currentEquipCount}/{effectiveEquipLimit} MÁQUINAS
              </span>
            )}
             {activeTab === 'roles' && (
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${isRolesLimitReached ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                {currentRolesCount}/{effectiveRolesLimit} CARGOS
              </span>
            )}
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`w-10 h-10 ${activeTab === 'human' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'} rounded-xl flex items-center justify-center`}>
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alocação Total</p>
              <p className="text-lg font-black text-[#1e293b]">
                {Object.values(resourceAnalytics).reduce((acc: number, curr: any) => acc + (curr.totalHH || 0), 0)}h
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-2 rounded-[24px] border border-slate-100 shadow-sm">
        <div className="flex p-1 bg-slate-50 rounded-2xl w-full sm:w-auto">
          <button onClick={() => setActiveTab('human')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'human' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}><Users size={16} /> Mão de Obra</button>
          <button onClick={() => setActiveTab('equip')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'equip' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}><Truck size={16} /> Maquinário</button>
          <button onClick={() => setActiveTab('roles')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'roles' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}><Briefcase size={16} /> Cargos</button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto px-2">
          {activeTab !== 'roles' && (
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-100 outline-none" />
            </div>
          )}
          <button onClick={handleOpenAdd} className={`p-2.5 rounded-xl transition-all shadow-lg active:scale-95 ${(activeTab === 'human' && isLaborLimitReached) || (activeTab === 'equip' && isEquipLimitReached) || (activeTab === 'roles' && isRolesLimitReached) ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-[#0f172a] text-white hover:bg-slate-800'}`}>
            {(activeTab === 'human' && isLaborLimitReached) || (activeTab === 'equip' && isEquipLimitReached) || (activeTab === 'roles' && isRolesLimitReached) ? <Lock size={20} /> : <Plus size={20} />}
          </button>
        </div>
      </div>

      {activeTab === 'roles' ? (
        <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Cargo / Função</th>
                <th className="px-8 py-5">Categoria</th>
                <th className="px-8 py-5">HH Padrão (R$)</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {roles.map(role => (
                <tr key={role.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-8 py-5 font-black text-slate-700 text-sm uppercase">{role.nome}</td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg font-black text-[9px] uppercase tracking-widest">{role.categoria}</span>
                  </td>
                  <td className="px-8 py-5 font-black text-[#1e293b]">R$ {role.hhPadrao.toFixed(2)}</td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map(res => {
            const stats = resourceAnalytics[res.id];
            const role = roles.find(r => r.id === (res as any).cargoId);
            return (
              <div key={res.id} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all group flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${res.tipo === 'HUMANO' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                    {res.tipo === 'HUMANO' ? <Users size={28} /> : <Truck size={28} />}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(res)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit2 size={18} /></button>
                    <button onClick={() => onRemoveResource(res.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="space-y-1 mb-6">
                  <h3 className="text-lg font-black text-[#1e293b] truncate uppercase tracking-tight">{res.nome}</h3>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-widest">{role?.nome || (res as any).placaId || 'SEM REGISTRO'}</span>
                    {res.categoria && <span className="px-2 py-0.5 bg-blue-50 rounded text-[9px] font-black text-blue-500 uppercase tracking-widest">{res.categoria}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Custo {res.tipo === 'HUMANO' ? 'HH' : 'Op'}</p>
                    <div className="flex items-center gap-1 text-blue-600 font-black text-sm"><DollarSign size={14} /> {res.custoHora.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Total Horas</p>
                    <div className="flex items-center gap-1 text-[#1e293b] font-black text-sm"><Clock size={14} className="text-slate-300" /> {stats?.totalHH || 0}h</div>
                  </div>
                </div>
                <div className="mt-auto"><div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3"><CheckCircle2 size={16} className="text-emerald-500" /><p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Disponível em Campo</p></div></div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[6px] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-400">
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div><h3 className="text-xl md:text-2xl font-black text-[#1e293b] tracking-tight">{editingResource ? 'Editar Registro' : 'Novo Registro'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configuração de ativos e cargos</p></div>
              <button onClick={() => setShowAddModal(false)} className="p-2 md:p-3 hover:bg-slate-100 rounded-full text-slate-300 transition-all"><X size={24} /></button>
            </div>
            
            <div className="px-6 md:px-10 py-6 md:py-8 space-y-8 overflow-y-auto flex-1 scrollbar-hide">
               <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Selecione o que deseja cadastrar</label>
                  <div className="grid grid-cols-3 gap-3 md:gap-4">
                     <button onClick={() => setFormData(p => ({...p, tipo: 'HUMANO'}))} className={`px-2 py-3 md:px-4 md:py-4 rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${formData.tipo === 'HUMANO' ? 'bg-[#0f172a] text-white shadow-xl shadow-slate-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}><Users size={16} /> Mão de Obra</button>
                     <button onClick={() => setFormData(p => ({...p, tipo: 'EQUIPAMENTO'}))} className={`px-2 py-3 md:px-4 md:py-4 rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${formData.tipo === 'EQUIPAMENTO' ? 'bg-[#0f172a] text-white shadow-xl shadow-slate-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}><Truck size={16} /> Maquinário</button>
                     <button onClick={() => setFormData(p => ({...p, tipo: 'CARGO'}))} className={`px-2 py-3 md:px-4 md:py-4 rounded-2xl font-black text-[9px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${formData.tipo === 'CARGO' ? 'bg-[#0f172a] text-white shadow-xl shadow-slate-200' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}><Briefcase size={16} /> Cargo</button>
                  </div>
               </div>

               {formData.tipo === 'HUMANO' && (
                 <div className="space-y-6 md:space-y-8 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <div className="md:col-span-2 space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo <span className="text-red-500">*</span></label><input type="text" value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} placeholder="Ex: João Silva" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cargo / Função <span className="text-red-500">*</span></label>
                        <div className="relative"><select value={formData.cargoId} onChange={e => setFormData(p => ({...p, cargoId: e.target.value}))} className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none appearance-none focus:ring-4 focus:ring-blue-100 transition-all pr-12"><option value="">Selecione...</option>{roles.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}</select><ChevronDown size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" /></div>
                      </div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria</label><input type="text" value={formData.categoria} disabled className="w-full bg-slate-100/50 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold text-slate-400 cursor-not-allowed" placeholder="Auto-preenchido" /></div>
                      <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Especialidade (Opcional)</label><input type="text" value={formData.especialidade} onChange={e => setFormData(p => ({...p, especialidade: e.target.value}))} placeholder="Ex: Estrutural, Alvenaria, Elétrica..." className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                      <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between px-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo HH (R$) <span className="text-red-500">*</span></label>{formData.cargoId && <span className={`text-[9px] font-black uppercase flex items-center gap-1.5 px-2 py-0.5 rounded ${isDefaultHH ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}><div className={`w-1.5 h-1.5 rounded-full ${isDefaultHH ? 'bg-emerald-500' : 'bg-orange-500'}`}></div>{isDefaultHH ? 'Valor padrão do cargo' : 'Valor personalizado'}</span>}</div><div className="relative"><input type="number" value={formData.custoHora} onChange={e => setFormData(p => ({...p, custoHora: e.target.value}))} placeholder="00.00" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all text-slate-700" /><DollarSign size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" /></div></div>
                    </div>
                 </div>
               )}

               {formData.tipo === 'EQUIPAMENTO' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Modelo do Equipamento</label><input type="text" value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} placeholder="Ex: Escavadeira Hidráulica 20t" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Custo Operacional (R$)</label><input type="number" value={formData.custoHora} onChange={e => setFormData(p => ({...p, custoHora: e.target.value}))} placeholder="00.00" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Placa / Serial</label><input type="text" value={formData.placaId} onChange={e => setFormData(p => ({...p, placaId: e.target.value}))} placeholder="ABC-1234" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                    </div>
                 </div>
               )}

               {formData.tipo === 'CARGO' && (
                 <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Cargo / Função</label><input type="text" value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} placeholder="Ex: Engenheiro Civil" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">HH Padrão (R$)</label><input type="number" value={formData.custoHora} onChange={e => setFormData(p => ({...p, custoHora: e.target.value}))} placeholder="00.00" className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoria Administrativa</label><input type="text" value={formData.categoria} onChange={e => setFormData(p => ({...p, categoria: e.target.value}))} placeholder="Ex: Produção, Engenharia..." className="w-full bg-slate-50/80 border border-slate-100 px-6 py-4 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                    </div>
                 </div>
               )}
            </div>

            <div className="px-6 md:px-10 py-6 md:py-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 font-black text-[10px] md:text-[11px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
              <button onClick={handleSave} className="bg-blue-600 text-white px-6 md:px-10 py-4 md:py-5 rounded-[20px] font-black text-[10px] md:text-[12px] uppercase tracking-[0.15em] shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-3">
                {editingResource ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                {editingResource ? 'Salvar' : formData.tipo === 'CARGO' ? 'Criar Cargo' : 'Salvar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipeView;
