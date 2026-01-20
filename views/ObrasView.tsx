
import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectStatus, Tenant } from '../types';
import { 
  MoreHorizontal, 
  Plus, 
  MapPin, 
  Calendar, 
  X, 
  HardHat, 
  ImageIcon, 
  Wallet, 
  Edit2, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ObrasViewProps {
  projects: Project[];
  activeTenant: Tenant;
  onOpenUpgrade: () => void;
  onSelectProject: (p: Project) => void;
  onAddProject: (p: Project) => void;
  onRemoveProject: (id: string) => void;
}

const ObrasView: React.FC<ObrasViewProps> = ({ projects, activeTenant, onOpenUpgrade, onSelectProject, onAddProject, onRemoveProject }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    local: '',
    orcamento: '',
    inicio: '',
    fim: '',
    logoUrl: '',
    status: ProjectStatus.PLANEJAMENTO
  });

  const isLimitReached = projects.length >= activeTenant.limiteObras;

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, logoUrl: url }));
    }
  };

  const openEditModal = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project);
    setFormData({
      nome: project.nome,
      local: project.local,
      orcamento: project.orcamento.toString(),
      inicio: project.dataInicio,
      fim: project.dataFim,
      logoUrl: project.logoUrl || '',
      status: project.status
    });
    setCurrentStep(1);
    setShowAddModal(true);
    setActiveMenuId(null);
  };

  const handleAddNewClick = () => {
    if (isLimitReached) {
      onOpenUpgrade();
      return;
    }
    setEditingProject(null); 
    setCurrentStep(1); 
    setShowAddModal(true);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.nome || !formData.local || !formData.orcamento) {
        alert("Preencha os campos obrigatórios da Identidade.");
        return;
      }
      setCurrentStep(2);
    }
  };

  const handleSave = () => {
    if (!formData.inicio || !formData.fim) {
      alert("Defina as datas de cronograma.");
      return;
    }

    const projectData: Project = {
      id: editingProject ? editingProject.id : `p-${Date.now()}`,
      tenantId: activeTenant.id,
      nome: formData.nome,
      local: formData.local.toUpperCase(),
      status: formData.status,
      dataInicio: formData.inicio,
      dataFim: formData.fim,
      orcamento: Number(formData.orcamento.replace(/\D/g, '')) || 0,
      logoUrl: formData.logoUrl,
      baselineSet: editingProject ? editingProject.baselineSet : false
    };

    onAddProject(projectData); 
    setShowAddModal(false);
    setEditingProject(null);
    setCurrentStep(1);
    setFormData({ nome: '', local: '', orcamento: '', inicio: '', fim: '', logoUrl: '', status: ProjectStatus.PLANEJAMENTO });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--/--/----';
    const parts = dateStr.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Deseja realmente excluir esta obra?")) {
      onRemoveProject(id);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#1e293b]">Gestão de Obras</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm font-medium">Controle centralizado do portfólio</p>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">{projects.length}/{activeTenant.limiteObras} Em uso</span>
          </div>
        </div>
        <button 
          onClick={handleAddNewClick}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 ${isLimitReached ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700'}`}
        >
          {isLimitReached ? <Lock size={20} /> : <Plus size={20} />} 
          {isLimitReached ? 'Aumentar Limite (Upgrade)' : 'Cadastrar Nova Obra'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {projects.map((project) => (
          <div 
            key={project.id} 
            className="bg-white border border-slate-200 rounded-[24px] overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
            onClick={() => onSelectProject(project)}
          >
            <div className="h-44 bg-slate-100 relative overflow-hidden shrink-0">
               <img 
                 src={project.logoUrl || `https://picsum.photos/seed/${project.id}/800/400`} 
                 className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                 alt={project.nome} 
               />
               <div className="absolute top-4 right-4">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] shadow-sm ${
                    project.status === ProjectStatus.EXECUCAO ? 'bg-emerald-50 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    {project.status}
                  </span>
               </div>
               <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-xl shadow-sm border border-white/20">
                 <Wallet size={14} className="text-blue-600" />
                 <span className="text-[11px] font-black text-[#1e293b] tracking-tight">
                   {formatCurrency(project.orcamento)}
                 </span>
               </div>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-1 relative">
                <h3 className="text-xl font-black text-[#1e293b] leading-tight truncate pr-4">{project.nome}</h3>
                <div className="relative">
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setActiveMenuId(activeMenuId === project.id ? null : project.id);
                    }} 
                    className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-300 transition-colors"
                  >
                    <MoreHorizontal size={22} />
                  </button>
                  
                  {activeMenuId === project.id && (
                    <div 
                      className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button 
                        onClick={(e) => openEditModal(e, project)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black text-slate-600 hover:bg-slate-50 transition-colors uppercase tracking-wider"
                      >
                        <Edit2 size={14} className="text-blue-500" /> Editar
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, project.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-black text-red-500 hover:bg-red-50 transition-colors uppercase tracking-wider"
                      >
                        <Trash2 size={14} /> Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-6">
                <MapPin size={12} className="text-blue-500" />
                <span className="truncate">{project.local || 'LOCAL NÃO DEFINIDO'}</span>
              </div>

              <div className="space-y-4 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Início</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#1e293b]">{formatDate(project.dataInicio)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Previsão Fim</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#1e293b]">{formatDate(project.dataFim)}</span>
                </div>
              </div>

              <div className="mt-auto pt-5 border-t border-slate-100 flex items-center justify-end">
                 <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProject(project);
                  }}
                  className="text-[11px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-[0.1em] flex items-center gap-2 group/btn transition-all"
                 >
                   Ver Cronograma <Plus size={14} className="group-hover/btn:rotate-90 transition-transform" />
                 </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* STEPPER MODAL: CADASTRAR/EDITAR OBRA */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[6px] animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[500px] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-400 border border-slate-100">
            
            <div className="px-10 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-xl font-black text-[#1e293b] tracking-tight uppercase">
                  {editingProject ? 'Ajustar Obra' : 'Nova Obra'}
                </h3>
                <div className="flex items-center gap-3 mt-1.5">
                   <div className={`w-2 h-2 rounded-full transition-all ${currentStep === 1 ? 'bg-blue-600 w-6' : 'bg-slate-200 cursor-pointer'}`} onClick={() => setCurrentStep(1)}></div>
                   <div className={`w-2 h-2 rounded-full transition-all ${currentStep === 2 ? 'bg-blue-600 w-6' : 'bg-slate-200 cursor-pointer'}`} onClick={() => currentStep === 1 ? handleNextStep() : setCurrentStep(2)}></div>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Etapa {currentStep} de 2</span>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-300 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 scrollbar-hide bg-slate-50/10">
              <AnimatePresence mode="wait">
                {currentStep === 1 ? (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-6">
                       <div className="col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 block">Logo da Obra / Cliente</label>
                          <div 
                            onClick={handleLogoClick}
                            className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-all overflow-hidden group shadow-inner"
                          >
                            {formData.logoUrl ? (
                              <img src={formData.logoUrl} className="w-full h-full object-cover block" alt="Logo" />
                            ) : (
                              <div className="flex flex-col items-center">
                                <ImageIcon size={24} className="text-slate-300 group-hover:text-blue-500 mb-2" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Upload de Imagem</span>
                              </div>
                            )}
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                          </div>
                       </div>

                       <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Empreendimento</label>
                          <input 
                            type="text" 
                            value={formData.nome}
                            onChange={e => setFormData(p => ({...p, nome: e.target.value}))}
                            placeholder="Residencial Horizonte" 
                            className="w-full bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                          />
                       </div>

                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Localização (Cidade, UF)</label>
                          <input 
                            type="text" 
                            value={formData.local}
                            onChange={e => setFormData(p => ({...p, local: e.target.value}))}
                            placeholder="Itumbiara, GO" 
                            className="w-full bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                          />
                       </div>

                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Orçamento (BAC)</label>
                          <input 
                            type="text" 
                            value={formData.orcamento}
                            onChange={e => setFormData(p => ({...p, orcamento: e.target.value}))}
                            placeholder="R$ 1.500.000,00" 
                            className="w-full bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                          />
                       </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-6">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Data de Início</label>
                          <input 
                            type="date" 
                            value={formData.inicio}
                            onChange={e => setFormData(p => ({...p, inicio: e.target.value}))}
                            className="w-full bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                          />
                       </div>

                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Previsão Término</label>
                          <input 
                            type="date" 
                            value={formData.fim}
                            onChange={e => setFormData(p => ({...p, fim: e.target.value}))}
                            className="w-full bg-white border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" 
                          />
                       </div>

                       <div className="col-span-2 space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Status do Ciclo de Vida</label>
                          <div className="grid grid-cols-2 gap-3">
                            {[ProjectStatus.PLANEJAMENTO, ProjectStatus.EXECUCAO, ProjectStatus.CONCLUIDA, ProjectStatus.PARALISADA].map(status => (
                              <button
                                key={status}
                                onClick={() => setFormData(p => ({...p, status}))}
                                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                                  formData.status === status 
                                    ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-md' 
                                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                       </div>

                       <div className="col-span-2 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                          <HardHat size={20} className="text-emerald-500 shrink-0" />
                          <p className="text-[9px] font-bold text-emerald-800 leading-tight uppercase tracking-tight">
                            As datas definidas servem como baseline para a Curva S financeira e controle de histograma de mão de obra.
                          </p>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
               {currentStep === 1 ? (
                 <>
                   <button 
                    onClick={() => setShowAddModal(false)} 
                    className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                   >
                    Cancelar
                   </button>
                   <button 
                    onClick={handleNextStep} 
                    className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                   >
                    Próxima Etapa <ChevronRight size={14} />
                   </button>
                 </>
               ) : (
                 <>
                   <button 
                    onClick={() => setCurrentStep(1)} 
                    className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                   >
                    <ChevronLeft size={14} /> Voltar
                   </button>
                   <button 
                    onClick={handleSave} 
                    className="flex-1 ml-8 bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                   >
                    <CheckCircle2 size={16} /> {editingProject ? 'Salvar Alterações' : 'Cadastrar Obra'}
                   </button>
                 </>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ObrasView;
