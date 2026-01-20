import React, { useState, useMemo, useEffect } from 'react';
import { Project, Task, Resource, DailyLog, Tenant } from '../types';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea
} from 'recharts';
import { 
  Plus, 
  RefreshCw, 
  X, 
  Info, 
  CornerDownRight, 
  Trash2, 
  Users, 
  Layers, 
  ListTodo, 
  Link as LinkIcon, 
  Edit2,
  Copy,
  Lock,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  MoreHorizontal,
  CheckCircle2,
  Zap,
  TrendingDown,
  TrendingUp,
  Activity,
  Folder,
  ChevronRight,
  ChevronLeft,
  Calendar,
  DollarSign,
  Clock
} from 'lucide-react';

interface PlanejamentoViewProps {
  project: Project;
  activeTenant: Tenant;
  planFeatures: string[]; // Nova Propriedade Dinâmica
  onOpenUpgrade: () => void;
  tasks: Task[];
  resources: Resource[];
  dailyLogs: DailyLog[];
  onTasksChange: (tasks: Task[]) => void;
}

// ==========================================
// HELPERS DE FORMATAÇÃO E CÁLCULO
// ==========================================

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatNumber = (val: number) => {
  return new Intl.NumberFormat('pt-BR').format(val);
};

const isWorkDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

