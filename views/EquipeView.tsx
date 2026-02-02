
import React, { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { Resource, Task, Project, Tenant, User, PlanTemplate, RoleDefinition } from '../types';
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
import { ProtectedElement } from '../hooks/usePermission';
import { Resource as PermissionResource, Action } from '../types/permissions';
import { dataSyncService } from '../services/dataService';

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
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roles, setRoles] = useState<RoleDefinition[]>([]);

  const currentPlan = useMemo(() => {
    return plansConfig.find(p => p.id === activeTenant.planoId);
  }, [plansConfig, activeTenant.planoId]);

  useEffect(() => {
    let isMounted = true;

    const fetchRoles = async () => {
      try {
        const fetched = await dataSyncService.loadRoles(activeTenant.id);
        if (isMounted) {
          setRoles(fetched);
        }
      } catch (error) {
        if (isMounted) {
          setRoles([]);
        }
      }
    };

    fetchRoles();
    return () => { isMounted = false; };
  }, [activeTenant.id]);

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
    setEditingRole(null);
  };

  const handleOpenAdd = () => {
    if (activeTab === 'human' && isLaborLimitReached) { onOpenUpgrade(); return; }
    if (activeTab === 'equip' && isEquipLimitReached) { onOpenUpgrade(); return; }
    if (activeTab === 'roles' && isRolesLimitReached) { onOpenUpgrade(); return; }
    
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (res: Resource) => {
    setEditingRole(null);
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

  const handleDeleteResource = (id: string) => {
    const confirmed = window.confirm('Remover este registro?');
    if (!confirmed) return;
    onRemoveResource(id);
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

  const handleEditRole = (role: RoleDefinition) => {
    setEditingResource(null);
    setEditingRole(role);
    setFormData({
      tipo: 'CARGO',
      nome: role.nome,
      custoHora: role.hhPadrao.toString(),
      especialidade: '',
      placaId: '',
      categoria: role.categoria,
      cargoId: ''
    });
    setShowAddModal(true);
  };

  const handleSave = async () => {
    try {
      if (formData.tipo === 'CARGO') {
        if (!formData.nome || !formData.custoHora || !formData.categoria) {
          toast.error('Preencha todos os campos do cargo');
          return;
        }

        const rolePayload: RoleDefinition = {
          id: editingRole?.id || (crypto.randomUUID ? crypto.randomUUID() : `role-${Date.now()}`),
          tenantId: activeTenant.id,
          nome: formData.nome,
          hhPadrao: Number(formData.custoHora),
          categoria: formData.categoria
        };

        const savedRole = await dataSyncService.upsertRole(rolePayload, activeTenant.id);
        if (savedRole) {
          setRoles(prev => editingRole ? prev.map(r => r.id === savedRole.id ? savedRole : r) : [...prev, savedRole]);
        }

        setShowAddModal(false);
        resetForm();
        return;
      }

      if (!formData.nome || !formData.custoHora) {
        toast.error('Nome e Custo são obrigatórios');
        return;
      }

      if (formData.tipo === 'HUMANO' && !formData.cargoId) {
        toast.error('Selecione um cargo para o colaborador');
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
    } catch (error) {
      toast.error('Não foi possível salvar. Tente novamente.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    const confirmed = window.confirm('Remover este cargo? Colaboradores vinculados manterão a referência antiga.');
    if (!confirmed) return;

    try {
      await dataSyncService.deleteRole(roleId, activeTenant.id);
      setRoles(prev => prev.filter(r => r.id !== roleId));
    } catch (error) {
      toast.error('Não foi possível remover o cargo.');
    }
  };

  const resourceAnalytics = useMemo(() => {
    const analysis: Record<string, { totalHH: number }> = {};
    
    // Inicializa análise para todos os recursos
    resources.forEach(res => {
      analysis[res.id] = { totalHH: 0 };
    });

    // Processa alocações em tarefas
    tasks.forEach(task => {
      // Trata alocações como array direto (formato padrão)
      if (Array.isArray(task.alocacoes)) {
        task.alocacoes.forEach(aloc => {
          // Suporta ambos os formatos: objeto com recursoId ou string
          const resId = typeof aloc === 'object' ? aloc.recursoId : aloc;
          if (resId && analysis[resId]) {
            const hh = task.duracaoDias * 8 * (typeof aloc === 'object' ? aloc.quantidade : 1);
            analysis[resId].totalHH += hh;
          }
        });
      }
    });
    
    return analysis;
  }, [resources, tasks]);

  // Descobre a alocação ativa hoje por recurso, tolerando alocações como JSON string
  // Estrutura evoluída: suporta múltiplas obras por recurso
  const activeAllocations = useMemo(() => {
    const map: Record<string, Record<string, { projectName: string; tasks: string[] }>> = {};
    
    // Normaliza a data de hoje usando apenas formato YYYY-MM-DD para comparação segura
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayString = today.toISOString().split('T')[0]; // Formato: YYYY-MM-DD
    
    // Helper para converter data para string YYYY-MM-DD
    const toDateString = (dateStr: string): string => {
      try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };

    // Normaliza ID: converte para string, remove espaços e transforma em lowercase
    const normalizeId = (id: any): string => {
      return String(id || '').trim().toLowerCase();
    };

    const normalizeAlocacoes = (alocacoes: any): any[] => {
      if (Array.isArray(alocacoes)) {
        return alocacoes;
      }
      if (typeof alocacoes === 'string' && alocacoes.trim()) {
        try {
          const parsed = JSON.parse(alocacoes);
          if (Array.isArray(parsed)) {
            return parsed;
          }
          return [];
        } catch (error) {
          return [];
        }
      }
      return [];
    };

    // Extrai ID com suporte exaustivo a múltiplas variações de chaves
    // Ordem: Postgres snake_case > camelCase > user-related > genérico
    const extractResourceId = (aloc: any): string | null => {
      if (typeof aloc === 'string') {
        const normalized = normalizeId(aloc);
        return normalized ? normalized : null;
      }

      if (typeof aloc === 'object' && aloc !== null) {
        // Tenta em ordem de probabilidade
        const possibleKeys = [
          'recurso_id',    // Postgres snake_case
          'resource_id',   // alternativa snake_case
          'id_recurso',    // variação snake_case
          'user_id',       // Pode ser vindo de user (CRÍTICO)
          'usuario_id',    // Português
          'recursoId',     // camelCase padrão
          'resourceId',    // camelCase alternativo
          'usuarioId',     // Português camelCase
          'userId',        // user camelCase
          'id'             // fallback genérico
        ];

        for (const key of possibleKeys) {
          const value = aloc[key];
          if (value !== undefined && value !== null && value !== '') {
            const normalized = normalizeId(value);
            if (normalized) {
              return normalized;
            }
          }
        }

        return null;
      }

      return null;
    };

    // Extrai TODOS os IDs possíveis do objeto de alocação (para mapeamento duplo)
    const extractAllResourceIds = (aloc: any): string[] => {
      const ids: string[] = [];
      
      if (typeof aloc === 'string') {
        const normalized = normalizeId(aloc);
        if (normalized) ids.push(normalized);
        return ids;
      }

      if (typeof aloc === 'object' && aloc !== null) {
        // Chaves relacionadas a recurso
        const resourceKeys = ['recurso_id', 'resource_id', 'id_recurso', 'recursoId', 'resourceId', 'id'];
        // Chaves relacionadas a usuário
        const userKeys = ['user_id', 'usuario_id', 'userId', 'usuarioId'];

        // Extrai IDs de recurso
        resourceKeys.forEach(key => {
          const value = aloc[key];
          if (value !== undefined && value !== null && value !== '') {
            const normalized = normalizeId(value);
            if (normalized && !ids.includes(normalized)) ids.push(normalized);
          }
        });

        // Extrai IDs de usuário (também são importantes!)
        userKeys.forEach(key => {
          const value = aloc[key];
          if (value !== undefined && value !== null && value !== '') {
            const normalized = normalizeId(value);
            if (normalized && !ids.includes(normalized)) ids.push(normalized);
          }
        });
      }

      return ids;
    };

    tasks.forEach(task => {
      const alocacoes = normalizeAlocacoes((task as any).alocacoes);
      if (!alocacoes.length) return;

      // Normaliza datas usando apenas formato YYYY-MM-DD para evitar problemas de fuso horário
      const startString = toDateString(task.inicioPlanejado);
      const endString = toDateString(task.fimPlanejado);

      // Comparação segura usando strings YYYY-MM-DD (ignora fuso horário completamente)
      const isActiveToday = todayString >= startString && todayString <= endString;
      
      if (!isActiveToday) return;

      const project = projects.find(p => p.id === task.obraId);

      alocacoes.forEach((aloc, idx) => {
        // Extrai TODOS os IDs possíveis para mapeamento duplo
        const allIds = extractAllResourceIds(aloc);
        
        if (allIds.length === 0) {
          return;
        }

        // Mapeia a tarefa para TODOS os IDs (resource_id E user_id)
        allIds.forEach(resId => {
          // Inicializa o recurso se ainda não existir
          if (!map[resId]) {
            map[resId] = {};
          }
          
          // Inicializa a obra se ainda não existir para este recurso
          if (!map[resId][task.obraId]) {
            map[resId][task.obraId] = {
              projectName: project?.nome || 'Obra sem título',
              tasks: []
            };
          }
          
          // Adiciona tarefa se não estiver já na lista
          if (!map[resId][task.obraId].tasks.includes(task.nome)) {
            map[resId][task.obraId].tasks.push(task.nome);
          }
        });
      });
    });

    return map;
  }, [tasks, projects]);

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
          <ProtectedElement resource={PermissionResource.RESOURCES} action={Action.CREATE}>
            <button onClick={handleOpenAdd} className={`p-2.5 rounded-xl transition-all shadow-lg active:scale-95 ${(activeTab === 'human' && isLaborLimitReached) || (activeTab === 'equip' && isEquipLimitReached) || (activeTab === 'roles' && isRolesLimitReached) ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-[#0f172a] text-white hover:bg-slate-800'}`}>
              {(activeTab === 'human' && isLaborLimitReached) || (activeTab === 'equip' && isEquipLimitReached) || (activeTab === 'roles' && isRolesLimitReached) ? <Lock size={20} /> : <Plus size={20} />}
            </button>
          </ProtectedElement>
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
                    <div className="flex items-center justify-end gap-2">
                      <ProtectedElement resource={PermissionResource.RESOURCES} action={Action.UPDATE}>
                        <button onClick={() => handleEditRole(role)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                      </ProtectedElement>
                      <ProtectedElement resource={PermissionResource.RESOURCES} action={Action.DELETE}>
                        <button onClick={() => handleDeleteRole(role.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </ProtectedElement>
                    </div>
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
            
            // Normaliza o ID do recurso para matching com activeAllocations
            const normalizedResId = String(res.id || '').trim().toLowerCase();
            // Tenta encontrar pelo ID do Recurso OU pelo ID do Usuário vinculado (busca inteligente)
            const normalizedUserId = res.userId ? String(res.userId || '').trim().toLowerCase() : null;
            const allocations = activeAllocations[normalizedResId] || (normalizedUserId ? activeAllocations[normalizedUserId] : null);
            
            // Calcula quantas obras únicas o recurso está alocado
            const projectIds = allocations ? Object.keys(allocations) : [];
            const projectCount = projectIds.length;
            
            // Determina estilo do badge baseado no número de obras
            let badgeStyles = {
              container: 'bg-emerald-50/50 border-emerald-100 text-emerald-600',
              dot: 'bg-emerald-500',
              text: '● DISPONÍVEL'
            };
            
            if (projectCount === 1) {
              const firstProjectId = projectIds[0];
              const projectName = allocations![firstProjectId].projectName;
              badgeStyles = {
                container: 'bg-blue-50/50 border-blue-100 text-blue-600',
                dot: 'bg-blue-500',
                text: `● OBRA: ${projectName}`
              };
            } else if (projectCount > 1) {
              badgeStyles = {
                container: 'bg-amber-50/50 border-amber-100 text-amber-600',
                dot: 'bg-amber-500',
                text: `● MÚLTIPLAS OBRAS (${projectCount})`
              };
            }
            
            return (
              <div key={res.id} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-all group flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${res.tipo === 'HUMANO' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                    {res.tipo === 'HUMANO' ? <Users size={28} /> : <Truck size={28} />}
                  </div>
                  <div className="flex gap-2">
                    <ProtectedElement resource={PermissionResource.RESOURCES} action={Action.UPDATE}>
                      <button onClick={() => handleEdit(res)} className="p-2 text-slate-300 hover:text-blue-600 transition-colors"><Edit2 size={18} /></button>
                    </ProtectedElement>
                    <ProtectedElement resource={PermissionResource.RESOURCES} action={Action.DELETE}>
                      <button onClick={() => handleDeleteResource(res.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
                    </ProtectedElement>
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
                <div className="mt-auto relative group/badge">
                  <div className={`p-4 rounded-2xl border flex items-center gap-3 ${badgeStyles.container}`}>
                    <div className={`w-2 h-2 rounded-full ${badgeStyles.dot}`} />
                    <p className="text-[10px] font-black uppercase tracking-widest truncate">
                      {badgeStyles.text}
                    </p>
                  </div>
                  {allocations && projectCount > 0 && (
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover/badge:block z-20">
                      <div className="min-w-[220px] max-w-[280px] bg-slate-900 text-white text-[10px] rounded-xl shadow-xl p-4 space-y-3">
                        <p className="font-black uppercase tracking-[0.2em] text-slate-300 border-b border-slate-700 pb-2">Tarefas de hoje</p>
                        {projectIds.map((projectId, idx) => {
                          const projectData = allocations[projectId];
                          return (
                            <div key={projectId} className={idx > 0 ? 'border-t border-slate-700 pt-3' : ''}>
                              <p className="font-black text-blue-400 mb-1.5 uppercase tracking-wide">{projectData.projectName}</p>
                              <ul className="list-disc list-inside space-y-1 ml-1">
                                {projectData.tasks.map((taskName, taskIdx) => (
                                  <li key={taskIdx} className="leading-tight text-white/80 text-[9px]">{taskName}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[6px] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-400">
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div><h3 className="text-xl md:text-2xl font-black text-[#1e293b] tracking-tight">{(editingResource || editingRole) ? 'Editar Registro' : 'Novo Registro'}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configuração de ativos e cargos</p></div>
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
                {(editingResource || editingRole) ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                {(editingResource || editingRole) ? 'Salvar' : formData.tipo === 'CARGO' ? 'Criar Cargo' : 'Salvar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipeView;
