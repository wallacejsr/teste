import { useMemo } from 'react';
import { Project, Task, Resource, DailyLog } from '../types';
import { calculateFinancialEVA } from '../services/planningEngine';

/**
 * Hook otimizado para memoizar EVA por projeto
 * Evita recálculo desnecessário quando apenas alguns projetos mudam
 */
export function useMemoizedEVA(
  projectId: string,
  tasks: Task[],
  resources: Resource[],
  project: Project,
  dailyLogs: DailyLog[],
  useFinancial: boolean
) {
  return useMemo(() => {
    const projectTasks = tasks.filter(t => t.obraId === projectId);
    return calculateFinancialEVA(projectTasks, resources, project, dailyLogs, useFinancial);
  }, [projectId, tasks, resources, project, dailyLogs, useFinancial]);
}

/**
 * Hook para calcular estatísticas de um projeto com base no EVA memoizado
 */
export function useProjectStats(
  project: Project,
  evaData: { date: string; pv: number; ev: number; ac: number }[],
  tasks: Task[],
  resources: Resource[]
) {
  return useMemo(() => {
    const projectTasks = tasks.filter(t => t.obraId === project.id);
    const lastPoint = evaData[evaData.length - 1];
    
    const ev = lastPoint?.ev || 0;
    const ac = lastPoint?.ac || 0;
    const pv = lastPoint?.pv || 0;
    
    // Calcular BAC (Budget at Completion)
    const subtasks = projectTasks.filter(t => t.wbs.includes('.'));
    const bac = subtasks.reduce((sum, t) => {
      const dailyCost = t.alocacoes.reduce((s, aloc) => {
        const res = resources.find(r => r.id === aloc.recursoId);
        return s + (res ? res.custoHora * aloc.quantidade * 8 : 0);
      }, 0);
      
      // Calcular dias úteis entre início e fim
      const start = new Date(t.inicioPlanejado + 'T00:00:00');
      const end = new Date(t.fimPlanejado + 'T00:00:00');
      let workDays = 0;
      const current = new Date(start);
      
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays++;
        current.setDate(current.getDate() + 1);
      }
      
      return sum + (dailyCost * Math.max(1, workDays));
    }, 0);
    
    return {
      id: project.id,
      nome: project.nome,
      cpi: ac > 0 ? ev / ac : 1,
      spi: pv > 0 ? ev / pv : 1,
      ev,
      pv,
      ac,
      bac,
      evaData
    };
  }, [project, evaData, tasks, resources]);
}
