
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Task, DailyLog, Tenant, Resource } from '../types';
import { EmptyProjectState } from '../components/EmptyProjectState';
import {
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Cloud,
  Calendar,
  Layers,
  Users,
  Clock,
  TrendingUp,
  Info,
  ChevronLeft,
  ChevronUp,
  Activity,
  Filter,
  RefreshCw,
  Download,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GanttChartViewProps {
  projects: Project[];
  tasks: Task[];
  resources: Resource[];
  dailyLogs: DailyLog[];
  tenant: Tenant;
  onTasksChange: (tasks: Task[]) => void;
  onRemoveTask?: (taskId: string) => Promise<void>;
  setActiveTab?: (tab: string) => void;
  selectedProjectId?: string;
}

type ZoomLevel = 'dias' | 'semanas' | 'meses';
type SortField = 'wbs' | 'nome' | 'inicio' | 'fim' | 'critico';

// ==================== CONSTANTES ====================
const COLUMN_WIDTH_CONFIG = {
  dias: 40,
  semanas: 120,
  meses: 200,
};

const GanttChartView: React.FC<GanttChartViewProps> = ({
  projects,
  tasks,
  resources,
  dailyLogs,
  tenant,
  onTasksChange,
  onRemoveTask,
  setActiveTab,
  selectedProjectId: selectedProjectIdProp,
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(selectedProjectIdProp || '');
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('semanas');
  const [sortBy, setSortBy] = useState<SortField>('wbs');
  const [expandedWBS, setExpandedWBS] = useState<Set<string>>(new Set());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  useEffect(() => {
    setSelectedProjectId(selectedProjectIdProp || '');
  }, [selectedProjectIdProp]);

  const COLUMN_WIDTH = COLUMN_WIDTH_CONFIG[zoomLevel];

  // ==================== DRAG AND DROP HORIZONTAL SCROLL ====================

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    setIsDragging(true);
    setDragStart(e.clientX + timelineRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !timelineRef.current) return;
    e.preventDefault();
    const x = e.clientX;
    const walk = dragStart - x;
    timelineRef.current.scrollLeft = walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // ==================== HELPERS ====================

  const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
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
  }

  const diffDays = (startStr: string, endStr: string): number => {
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T00:00:00');
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ==================== LÓGICA DE CASCATA E CAMINHO CRÍTICO ====================

  const calculateCriticalPath = (projectTasks: Task[]): Set<string> => {
    const critical = new Set<string>();
    const projectEnd = new Date(Math.max(...projectTasks.map(t => new Date(t.fimPlanejado).getTime())));

    projectTasks.forEach(task => {
      const endDate = new Date(task.fimPlanejado + 'T00:00:00');
      const followers = projectTasks.filter(t => t.dependencias.includes(task.id));

      if (endDate.toISOString().split('T')[0] === projectEnd.toISOString().split('T')[0]) {
        if (followers.length === 0) {
          critical.add(task.id);
          return;
        }
      }

      // Se todos os sucessores estão no caminho crítico, esta tarefa também está
      if (followers.length > 0 && followers.every(f => critical.has(f.id))) {
        critical.add(task.id);
      }
    });

    return critical;
  };

  const calculateTaskDelay = (task: Task): number => {
    if (!task.inicioReal || !task.fimReal) return 0;
    const plannedEnd = new Date(task.fimPlanejado + 'T00:00:00');
    const realEnd = new Date(task.fimReal + 'T00:00:00');
    return Math.max(0, diffDays(task.fimPlanejado, task.fimReal));
  };

  const getTaskProgress = (task: Task): number => {
    if (task.qtdPlanejada === 0) return 0;
    return Math.min(100, (task.qtdRealizada / task.qtdPlanejada) * 100);
  };

  const hasImpedimentOnDate = (taskId: string, date: string): boolean => {
    return dailyLogs.some(
      log => log.taskId === taskId && log.data === date && log.impedimentos && log.impedimentos.length > 0
    );
  };

  // ==================== DADOS PROCESSADOS ====================

  const selectedProject = useMemo(
    () => selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null,
    [selectedProjectId, projects]
  );

  const projectTasks = useMemo(
    () => (selectedProject ? tasks.filter(t => t.obraId === selectedProject.id) : []),
    [selectedProject, tasks]
  );

  const criticalPath = useMemo(
    () => calculateCriticalPath(projectTasks),
    [projectTasks]
  );

  const tasksByWBS = useMemo(() => {
    const sorted = [...projectTasks];
    switch (sortBy) {
      case 'nome':
        sorted.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case 'inicio':
        sorted.sort((a, b) => a.inicioPlanejado.localeCompare(b.inicioPlanejado));
        break;
      case 'fim':
        sorted.sort((a, b) => a.fimPlanejado.localeCompare(b.fimPlanejado));
        break;
      case 'critico':
        sorted.sort((a, b) => {
          const aIsCritical = criticalPath.has(a.id) ? 0 : 1;
          const bIsCritical = criticalPath.has(b.id) ? 0 : 1;
          return aIsCritical - bIsCritical;
        });
        break;
      case 'wbs':
      default:
        sorted.sort((a, b) => a.wbs.localeCompare(b.wbs));
    }
    return sorted;
  }, [projectTasks, sortBy, criticalPath]);

  // ==================== ESCALA DE TEMPO ====================

  const getTimelineRange = useMemo(() => {
    if (projectTasks.length === 0) {
      const today = new Date();
      return {
        start: today.toISOString().split('T')[0],
        end: addDays(today.toISOString().split('T')[0], 30),
      };
    }
    const dates = projectTasks.flatMap(t => [t.inicioPlanejado, t.fimPlanejado]);
    const start = dates.reduce((min, d) => (d < min ? d : min));
    const end = dates.reduce((max, d) => (d > max ? d : max));
    return { start, end };
  }, [projectTasks]);

  const timelineDays = useMemo(() => {
    const days: string[] = [];
    let current = new Date(getTimelineRange.start + 'T00:00:00');
    const finish = new Date(getTimelineRange.end + 'T00:00:00');

    while (current <= finish) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [getTimelineRange]);

  const timelineHeaders = useMemo(() => {
    if (zoomLevel === 'dias') {
      return timelineDays.map(day => ({
        label: new Date(day + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit' }),
        date: day,
        isWeekend: !isWorkDay(new Date(day + 'T00:00:00')),
      }));
    } else if (zoomLevel === 'semanas') {
      const weeks: any[] = [];
      let week = 0;
      let weekStart = new Date(getTimelineRange.start + 'T00:00:00');

      while (weekStart <= new Date(getTimelineRange.end + 'T00:00:00')) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        weeks.push({
          label: `S${week + 1}`,
          start: weekStart.toISOString().split('T')[0],
          end: weekEnd.toISOString().split('T')[0],
          week,
        });

        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        week++;
      }
      return weeks;
    } else {
      const months: any[] = [];
      let monthStart = new Date(getTimelineRange.start + 'T00:00:00');

      while (monthStart <= new Date(getTimelineRange.end + 'T00:00:00')) {
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        months.push({
          label: monthStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0],
        });

        monthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 2, 1);
      }
      return months;
    }
  }, [zoomLevel, timelineDays, getTimelineRange]);

  // ==================== CÁLCULOS DE POSIÇÃO ====================

  const getBarPosition = (taskStart: string, taskEnd: string, timelineStart: string): { left: number; width: number } => {
    // Calcula posição em pixels ao invés de porcentagem
    const offsetDays = diffDays(timelineStart, taskStart);
    const durationDays = diffDays(taskStart, taskEnd) + 1;

    const left = Math.max(0, offsetDays * COLUMN_WIDTH);
    const width = Math.max(COLUMN_WIDTH * 0.5, durationDays * COLUMN_WIDTH);

    return { left, width };
  };

  const getTodayPosition = (): number => {
    // Retorna posição em pixels da linha de hoje
    const today = new Date().toISOString().split('T')[0];
    const offsetDays = diffDays(getTimelineRange.start, today);
    return Math.max(0, offsetDays * COLUMN_WIDTH);
  };

  // ==================== RENDERIZAÇÃO ====================

  const renderTaskBar = (task: Task, isBaseline: boolean = false) => {
    const progress = getTaskProgress(task);
    const isCritical = criticalPath.has(task.id);
    const delay = calculateTaskDelay(task);
    const isDeemedCritical = delay > 0;

    const start = isBaseline && task.fimReal ? task.inicioReal || task.inicioPlanejado : task.inicioPlanejado;
    const end = isBaseline && task.fimReal ? task.fimReal : task.fimPlanejado;

    const { left, width } = getBarPosition(start, end, getTimelineRange.start);

    // Cores baseadas no status
    let barColor = 'bg-blue-500';
    let barOpacity = 'opacity-100';

    if (isBaseline) {
      barColor = 'bg-slate-300';
      barOpacity = 'opacity-60';
    } else if (isCritical) {
      barColor = 'bg-red-600';
    } else if (isDeemedCritical && delay > 0) {
      barColor = 'bg-amber-500';
    }

    return (
      <div
        key={`${task.id}-${isBaseline ? 'baseline' : 'real'}`}
        className="relative h-5 group"
        onMouseEnter={() => setHoveredTaskId(task.id)}
        onMouseLeave={() => setHoveredTaskId(null)}
      >
        {/* Barra Baseline (se houver dados reais) */}
        {!isBaseline && task.fimReal && (
          <div
            className={`absolute h-2 bottom-0 ${barColor} ${barOpacity} rounded cursor-pointer transition-all`}
            style={{ left: `${left}px`, width: `${width}px` }}
          />
        )}

        {/* Barra Real/Planejada */}
        <div
          className={`absolute h-5 ${barColor} ${barOpacity} rounded cursor-pointer transition-all hover:brightness-110 group task-bar-real`}
          style={{ left: `${left}px`, width: `${width}px` }}
        >
          {/* Preenchimento de Progresso */}
          {progress > 0 && !isBaseline && (
            <div
              className="absolute h-full bg-green-400 rounded opacity-70 transition-all"
              style={{ width: `${progress}%` }}
            />
          )}

          {/* Tooltip */}
          {hoveredTaskId === task.id && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-900 text-white p-3 rounded-lg shadow-2xl whitespace-nowrap text-[10px] font-bold pointer-events-none"
              style={{ zIndex: 9999 }}
            >
              <p className="font-black">{task.nome}</p>
              <p className="text-slate-300 text-[9px]">Início: {new Date(start + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              <p className="text-slate-300 text-[9px]">Fim: {new Date(end + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              <p className="text-slate-300 text-[9px]">Progresso: {progress.toFixed(0)}%</p>
              {delay > 0 && <p className="text-red-400 text-[9px]">Atraso: {delay}d</p>}
              {isCritical && <p className="text-red-400 text-[9px]">⚠️ CAMINHO CRÍTICO</p>}
            </motion.div>
          )}
        </div>

        {/* Ícones de Impedimento */}
        {[...Array(diffDays(task.inicioPlanejado, task.fimPlanejado) + 1)].map((_, idx) => {
          const checkDate = addDays(task.inicioPlanejado, idx);
          const hasImpediment = hasImpedimentOnDate(task.id, checkDate);

          if (!hasImpediment) return null;

          const taskLeftPx = diffDays(getTimelineRange.start, checkDate) * COLUMN_WIDTH;

          return (
            <Cloud
              key={`impediment-${idx}`}
              size={12}
              className="absolute top-0 text-amber-500 pointer-events-none impediment-icon"
              style={{ left: `${taskLeftPx}px`, transform: 'translateX(-50%)' }}
            />
          );
        })}
      </div>
    );
  };

  const toggleWBSExpansion = (wbs: string) => {
    const newExpanded = new Set(expandedWBS);
    if (newExpanded.has(wbs)) {
      newExpanded.delete(wbs);
    } else {
      newExpanded.add(wbs);
    }
    setExpandedWBS(newExpanded);
  };

  const getParentWBS = (wbs: string): string | null => {
    const parts = wbs.split('.');
    if (parts.length <= 1) return null;
    parts.pop();
    return parts.join('.');
  };

  const isTaskVisible = (task: Task): boolean => {
    let current = getParentWBS(task.wbs);
    while (current) {
      if (!expandedWBS.has(current)) return false;
      current = getParentWBS(current);
    }
    return true;
  };

  const filteredTasks = tasksByWBS.filter(isTaskVisible);

  return (
    <>
      {!selectedProjectId ? (
        <div className="h-full w-full bg-slate-50 flex items-center justify-center p-6">
          <EmptyProjectState
            title="Nenhuma Obra Selecionada"
            message={projects.length === 0 
              ? "Crie uma obra no menu Projetos para visualizar o cronograma e o gráfico de Gantt."
              : "Selecione uma obra no menu Projetos para visualizar o cronograma e o gráfico de Gantt."
            }
            primaryAction={{
              label: 'Ir para Projetos',
              onClick: () => setActiveTab?.('obras')
            }}
            onNavigateToDashboard={() => setActiveTab?.('obras')}
          />
        </div>
      ) : (
      <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 p-6 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              📊 Gráfico de Gantt
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Visualização de Caminho Crítico, Dependências e Progresso Real
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-3 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Settings size={18} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* SELETORES */}
        <div className="flex items-end justify-between flex-wrap gap-6">
          {/* Seletor de Obra */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Obra / Projeto
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px]"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Zoom */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Escala de Tempo
            </label>
            <div className="flex gap-2">
              {(['dias', 'semanas', 'meses'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setZoomLevel(level)}
                  className={`px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                    zoomLevel === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Ordenar Por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            >
              <option value="wbs">WBS</option>
              <option value="nome">Nome</option>
              <option value="inicio">Data de Início</option>
              <option value="fim">Data de Fim</option>
              <option value="critico">Caminho Crítico</option>
            </select>
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-600 rounded" />
              <span className="text-[10px] font-bold text-slate-600">Crítico</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-[10px] font-bold text-slate-600">Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <Cloud size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-slate-600">Impedimento</span>
            </div>
          </div>
        </div>
      </div>

      {/* GANTT CONTAINER */}
      <div className="flex flex-1 overflow-hidden gap-6 p-6">
        {/* WBS TABLE (LADO ESQUERDO - FIXO) */}
        <div className="w-80 bg-white rounded-xl border border-slate-100 shadow-sm overflow-y-auto shrink-0">
          <div className="sticky top-0 bg-slate-50 border-b border-slate-100 p-4 z-10">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Atividades (WBS)
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredTasks.map((task) => {
              const hasChildren = tasksByWBS.some(t => t.wbs.startsWith(task.wbs + '.'));
              const isParent = hasChildren;
              const isExpanded = expandedWBS.has(task.wbs);
              const progress = getTaskProgress(task);
              const isCritical = criticalPath.has(task.id);

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                    isCritical ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {isParent ? (
                        <button
                          onClick={() => toggleWBSExpansion(task.wbs)}
                          className="p-0.5 hover:bg-slate-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                      ) : (
                        <div className="w-5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-black text-slate-700 uppercase truncate">
                          {task.wbs}
                        </p>
                        <p className="text-[10px] font-bold text-slate-600 truncate">
                          {task.nome}
                        </p>
                      </div>

                      {isCritical && (
                        <AlertTriangle size={12} className="text-red-600 shrink-0" />
                      )}
                    </div>

                    {/* Data Range */}
                    <div className="text-[9px] font-bold text-slate-500 flex items-center gap-1 ml-6">
                      <Calendar size={10} />
                      {new Date(task.inicioPlanejado + 'T00:00:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}{' '}
                      →{' '}
                      {new Date(task.fimPlanejado + 'T00:00:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </div>

                    {/* Progress Bar */}
                    {progress > 0 && (
                      <div className="ml-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* TIMELINE (LADO DIREITO - COM SCROLL HORIZONTAL) */}
        <div 
          ref={timelineRef}
          className={`flex-1 bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto overflow-y-hidden relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative flex flex-col">
            {/* Today Line - Posicionada em Pixels DENTRO do Container Relativo */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10 today-line"
              style={{ left: `${getTodayPosition()}px` }}
            />

            {/* Timeline Headers */}
            <div className="sticky top-0 z-20 bg-white border-b border-slate-100">
              <div className="flex">
                {timelineHeaders.map((header, idx) => {
                  const isWeekend = header.isWeekend || false;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-center font-bold text-[9px] uppercase tracking-widest border-r border-slate-200 flex-shrink-0 ${
                        isWeekend ? 'bg-slate-50' : 'bg-white'
                      }`}
                      style={{ width: `${COLUMN_WIDTH}px`, height: '40px' }}
                    >
                      {header.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-slate-100">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="h-12 relative hover:bg-slate-50 transition-colors group flex"
                  onMouseEnter={() => setHoveredTaskId(task.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                >
                  {/* Background Grid - Alinhado com Headers */}
                  <div className="absolute inset-0 flex pointer-events-none z-0">
                    {timelineHeaders.map((_, idx) => {
                      return (
                        <div
                          key={idx}
                          className={`flex-shrink-0 border-r border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                          style={{ width: `${COLUMN_WIDTH}px` }}
                        />
                      );
                    })}
                  </div>

                  {/* Task Bars */}
                  <div className="relative w-full h-full p-2 flex items-center pointer-events-auto z-5">
                    {/* Baseline */}
                    {task.fimReal && renderTaskBar(task, true)}

                    {/* Real/Planned */}
                    {renderTaskBar(task, false)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER INFO */}
      <div className="bg-white border-t border-slate-100 p-4 shrink-0">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
          <div>
            Total de Tarefas: <span className="text-slate-900 font-black">{projectTasks.length}</span> | Críticas:{' '}
            <span className="text-red-600 font-black">{criticalPath.size}</span>
          </div>
          <div>
            Período:{' '}
            <span className="text-slate-900 font-black">
              {new Date(getTimelineRange.start + 'T00:00:00').toLocaleDateString('pt-BR')} →{' '}
              {new Date(getTimelineRange.end + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
      </div>
      )}    </>
  );
};

export default GanttChartView;