const countWorkDays = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    if (isWorkDay(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};

// ==========================================
// COMPONENTES AUXILIARES (TOOLTIP E PRAZOS)
// ==========================================

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const payloadData = payload[0].payload;
    const temParada = payloadData.infoParada;
    
    return (
      <div className="bg-white/90 backdrop-blur-md border border-slate-100 p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">{label}</p>
        
        {/* Alerta de Parada se houver impedimento */}
        {temParada && (
          <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1">
              ⚠️ OBRA PARALISADA
            </p>
            <p className="text-[11px] font-bold text-amber-700">
              {temParada.motivo} ({temParada.horas}h)
            </p>
          </div>
        )}
        
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{entry.name}</span>
              </div>
              <span className="text-[12px] font-black text-slate-900">{entry.value}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const ControleDePrazos: React.FC<{ project: Project; dailyLogs: DailyLog[] }> = ({ project, dailyLogs }) => {
  // Filtro de Segurança: Verifica se projeto existe
  if (!project || !project.id) return null;

  const start = new Date(project.dataInicio + 'T00:00:00');
  const end = new Date(project.dataFim + 'T00:00:00');
  const today = new Date();
  
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const elapsedDaysRaw = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.min(totalDays, Math.max(0, elapsedDaysRaw));
  const elapsedPercent = Math.round((elapsedDays / totalDays) * 100);
  
  const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const delayDays = today > end ? Math.ceil((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  const justifiedDelayDays = useMemo(() => {
    let total = 0;
    dailyLogs.forEach(log => {
      // Filtra logs apenas deste projeto
      if (log.obraId === project.id && (log as any).aplicouCascata === true) {
        total += 1;
      }
    });
    return total;
  }, [dailyLogs, project.id]);

  // Data Final Ajustada (considera atrasos justificados)
  const dataFinalAjustada = useMemo(() => {
    const adjustedEnd = new Date(end);
    adjustedEnd.setDate(adjustedEnd.getDate() + justifiedDelayDays);
    return adjustedEnd;
  }, [end, justifiedDelayDays]);

  // Dias a Vencer Recalculados (com base na data ajustada)
  const remainingDaysAdjusted = useMemo(() => {
    return Math.max(0, Math.ceil((dataFinalAjustada.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }, [dataFinalAjustada]);

  // Dias restantes originais (para comparação)
  const remainingDaysOriginal = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm mb-8">
      <div className="flex items-center gap-2 mb-8">
        <h4 className="text-blue-600 font-black text-xs uppercase tracking-[0.2em]">Controle de Prazos</h4>
        <div className="h-px flex-1 bg-slate-50"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center border-b border-slate-50 pb-8 mb-8">
        <div className="md:border-r border-slate-100 last:border-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Prazo Contratual</p>
          <p className="text-5xl font-black text-[#1e293b]">{totalDays}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-2 uppercase">dias corridos</p>
        </div>
        <div className="md:border-r border-slate-100 last:border-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Prazo Decorrido</p>
          <p className="text-5xl font-black text-blue-600">{elapsedDays}</p>
          <p className="text-[11px] font-bold text-slate-500 mt-2 uppercase">dias ({elapsedPercent}%)</p>
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Prazo a Vencer</p>
          <p className={`text-5xl font-black ${delayDays > 0 ? 'text-red-500' : 'text-[#1e293b]'}`}>
            {delayDays > 0 ? delayDays : remainingDays}
          </p>
          <p className={`text-[11px] font-black uppercase mt-2 tracking-widest ${delayDays > 0 ? 'text-red-500' : 'text-slate-500'}`}>
            {delayDays > 0 ? 'DIAS DE ATRASO' : 'DIAS RESTANTES'}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-[0.2em]">
          <span className="text-[#1e293b]">Cronograma da Obra</span>
          <span className="text-slate-400">{start.toLocaleDateString('pt-BR')} à {end.toLocaleDateString('pt-BR')}</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#0f172a] transition-all duration-1000 ease-out" 
            style={{ width: `${elapsedPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Prazo a Vencer - Recalculado com Base na Data Ajustada */}
      {justifiedDelayDays > 0 && (
        <div className="mt-8">
          <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200">
            <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-2">🔄 Nova Previsão</p>
            <p className="text-lg font-black text-orange-600">{dataFinalAjustada.toLocaleDateString('pt-BR')}</p>
            <p className="text-[9px] font-bold text-orange-600 mt-1">({remainingDaysAdjusted} dias)</p>
          </div>
        </div>
      )}

      {justifiedDelayDays > 0 && (
        <div className="mt-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 flex items-center gap-3">
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">⚠ Atraso Justificado</p>
            <p className="text-sm font-black text-amber-700">RDO: +{justifiedDelayDays} {justifiedDelayDays === 1 ? 'dia' : 'dias'} de paralisação</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================

const PlanejamentoView: React.FC<PlanejamentoViewProps> = ({ 
  project, 
  activeTenant, 
  planFeatures, // Usando a nova prop
  onOpenUpgrade, 
  tasks, 
  resources, 
  dailyLogs, 
  onTasksChange 
}) => {
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [modalTab, setModalTab] = useState<'etapa' | 'tarefa'>('tarefa');
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // VERIFICAÇÃO DINÂMICA DE RECURSOS (Substituindo isBasic)
  const hasCurvaSRealizada = planFeatures.includes('Curva S Realizada');

  const [formData, setFormData] = useState({
    nome: '',
    inicio: '',
    fim: '',
    parentWbs: '', 
    predecessoraId: '', 
    peso: 0,
    isAutoWeight: true,
    alocacoes: [] as { recursoId: string; quantidade: number }[]
  });

  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [resourceQty, setResourceQty] = useState(1);

  useEffect(() => {
    const handleClick = () => setActiveActionMenuId(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // ------------------------------------------
  // MOTOR DE CRONOGRAMA (RESTAURADO DO BKP)
  // ------------------------------------------
  
  const addDays = (dateStr: string, days: number): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const applyCascade = (allTasks: Task[], changedTaskId: string, newEndDate: string): Task[] => {
    let updated = [...allTasks];
    const successors = updated.filter(t => t.dependencias.includes(changedTaskId));
    
    successors.forEach(succ => {
      const nextStart = addDays(newEndDate, 1);
      const nextEnd = addDays(nextStart, succ.duracaoDias - 1);
      
      updated = updated.map(t => 
        t.id === succ.id 
          ? { ...t, inicioPlanejado: nextStart, fimPlanejado: nextEnd }
          : t
      );
      updated = applyCascade(updated, succ.id, nextEnd);
    });
    return updated;
  };

  const redistributeWeights = (allTasks: Task[], obraId: string): Task[] => {
    let updated = [...allTasks];
    const projTasks = updated.filter(t => t.obraId === obraId);
    const stages = projTasks.filter(t => !t.wbs.includes('.'));

    stages.forEach(stage => {
      const children = updated.filter(t => t.obraId === obraId && t.wbs.startsWith(`${stage.wbs}.`));
      const autoChildren = children.filter(c => c.isAutoWeight !== false);
      const manualChildren = children.filter(c => c.isAutoWeight === false);

      if (autoChildren.length > 0) {
        const manualSum = manualChildren.reduce((acc, c) => acc + c.peso, 0);
        const remainingWeight = Math.max(0, 100 - manualSum);
        const totalDuration = autoChildren.reduce((acc, c) => acc + countWorkDays(c.inicioPlanejado, c.fimPlanejado), 0);

        if (totalDuration > 0) {
          let distributedSoFar = 0;
          autoChildren.forEach((child, idx) => {
            let p = 0;
            if (idx === autoChildren.length - 1) {
              p = remainingWeight - distributedSoFar;
            } else {
              const dur = countWorkDays(child.inicioPlanejado, child.fimPlanejado);
              p = (dur / totalDuration) * remainingWeight;
              distributedSoFar += Number(p.toFixed(2));
            }
            updated = updated.map(t => t.id === child.id ? { ...t, peso: Number(p.toFixed(2)), isAutoWeight: true } : t);
          });
        }
      }
    });

    return updated;
  };

  // Automação de Datas via Predecessora
  useEffect(() => {
    if (modalTab === 'tarefa' && formData.predecessoraId && !editingTask) {
      const pred = tasks.find(t => t.id === formData.predecessoraId);
      if (pred) {
        const nextStart = addDays(pred.fimPlanejado, 1);
        const currentDur = duration || 1;
        setFormData(prev => ({ 
          ...prev, 
          inicio: nextStart, 
          fim: addDays(nextStart, currentDur - 1) 
        }));
      }
    }
  }, [formData.predecessoraId]);

  // ------------------------------------------
  // MEMOS E INTELIGÊNCIA DE DADOS
  // ------------------------------------------

  const projectTasksSorted = useMemo(() => {
    return tasks
      .filter(t => t.obraId === project.id)
      .sort((a, b) => {
        const aWbs = a.wbs.split('.').map(Number);
        const bWbs = b.wbs.split('.').map(Number);
        for (let i = 0; i < Math.max(aWbs.length, bWbs.length); i++) {
          const aVal = aWbs[i] || 0;
          const bVal = bWbs[i] || 0;
          if (aVal !== bVal) return aVal - bVal;
        }
        return 0;
      });
  }, [tasks, project.id]);

  const parentStages = useMemo(() => {
    return projectTasksSorted.filter(t => !t.wbs.includes('.'));
  }, [projectTasksSorted]);

  const availablePredecessors = useMemo(() => {
    return projectTasksSorted.filter(t => t.wbs.includes('.')); 
  }, [projectTasksSorted]);

  const stageWeightValidation = useMemo(() => {
    const validation: Record<string, number> = {};
    parentStages.forEach(stage => {
      const children = projectTasksSorted.filter(t => t.wbs.startsWith(`${stage.wbs}.`));
      const sum = children.reduce((acc, curr) => acc + curr.peso, 0);
      validation[stage.wbs] = Number(sum.toFixed(2));
    });
    return validation;
  }, [projectTasksSorted, parentStages]);

  const resourceSynergyAlert = useMemo(() => {
    if (!formData.predecessoraId || formData.alocacoes.length === 0) return null;
    const pred = tasks.find(t => t.id === formData.predecessoraId);
    if (!pred) return null;
    
    const commonResources = formData.alocacoes.filter(a => 
      pred.alocacoes.some(pa => pa.recursoId === a.recursoId)
    );
    
    if (commonResources.length > 0) {
      const resNames = commonResources.map(cr => resources.find(r => r.id === cr.recursoId)?.nome).join(', ');
      return `Otimização: O recurso (${resNames}) já está mobilizado na tarefa anterior. Sinergia logística!`;
    }
    return null;
  }, [formData.predecessoraId, formData.alocacoes, tasks, resources]);

  const duration = useMemo(() => {
    if (!formData.inicio || !formData.fim) return 0;
    const d1 = new Date(formData.inicio + 'T00:00:00');
    const d2 = new Date(formData.fim + 'T00:00:00');
    return Math.max(1, Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [formData.inicio, formData.fim]);

  const totalEstimatedHH = useMemo(() => {
    return formData.alocacoes.reduce((acc, curr) => acc + (curr.quantidade * 8 * duration), 0);
  }, [formData.alocacoes, duration]);

  // Mapeamento de Datas com Impedimentos (Paradas)
  const pauseDates = useMemo(() => {
    // Filtro de Segurança: Verifica se projeto existe antes de processar
    if (!project || !project.id) return new Set<string>();
    
    const datesWithImpediments = new Set<string>();
    dailyLogs.forEach(log => {
      // Filtra logs apenas deste projeto
      if (log.obraId === project.id && log.impedimentos && log.impedimentos.length > 0) {
        // Converter data YYYY-MM-DD para DD/MM (formato usado no gráfico)
        const date = new Date(log.data + 'T00:00:00');
        const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        datesWithImpediments.add(formattedDate);
      }
    });
    return datesWithImpediments;
  }, [dailyLogs, project]);

  // Total de Dias Perdidos por Paradas (com filtro por obraId)
  const totalDiasPerdidos = useMemo(() => {
    // Filtro de Segurança: Verifica se projeto existe
    if (!project || !project.id) return 0;
    
    let total = 0;
    dailyLogs.forEach(log => {
      // Filtra logs apenas deste projeto
      if (log.obraId === project.id && log.impedimentos && log.impedimentos.length > 0) {
        log.impedimentos.forEach(imp => {
          total += Math.ceil(imp.horasPerdidas / 8); // Converter horas em dias
        });
      }
    });
    return total;
  }, [dailyLogs, project]);

  // Curva S Acumulada (Lógica Real vs Plano restaurada)
  const scurveData = useMemo(() => {
    const allStagesValid = parentStages.every(s => {
      const children = projectTasksSorted.filter(t => t.wbs.startsWith(`${s.wbs}.`));
      return children.length === 0 || stageWeightValidation[s.wbs] === 100;
    });

    if (!allStagesValid || projectTasksSorted.length === 0) return [];

    const dates = new Set<string>();
    projectTasksSorted.forEach(t => {
      dates.add(t.inicioPlanejado);
      dates.add(t.fimPlanejado);
    });
    const sortedDates = Array.from(dates).sort();
    if (sortedDates.length < 2) return [];

    const start = new Date(sortedDates[0] + 'T00:00:00');
    const end = new Date(sortedDates[sortedDates.length - 1] + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Mapa de impedimentos por data para acesso rápido
    const impedimentosPorData: Record<string, any[]> = {};
    dailyLogs.forEach(log => {
      if (log.obraId === project.id && log.impedimentos && log.impedimentos.length > 0) {
        if (!impedimentosPorData[log.data]) {
          impedimentosPorData[log.data] = [];
        }
        impedimentosPorData[log.data].push(...log.impedimentos);
      }
    });

    const result = [{ date: 'Início', planejado: 0, realizado: 0, infoParada: null }];
    let current = new Date(start);
    
    const subtasks = projectTasksSorted.filter(t => t.wbs.includes('.'));
    const taskImpacts = subtasks.map(t => ({
      id: t.id,
      peso: t.peso,
      start: new Date(t.inicioPlanejado + 'T00:00:00'),
      end: new Date(t.fimPlanejado + 'T00:00:00'),
      dailyVal: t.peso / Math.max(1, countWorkDays(t.inicioPlanejado, t.fimPlanejado)),
      totalQtd: t.qtdPlanejada,
      qtdRealizadaTotal: t.qtdRealizada
    }));

    let cumPlanned = 0;
    while (current <= end) {
      if (isWorkDay(current)) {
        const dStr = current.toISOString().split('T')[0];
        const currentTime = current.getTime();

        taskImpacts.forEach(ti => {
          if (currentTime >= ti.start.getTime() && currentTime <= ti.end.getTime()) {
            cumPlanned += ti.dailyVal;
          }
        });

        let cumReal: number | null = null;
        if (currentTime < today.getTime()) {
          const logsUntil = dailyLogs.filter(l => l.data <= dStr && l.obraId === project.id);
          const progressByTask: Record<string, number> = {};
          logsUntil.forEach(l => l.avancos.forEach(av => progressByTask[av.tarefaId] = (progressByTask[av.tarefaId] || 0) + av.quantidade));
          
          cumReal = subtasks.reduce((acc, t) => {
            const qty = progressByTask[t.id] || 0;
            return acc + (Math.min(1, qty / t.qtdPlanejada) * t.peso);
          }, 0);
        } else if (currentTime === today.getTime()) {
          cumReal = subtasks.reduce((acc, t) => acc + ((t.qtdRealizada / t.qtdPlanejada) * t.peso), 0);
        }

        // Verificar se há impedimento nesta data
        const infoParada = impedimentosPorData[dStr] 
          ? {
              motivo: impedimentosPorData[dStr][0].motivo,
              horas: impedimentosPorData[dStr].reduce((sum, imp) => sum + imp.horasPerdidas, 0)
            }
          : null;

        const dateFormatted = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

        result.push({
          date: dateFormatted,
          planejado: Number(Math.min(100, cumPlanned).toFixed(2)),
          realizado: cumReal !== null ? Number(Math.min(100, cumReal).toFixed(2)) : null,
          infoParada: infoParada
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return result;
  }, [projectTasksSorted, dailyLogs, stageWeightValidation, parentStages, project.id]);

  const scheduleDeviationStats = useMemo(() => {
    if (scurveData.length === 0) return null;
    const todayStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    let entry = scurveData.find(d => d.date === todayStr) || scurveData.filter(d => d.realizado !== null).pop();
    if (!entry) return null;
    return { 
      planejado: entry.planejado, 
      realizado: entry.realizado || 0, 
      desvio: Number(((entry.realizado || 0) - entry.planejado).toFixed(2)) 
    };
  }, [scurveData]);

  // ------------------------------------------
  // HANDLERS E CRUD
  // ------------------------------------------

  const resetForm = () => {
    setFormData({
      nome: '', inicio: '', fim: '', parentWbs: '', predecessoraId: '', peso: 0, isAutoWeight: true, alocacoes: []
    });
    setSelectedResourceId('');
    setResourceQty(1);
    setEditingTask(null);
    setCurrentStep(1);
  };

  const handleOpenAdd = () => {
    resetForm();
    setModalTab(parentStages.length === 0 ? 'etapa' : 'tarefa');
    setShowModal(true);
  };

  const handleConfirmTask = () => {
    if (!formData.nome || !formData.inicio || !formData.fim) {
      alert("Campos obrigatórios ausentes.");
      return;
    }
    if (modalTab === 'tarefa' && !formData.parentWbs) {
      alert("Selecione uma etapa pai.");
      return;
    }

    let updatedTasks = [...tasks];
    const durationDays = Math.max(1, Math.ceil((new Date(formData.fim).getTime() - new Date(formData.inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1);

    if (editingTask) {
      updatedTasks = updatedTasks.map(t => t.id === editingTask.id ? {
        ...t,
        nome: formData.nome, inicioPlanejado: formData.inicio, fimPlanejado: formData.fim, duracaoDias: durationDays,
        dependencias: formData.predecessoraId ? [formData.predecessoraId] : [], peso: formData.peso, isAutoWeight: formData.isAutoWeight, alocacoes: formData.alocacoes
      } : t);
      updatedTasks = applyCascade(updatedTasks, editingTask.id, formData.fim);
    } else {
      let finalWbs = '';
      if (modalTab === 'etapa') {
        const lastIdx = parentStages.length > 0 ? Math.max(...parentStages.map(p => Number(p.wbs))) : 0;
        finalWbs = (lastIdx + 1).toString();
      } else {
        const siblings = projectTasksSorted.filter(t => t.wbs.startsWith(`${formData.parentWbs}.`));
        const lastSubIdx = siblings.length > 0 ? Math.max(...siblings.map(s => Number(s.wbs.split('.').pop()))) : 0;
        finalWbs = `${formData.parentWbs}.${lastSubIdx + 1}`;
      }

      const newTask: Task = {
        id: `task-${Date.now()}`,
        tenantId: project.tenantId,
        obraId: project.id, 
        nome: formData.nome, 
        wbs: finalWbs, 
        duracaoDias: durationDays,
        inicioPlanejado: formData.inicio, 
        fimPlanejado: formData.fim, 
        dependencias: formData.predecessoraId ? [formData.predecessoraId] : [],
        unidadeId: 'un1', 
        qtdPlanejada: 100, 
        qtdRealizada: 0, 
        peso: modalTab === 'etapa' ? 0 : formData.peso,
        isAutoWeight: modalTab === 'etapa' ? false : formData.isAutoWeight, 
        custoPlanejado: 0, 
        custoRealizado: 0,
        alocacoes: modalTab === 'etapa' ? [] : formData.alocacoes
      };
      updatedTasks.push(newTask);
    }

    onTasksChange(redistributeWeights(updatedTasks, project.id));
    setShowModal(false);
    resetForm();
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    const isParent = !task.wbs.includes('.');
    setModalTab(isParent ? 'etapa' : 'tarefa');
    setFormData({
      nome: task.nome, inicio: task.inicioPlanejado, fim: task.fimPlanejado,
      parentWbs: !isParent ? task.wbs.split('.')[0] : '', 
      predecessoraId: task.dependencias[0] || '',
      peso: task.peso, 
      isAutoWeight: task.isAutoWeight !== false, 
      alocacoes: task.alocacoes
    });
    setCurrentStep(1);
    setShowModal(true);
    setActiveActionMenuId(null);
  };

  const handleDuplicateTask = (task: Task) => {
    const isParent = !task.wbs.includes('.');
    if (isParent) return;
    const siblings = projectTasksSorted.filter(t => t.wbs.startsWith(`${task.wbs.split('.')[0]}.`));
    const lastSubIdx = siblings.length > 0 ? Math.max(...siblings.map(s => Number(s.wbs.split('.').pop()))) : 0;
    const newWbs = `${task.wbs.split('.')[0]}.${lastSubIdx + 1}`;
    const newTask: Task = { ...task, id: `task-${Date.now()}`, wbs: newWbs, nome: `${task.nome} (Cópia)`, qtdRealizada: 0, inicioReal: undefined, fimReal: undefined };
    onTasksChange(redistributeWeights([...tasks, newTask], project.id));
    setActiveActionMenuId(null);
  };

  const handleDeleteTask = (task: Task) => {
    if (window.confirm(`Deseja excluir "${task.nome}"?`)) {
      onTasksChange(redistributeWeights(tasks.filter(t => t.id !== task.id && !t.wbs.startsWith(`${task.wbs}.`)), project.id));
    }
    setActiveActionMenuId(null);
  };

  const handleAddResource = () => {
    if (!selectedResourceId) return;
    setFormData(prev => {
      const exists = prev.alocacoes.find(a => a.recursoId === selectedResourceId);
      if (exists) return { ...prev, alocacoes: prev.alocacoes.map(a => a.recursoId === selectedResourceId ? { ...a, quantidade: a.quantidade + resourceQty } : a) };
      return { ...prev, alocacoes: [...prev.alocacoes, { recursoId: selectedResourceId, quantidade: resourceQty }] };
    });
    setSelectedResourceId('');
    setResourceQty(1);
  };

  const today_check = new Date();
  today_check.setHours(0, 0, 0, 0);

  // ------------------------------------------
  // RENDERIZAÇÃO
  // ------------------------------------------

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-[#1e293b]">Planejamento Físico-Financeiro</h2>
          <p className="text-slate-400 text-sm font-medium">Gestão dinâmica de {project.nome}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 shadow-sm flex items-center gap-2 uppercase tracking-widest">
            <Info size={14} className="text-blue-500" /> {project.nome}
          </div>
          <button onClick={handleOpenAdd} className="flex items-center gap-2 px-6 py-3 bg-[#0f172a] text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 uppercase tracking-widest active:scale-95">
            <Plus size={16} /> Nova Atividade
          </button>
        </div>
      </div>

      <ControleDePrazos project={project} dailyLogs={dailyLogs} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden">
          <h3 className="text-xs font-black text-[#1e293b] mb-1 uppercase tracking-[0.2em]">CURVA S DE EXECUÇÃO (%)</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-8">Avanço físico acumulado (Real vs Plano)</p>
          
          {/* TRAVA DINÂMICA: CURVA S */}
          <div className={`h-[250px] transition-all duration-500 ${!hasCurvaSRealizada ? 'blur-md grayscale' : ''}`}>
            {scurveData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scurveData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" fontSize={9} axisLine={false} tickLine={false} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  {/* Renderize ReferenceArea para datas com impedimentos */}
                  {Array.from(pauseDates).map((date, idx) => (
                    <ReferenceArea key={idx} x1={date} x2={date} fill="#fee2e2" fillOpacity={0.3} />
                  ))}
                  <Area type="monotone" dataKey="planejado" stroke="#2563eb" fillOpacity={0.1} fill="#3b82f6" name="Planejado" />
                  <Area type="monotone" dataKey="realizado" stroke="#10b981" strokeWidth={3} fillOpacity={0.05} fill="#10b981" name="Realizado" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-8">
                <AlertTriangle size={32} className="mb-2 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Aguardando definição de pesos</p>
              </div>
            )}
          </div>

          {!hasCurvaSRealizada && (
            <div className="absolute inset-0 bg-white/40 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-xl mb-4">
                <Lock size={28} fill="currentColor" />
              </div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Curva S de Realizado</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-6 leading-relaxed">Este recurso exige o <span className="text-blue-600">Plano PRO</span> para cruzar dados do RDO.</p>
              <button 
                onClick={onOpenUpgrade}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-blue-700 transition-all active:scale-95"
              >
                Liberar no Plano PRO
              </button>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-[24px] border border-slate-100 shadow-sm flex flex-col relative overflow-hidden">
          <h3 className="text-xs font-black text-[#1e293b] mb-1 uppercase tracking-[0.2em]">DESVIO DE CRONOGRAMA</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-8">Performance Físico-Temporal</p>
          
          {/* TRAVA DINÂMICA: PAINEL DESVIO */}
          <div className={`flex-1 flex flex-col transition-all duration-500 ${!hasCurvaSRealizada ? 'blur-md grayscale' : ''}`}>
            {scheduleDeviationStats ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Planejado</p>
                    <p className="text-xl font-black text-blue-600">{scheduleDeviationStats.planejado}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Realizado</p>
                    <p className="text-xl font-black text-emerald-600">{scheduleDeviationStats.realizado}%</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${scheduleDeviationStats.desvio < 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Desvio (GAP)</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xl font-black ${scheduleDeviationStats.desvio < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {scheduleDeviationStats.desvio > 0 ? '+' : ''}{scheduleDeviationStats.desvio}%
                      </span>
                      {scheduleDeviationStats.desvio < 0 ? <TrendingDown size={16} className="text-red-500" /> : <TrendingUp size={16} className="text-emerald-500" />}
                    </div>
                  </div>
                </div>

                {/* Badge de Dias Perdidos por Paradas */}
                {project && project.id && totalDiasPerdidos > 0 && (
                  <div className="mb-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 flex items-center gap-3">
                    <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-black text-amber-900 uppercase tracking-widest">⚠ Impacto de Paradas</p>
                      <p className="text-sm font-black text-amber-700">{totalDiasPerdidos} dias de paralisação registrados no Diário</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4 mb-8">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Progresso Alvo</span>
                      <span>{scheduleDeviationStats.planejado}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${scheduleDeviationStats.planejado}%` }}></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                      <span>Progresso Real</span>
                      <span className={scheduleDeviationStats.desvio < 0 ? 'text-orange-500' : 'text-emerald-500'}>{scheduleDeviationStats.realizado}%</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${scheduleDeviationStats.desvio < 0 ? 'bg-orange-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${scheduleDeviationStats.realizado}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className={`mt-auto p-4 rounded-2xl flex items-center gap-3 border ${scheduleDeviationStats.desvio < -5 ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'}`}>
                  {scheduleDeviationStats.desvio < -5 ? (
                     <AlertTriangle size={20} className="text-red-500 shrink-0" />
                  ) : (
                     <Activity size={20} className="text-blue-500 shrink-0" />
                  )}
                  <p className={`text-[10px] font-bold uppercase tracking-tight ${scheduleDeviationStats.desvio < -5 ? 'text-red-700' : 'text-blue-700'}`}>
                    {scheduleDeviationStats.desvio < -5 ? 'Atenção: Ritmo de produção abaixo do planejado.' : 'Produção estável conforme planejamento.'}
                  </p>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Aguardando dados...</p>
              </div>
            )}
          </div>

          {!hasCurvaSRealizada && (
            <div className="absolute inset-0 bg-white/40 flex flex-col items-center justify-center p-10 text-center">
              <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-xl mb-4">
                <Lock size={28} fill="currentColor" />
              </div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-2">Painel de Desvio GAP</h4>
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-6">Bloqueado no plano atual.</p>
              <button 
                onClick={onOpenUpgrade}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-slate-800 transition-all active:scale-95"
              >
                Desbloquear Agora
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-50 uppercase text-[10px] font-black text-slate-400 tracking-[0.2em]">
                <th className="px-8 py-6 w-20">WBS</th>
                <th className="px-8 py-6">Atividade</th>
                <th className="px-8 py-6 text-center">Peso</th>
                <th className="px-8 py-6 text-center">Início</th>
                <th className="px-8 py-6 text-center">Fim</th>
                <th className="px-8 py-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projectTasksSorted.map((task, index) => {
                const isParent = !task.wbs.includes('.');
                const progress = isParent 
                  ? projectTasksSorted.filter(t => t.wbs.startsWith(`${task.wbs}.`)).reduce((acc, t) => acc + (t.peso * (t.qtdRealizada / t.qtdPlanejada)), 0) 
                  : (task.qtdRealizada / task.qtdPlanejada) * 100;
                
                const weightError = isParent && stageWeightValidation[task.wbs] !== 100 && projectTasksSorted.some(t => t.wbs.startsWith(`${task.wbs}.`));
                const predecessor = task.dependencias[0] ? projectTasksSorted.find(t => t.id === task.dependencias[0]) : null;
                
                const taskEnd = new Date(task.fimPlanejado + 'T00:00:00');
                let statusBadge = null;
                if (task.qtdRealizada >= task.qtdPlanejada) {
                  statusBadge = <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase whitespace-nowrap">CONCLUÍDA</span>;
                } else if (today_check > taskEnd) {
                  statusBadge = <span className="px-2 py-0.5 rounded-lg bg-red-50 text-red-600 text-[8px] font-black uppercase whitespace-nowrap">ATRASADA</span>;
                } else {
                  statusBadge = <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-600 text-[8px] font-black uppercase whitespace-nowrap">EM DIA</span>;
                }

                return (
                  <tr key={task.id} className={`${isParent ? 'bg-slate-50/80' : 'hover:bg-slate-50/30'}`}>
                    <td className="px-8 py-5 text-[11px] font-black text-slate-400">{task.wbs}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        {isParent ? <Folder size={16} className="text-blue-600 shrink-0" /> : <CornerDownRight size={14} className="text-slate-300 ml-4 shrink-0" />}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            {statusBadge}
                            <p className={`text-[13px] uppercase tracking-tight ${isParent ? 'font-black text-slate-800' : 'font-bold text-slate-600'}`}>{task.nome}</p>
                            {weightError && (
                              <span title={`Soma ≠ 100% (${stageWeightValidation[task.wbs]}%)`}>
                                <AlertTriangle size={12} className="text-orange-500 animate-pulse" />
                              </span>
                            )}
                          </div>
                          {predecessor && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-blue-500">
                               <LinkIcon size={10} className="rotate-45" />
                               <span className="text-[9px] font-black uppercase">Precedente: {predecessor.wbs}</span>
                            </div>
                          )}
                          {task.alocacoes && task.alocacoes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {task.alocacoes.map(aloc => {
                                const res = resources.find(r => r.id === aloc.recursoId);
                                return (
                                  <div key={aloc.recursoId} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-100 rounded text-[8px] font-black text-blue-600 uppercase tracking-tighter">
                                    <Users size={10} />
                                    <span>{aloc.quantidade} {res?.nome || 'Recurso'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 w-48">
                            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${isParent ? 'bg-blue-600' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div></div>
                            <span className={`text-[9px] font-black ${isParent ? 'text-blue-600' : 'text-emerald-600'}`}>{Math.round(progress)}%</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 ${isParent ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                        {task.peso.toFixed(2)}% {!isParent && task.isAutoWeight !== false && <RefreshCw size={10} className="animate-spin-slow text-blue-400" />}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center text-[11px] font-bold text-slate-500">{new Date(task.inicioPlanejado + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-8 py-5 text-center text-[11px] font-bold text-slate-500">{new Date(task.fimPlanejado + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-8 py-5 text-right relative">
                      <button onClick={e => { e.stopPropagation(); setActiveActionMenuId(activeActionMenuId === task.id ? null : task.id); }} className="p-2 text-slate-300 hover:text-slate-800"><MoreHorizontal size={20} /></button>
                      {activeActionMenuId === task.id && (
                        <div className={`absolute right-8 ${index >= projectTasksSorted.length - 2 ? 'bottom-full mb-2' : 'top-10'} bg-white border border-slate-100 rounded-xl shadow-xl z-30 py-2 w-48 text-left animate-in fade-in zoom-in-95`}>
                          <button onClick={() => handleEditTask(task)} className="w-full px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase hover:bg-slate-50 text-slate-600"><Edit2 size={14} /> Editar</button>
                          {!isParent && <button onClick={() => handleDuplicateTask(task)} className="w-full px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase hover:bg-slate-50 text-slate-600"><Copy size={14} /> Duplicar</button>}
                          <button onClick={() => handleDeleteTask(task)} className="w-full px-4 py-2 flex items-center gap-2 text-[10px] font-black uppercase hover:bg-red-50 text-red-500"><Trash2 size={14} /> Excluir</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in overflow-hidden">
          <div className="bg-white w-full max-w-4xl max-h-[500px] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
            
            <div className="px-8 py-4 border-b border-slate-100 bg-white shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xl font-black text-[#1e293b] tracking-tight uppercase">{editingTask ? 'Ajustar Registro' : 'Novo Registro'}</h3>
                  <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Sincronização de Cronograma e Ativos</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"><X size={22} /></button>
              </div>
              
              {!editingTask && (
                <div className="flex gap-3">
                  <button onClick={() => { setModalTab('etapa'); setCurrentStep(1); }} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${modalTab === 'etapa' ? 'bg-[#0f172a] text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}><Layers size={14} className="inline mr-2" /> Estrutura (Etapa)</button>
                  <button onClick={() => { setModalTab('tarefa'); setCurrentStep(1); }} className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${modalTab === 'tarefa' ? 'bg-[#0f172a] text-white shadow-lg' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}><ListTodo size={14} className="inline mr-2" /> Campo (Atividade)</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide bg-slate-50/20">
              {resourceSynergyAlert && currentStep === 2 && modalTab === 'tarefa' && (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-3 mb-6 animate-in slide-in-from-top-2">
                  <Zap size={18} className="text-emerald-500 shrink-0" />
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">{resourceSynergyAlert}</p>
                </div>
              )}

              {modalTab === 'etapa' && (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome da Etapa</label>
                      <input type="text" value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} placeholder="Ex: Fundações e Estrutura" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Início</label>
                      <input type="date" value={formData.inicio} onChange={e => setFormData(p => ({...p, inicio: e.target.value}))} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Término</label>
                      <input type="date" value={formData.fim} onChange={e => setFormData(p => ({...p, fim: e.target.value}))} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {modalTab === 'tarefa' && (
                <>
                  {currentStep === 1 && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome da Atividade</label>
                          <input type="text" value={formData.nome} onChange={e => setFormData(p => ({...p, nome: e.target.value}))} placeholder="Ex: Armação de Laje L1" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100" />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Etapa Pai</label>
                          <select disabled={!!editingTask} value={formData.parentWbs} onChange={e => setFormData(p => ({...p, parentWbs: e.target.value}))} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer">
                            <option value="">Selecione...</option>
                            {parentStages.map(s => <option key={s.id} value={s.wbs}>{s.wbs} - {s.nome}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Predecessora (FS)</label>
                          <select value={formData.predecessoraId} onChange={e => setFormData(p => ({...p, predecessoraId: e.target.value}))} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none">
                            <option value="">Nenhuma</option>
                            {availablePredecessors.filter(p => p.id !== editingTask?.id).map(p => <option key={p.id} value={p.id}>{p.wbs} - {p.nome}</option>)}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">Início Planejado {formData.predecessoraId && <Lock size={10} className="text-orange-400" />}</label>
                          <input type="date" readOnly={!!formData.predecessoraId} value={formData.inicio} onChange={e => setFormData(p => ({...p, inicio: e.target.value}))} className={`w-full border px-4 py-2.5 rounded-xl text-xs font-bold outline-none ${formData.predecessoraId ? 'bg-orange-50/20 border-orange-100 cursor-not-allowed' : 'bg-white border-slate-200'}`} />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Término Planejado</label>
                          <input type="date" value={formData.fim} onChange={e => setFormData(p => ({...p, fim: e.target.value}))} className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#0f172a] p-4 rounded-2xl text-white shadow-lg">
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">Esforço Total Estimado</p>
                          <p className="text-xl font-black">{formatNumber(totalEstimatedHH)} h</p>
                        </div>
                        <div className="bg-blue-600 p-4 rounded-2xl text-white shadow-lg">
                          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 mb-1">Duração Cronológica</p>
                          <p className="text-xl font-black">{duration} dias</p>
                        </div>

                        <div className={`col-span-2 p-4 rounded-2xl border flex items-center justify-between ${formData.isAutoWeight ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-200'}`}>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Peso Físico na Obra</p>
                            <div className="flex items-baseline gap-1">
                              <input 
                                type="number" 
                                readOnly={formData.isAutoWeight}
                                value={formData.peso} 
                                onChange={e => setFormData(p => ({...p, peso: Number(e.target.value)}))} 
                                className={`bg-transparent text-xl font-black outline-none w-20 ${formData.isAutoWeight ? 'text-blue-600' : 'text-slate-800'}`} 
                              />
                              <span className={`text-sm font-black ${formData.isAutoWeight ? 'text-blue-600' : 'text-slate-800'}`}>%</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => setFormData(p => ({...p, isAutoWeight: !p.isAutoWeight}))}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${formData.isAutoWeight ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                          >
                            {formData.isAutoWeight ? <><ToggleRight size={16} /> Automático</> : <><ToggleLeft size={16} /> Manual</>}
                          </button>
                        </div>

                        <div className="col-span-2 pt-2 border-t border-slate-100">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-3 block flex items-center gap-2"><Users size={12} className="text-blue-600" /> Dimensionamento de Equipe</label>
                          <div className="space-y-2 mb-4">
                            {formData.alocacoes.map(aloc => (
                              <div key={aloc.recursoId} className="flex items-center justify-between bg-white border border-slate-100 p-2.5 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-black text-[10px]">{aloc.quantidade}</div>
                                  <p className="text-[10px] font-black text-slate-700 uppercase">{resources.find(r => r.id === aloc.recursoId)?.nome}</p>
                                </div>
                                <button onClick={() => setFormData(p => ({...p, alocacoes: p.alocacoes.filter(a => a.recursoId !== aloc.recursoId)}))} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <select value={selectedResourceId} onChange={e => setSelectedResourceId(e.target.value)} className="flex-1 bg-white border border-slate-200 px-3 py-2 rounded-lg text-[10px] font-black uppercase">
                              <option value="">Selecionar Recurso...</option>
                              {resources.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                            </select>
                            <input type="number" min="1" value={resourceQty} onChange={e => setResourceQty(Number(e.target.value))} className="w-14 bg-white border border-slate-200 px-2 py-2 rounded-lg text-center text-xs font-black" />
                            <button onClick={handleAddResource} className="bg-[#0f172a] text-white px-3 rounded-lg hover:bg-slate-800 shadow-sm shrink-0 transition-colors"><Plus size={18} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
               <div className="flex items-center gap-4">
                 <button onClick={() => setShowModal(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                 {modalTab === 'tarefa' && (
                    <div className="flex gap-2 ml-2">
                       <div className={`w-2 h-2 rounded-full transition-all ${currentStep === 1 ? 'bg-blue-600 w-5' : 'bg-slate-200 cursor-pointer'}`} onClick={() => setCurrentStep(1)}></div>
                       <div className={`w-2 h-2 rounded-full transition-all ${currentStep === 2 ? 'bg-blue-600 w-5' : 'bg-slate-200 cursor-pointer'}`} onClick={() => setCurrentStep(2)}></div>
                    </div>
                 )}
               </div>

               <div className="flex items-center gap-4">
                  {modalTab === 'tarefa' && currentStep === 2 && formData.parentWbs && (
                    <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border ${stageWeightValidation[formData.parentWbs] === 100 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-yellow-50 border-yellow-100 text-yellow-700'}`}>
                      {stageWeightValidation[formData.parentWbs] === 100 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      <span className="text-[9px] font-black uppercase tracking-tighter">{stageWeightValidation[formData.parentWbs]}% da Etapa</span>
                    </div>
                  )}

                  {modalTab === 'tarefa' && currentStep === 1 ? (
                    <button 
                      onClick={() => setCurrentStep(2)}
                      className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95"
                    >
                      Configurar Equipe <ChevronRight size={14} />
                    </button>
                  ) : (
                    <>
                      {modalTab === 'tarefa' && <button onClick={() => setCurrentStep(1)} className="text-slate-400 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:text-slate-600 transition-colors"><ChevronLeft size={14} /> Voltar</button>}
                      <button 
                        onClick={handleConfirmTask} 
                        className="bg-blue-600 text-white px-10 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95"
                      >
                        {editingTask ? 'Salvar Alterações' : 'Concluir Registro'}
                      </button>
                    </>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanejamentoView;