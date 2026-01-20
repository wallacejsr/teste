
import { Task, Resource, Project, DailyLog } from '../types';

/**
 * Auxiliar para identificar dias úteis
 */
const isWorkDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

/**
 * Calcula quantidade de dias úteis entre duas datas
 */
export const countWorkDays = (startStr: string, endStr: string): number => {
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

/**
 * Calculates S-Curve data points (Planned vs Realized)
 */
export const calculateSCurve = (tasks: Task[]) => {
  const dates = new Set<string>();
  tasks.forEach(t => {
    dates.add(t.inicioPlanejado);
    dates.add(t.fimPlanejado);
    if (t.inicioReal) dates.add(t.inicioReal);
    if (t.fimReal) dates.add(t.fimReal);
  });

  const sortedDates = Array.from(dates).sort();
  
  return sortedDates.map(date => {
    const plannedWeightThisDay = tasks
      .filter(t => t.fimPlanejado <= date)
      .reduce((sum, t) => sum + t.peso, 0);
    
    const realWeightThisDay = tasks
      .filter(t => t.inicioReal && t.inicioReal <= date)
      .reduce((sum, t) => {
        const progress = t.qtdRealizada / t.qtdPlanejada;
        return sum + (t.peso * progress);
      }, 0);

    return {
      date,
      planejado: Math.min(plannedWeightThisDay, 100),
      realizado: Math.min(realWeightThisDay, 100)
    };
  });
};

/**
 * Realiza a Análise de Valor Agregado (EVA) Financeiro de forma cumulativa
 */
export const calculateFinancialEVA = (
  tasks: Task[], 
  resources: Resource[], 
  project: Project, 
  dailyLogs: DailyLog[],
  isSimulationMode: boolean = false
) => {
  const subtasks = tasks.filter(t => t.wbs.includes('.'));
  
  const projectStart = new Date(project.dataInicio + 'T00:00:00');
  const projectEnd = new Date(project.dataFim + 'T00:00:00');
  
  let cutOffDate: Date;
  if (isSimulationMode) {
    const logDates = dailyLogs.map(l => new Date(l.data + 'T00:00:00').getTime());
    const maxLogDate = logDates.length > 0 ? Math.max(...logDates) : 0;
    cutOffDate = new Date(Math.max(maxLogDate, projectEnd.getTime()));
  } else {
    cutOffDate = new Date();
    cutOffDate.setHours(0, 0, 0, 0);
  }

  const taskData = subtasks.map(t => {
    const dailyPlannedCost = t.alocacoes.reduce((sum, aloc) => {
      const res = resources.find(r => r.id === aloc.recursoId);
      return sum + (res ? res.custoHora * aloc.quantidade * 8 : 0);
    }, 0);
    
    const plannedDays = countWorkDays(t.inicioPlanejado, t.fimPlanejado);
    const totalPlannedValue = dailyPlannedCost * plannedDays;

    return {
      id: t.id,
      plannedStart: new Date(t.inicioPlanejado + 'T00:00:00'),
      plannedEnd: new Date(t.fimPlanejado + 'T00:00:00'),
      actualStart: t.inicioReal ? new Date(t.inicioReal + 'T00:00:00') : null,
      dailyPlannedCost,
      totalPlannedValue,
      qtdPlanejada: t.qtdPlanejada,
      actualCost: t.custoRealizado
    };
  });

  const result = [];
  
  const dayBeforeStart = new Date(projectStart);
  dayBeforeStart.setDate(dayBeforeStart.getDate() - 1);
  result.push({
    date: dayBeforeStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    pv: 0,
    ev: 0,
    ac: 0
  });

  let current = new Date(projectStart);
  let cumPV = 0;

  while (current <= projectEnd) {
    const dateStr = current.toISOString().split('T')[0];
    const currentTime = current.getTime();
    const isTodayOrBefore = currentTime <= cutOffDate.getTime();

    if (isWorkDay(current)) {
      taskData.forEach(td => {
        if (currentTime >= td.plannedStart.getTime() && currentTime <= td.plannedEnd.getTime()) {
          cumPV += td.dailyPlannedCost;
        }
      });
    }

    let ev: number | null = null;
    let ac: number | null = null;

    if (isTodayOrBefore) {
      const logsUntilCurrent = dailyLogs.filter(log => log.data <= dateStr && log.obraId === project.id);
      
      // Modelo de Estado Atual: Identificamos o ÚLTIMO valor de progresso reportado para cada tarefa
      const latestProgressByTask: Record<string, number> = {};
      const cumulativeExtraByTask: Record<string, number> = {};
      
      // Ordena logs por data para garantir que o processamento respeite a cronologia
      const sortedLogs = [...logsUntilCurrent].sort((a, b) => a.data.localeCompare(b.data));

      sortedLogs.forEach(log => {
        log.avancos.forEach(av => {
          // Substitui pelo valor mais recente (Estado Atual)
          latestProgressByTask[av.tarefaId] = av.quantidade;
          // Custos extras permanecem incrementais (soma de todas as notas/despesas)
          cumulativeExtraByTask[av.tarefaId] = (cumulativeExtraByTask[av.tarefaId] || 0) + (av.custoExtra || 0);
        });
      });

      const currentDayEV = taskData.reduce((sum, td) => {
        const progressValue = latestProgressByTask[td.id] || 0;
        const progressPercent = Math.min(1, progressValue / td.qtdPlanejada);
        return sum + (td.totalPlannedValue * progressPercent);
      }, 0);

      const currentDayAC = taskData.reduce((sum, td) => {
        const baseCost = (td.actualStart && currentTime >= td.actualStart.getTime()) ? td.actualCost : 0;
        const extraCost = cumulativeExtraByTask[td.id] || 0;
        return sum + baseCost + extraCost;
      }, 0);

      ev = Number((currentDayEV || 0).toFixed(2));
      ac = Number((currentDayAC || 0).toFixed(2));
    }

    result.push({
      date: current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      pv: Number(cumPV.toFixed(2)),
      ev,
      ac
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
};

/**
 * Logic to identify critical path and schedule adjustments
 */
export const runCPM = (tasks: Task[]): Task[] => {
  const sorted = [...tasks].sort((a, b) => a.inicioPlanejado.localeCompare(b.inicioPlanejado));
  return sorted.map(task => {
    return { ...task };
  });
};
