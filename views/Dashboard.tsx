
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, Cell
} from 'recharts';
import { Project, Task, Resource, DailyLog } from '../types';
import { calculateFinancialEVA } from '../services/planningEngine';
import { useMemoizedEVA, useProjectStats } from '../hooks/useMemoizedEVA';
import { 
  Target, 
  DollarSign, 
  Clock, 
  Activity, 
  ShieldAlert, 
  Zap,
  Building2,
  CalendarDays,
  CheckCircle2
} from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  tasks: Task[];
  resources: Resource[];
  dailyLogs: DailyLog[];
}

const Dashboard: React.FC<DashboardProps> = ({ projects, tasks, resources, dailyLogs }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🚀 OTIMIZAÇÃO: Memoizar EVA individualmente para cada projeto
  // Evita recalcular todos os projetos quando apenas 1 muda
  const projectPerformance = useMemo(() => {
    return projects.map(project => {
      const projectTasks = tasks.filter(t => t.obraId === project.id);
      const evaData = calculateFinancialEVA(projectTasks, resources, project, dailyLogs, true);
      
      const lastPoint = evaData[evaData.length - 1];
      const ev = lastPoint?.ev || 0;
      const ac = lastPoint?.ac || 0;
      const pv = lastPoint?.pv || 0;
      
      // Calcular BAC otimizado
      const subtasks = projectTasks.filter(t => t.wbs.includes('.'));
      const bac = subtasks.reduce((sum, t) => {
        const dailyCost = t.alocacoes.reduce((s, aloc) => {
          const res = resources.find(r => r.id === aloc.recursoId);
          return s + (res ? res.custoHora * aloc.quantidade * 8 : 0);
        }, 0);
        
        // Calcular dias úteis inline (mais rápido que countWorkDays)
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
    });
  }, [projects, tasks, resources, dailyLogs]);

  // 🚀 OTIMIZAÇÃO: Calcular estatísticas consolidadas apenas quando projectPerformance muda
  const consolidatedStats = useMemo(() => {
    let globalPV = 0;
    let globalEV = 0;
    let globalAC = 0;
    let globalBAC = 0;
    let totalBudget = 0;
    
    // 🚀 Usar projectPerformance já calculado ao invés de recalcular EVA
    projectPerformance.forEach(p => {
      globalPV += p.pv;
      globalEV += p.ev;
      globalAC += p.ac;
      globalBAC += p.bac;
      const project = projects.find(proj => proj.id === p.id);
      if (project) totalBudget += project.orcamento;
    });

    const allDates = new Set<string>();
    projectPerformance.forEach(p => p.evaData.forEach(d => allDates.add(d.date)));
    const sortedDates = Array.from(allDates).sort((a, b) => {
       const [da, ma] = a.split('/').map(Number);
       const [db, mb] = b.split('/').map(Number);
       return (ma - mb) || (da - db);
    });

    const consolidatedSCurve = sortedDates.map(date => {
      let pv = 0;
      let ev = 0;
      projectPerformance.forEach(p => {
        const point = p.evaData.find(d => d.date === date);
        if (point) {
          pv += point.pv;
          ev += point.ev || 0;
        }
      });
      return { date, pv, ev };
    });

    const avgCPI = globalAC > 0 ? globalEV / globalAC : 0;
    const gapPercent = globalPV > 0 ? ((globalEV - globalPV) / globalPV) * 100 : 0;
    const technicalReserve = totalBudget - globalBAC;

    return {
      projectPerformance,
      consolidatedSCurve,
      avgCPI,
      gapPercent,
      technicalReserve,
      globalEV,
      globalAC,
      globalPV
    };
  }, [projectPerformance, projects]);

  const criticalTasks = useMemo(() => {
    // 🚀 OTIMIZAÇÃO: Criar Map de recursos para lookup O(1)
    const resourceMap = new Map(resources.map(r => [r.id, r]));
    
    return tasks.filter(t => {
      const isDelayed = new Date(t.fimPlanejado + 'T00:00:00') < today;
      return t.wbs.includes('.') && isDelayed && t.qtdRealizada < t.qtdPlanejada;
    }).map(t => {
      const progress = t.qtdRealizada / t.qtdPlanejada;
      const dailyCost = t.alocacoes.reduce((s, aloc) => {
        const res = resourceMap.get(aloc.recursoId);
        return s + (res ? res.custoHora * aloc.quantidade * 8 : 0);
      }, 0);
      
      // Calcular dias úteis inline
      const start = new Date(t.inicioPlanejado + 'T00:00:00');
      const end = new Date(t.fimPlanejado + 'T00:00:00');
      let workDays = 0;
      const current = new Date(start);
      
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays++;
        current.setDate(current.getDate() + 1);
      }
      
      const bac = dailyCost * Math.max(1, workDays);
      const riskValue = bac * (1 - progress);
      return { ...t, riskValue };
    }).sort((a, b) => b.riskValue - a.riskValue);
  }, [tasks, resources, today]);

  const fieldInertia = useMemo(() => {
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);
    
    return projects.filter(p => {
      const pLogs = dailyLogs.filter(l => l.obraId === p.id);
      if (pLogs.length === 0) return true;
      const lastLog = [...pLogs].sort((a, b) => b.data.localeCompare(a.data))[0];
      const lastLogDate = new Date(lastLog.data + 'T00:00:00');
      return lastLogDate < fortyEightHoursAgo;
    });
  }, [projects, dailyLogs]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const kpis = [
    { 
      label: 'CPI MÉDIO (CARTEIRA)', 
      value: consolidatedStats.avgCPI === 0 ? '-' : consolidatedStats.avgCPI.toFixed(2), 
      icon: Target, 
      color: consolidatedStats.avgCPI >= 1 ? 'text-emerald-600' : 'text-red-600',
      bg: consolidatedStats.avgCPI >= 1 ? 'bg-emerald-50' : 'bg-red-50',
      sub: consolidatedStats.avgCPI >= 1 ? 'Rentabilidade Positiva' : 'Gasto Acima do Orçado'
    },
    { 
      label: 'DESVIO DE PRAZO (GAP)', 
      value: `${consolidatedStats.gapPercent > 0 ? '+' : ''}${consolidatedStats.gapPercent.toFixed(1)}%`, 
      icon: Clock, 
      color: consolidatedStats.gapPercent >= 0 ? 'text-emerald-600' : 'text-orange-600',
      bg: consolidatedStats.gapPercent >= 0 ? 'bg-emerald-50' : 'bg-orange-50',
      sub: consolidatedStats.gapPercent >= 0 ? 'Ritmo Conforme' : 'Atraso em Produção'
    },
    { 
      label: 'RESERVA TÉCNICA TOTAL', 
      value: formatCurrency(consolidatedStats.technicalReserve), 
      icon: DollarSign, 
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      sub: 'Saldo Orçamentário Global'
    },
    { 
      label: 'ALERTAS CRÍTICOS', 
      value: criticalTasks.length, 
      icon: ShieldAlert, 
      color: criticalTasks.length > 0 ? 'text-red-600' : 'text-slate-400',
      bg: criticalTasks.length > 0 ? 'bg-red-50' : 'bg-slate-50',
      sub: 'Tarefas de Alto Impacto'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      
      {/* KPI STRATEGIC CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className={`p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between ${kpi.bg}`}>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.label}</p>
              <div className={`p-3 rounded-2xl bg-white ${kpi.color} shadow-sm`}>
                <kpi.icon size={20} />
              </div>
            </div>
            <div>
              <p className={`text-3xl font-black ${kpi.color} tracking-tighter uppercase`}>{kpi.value}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-tight">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Curva S Consolidada */}
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xs font-black text-[#1e293b] uppercase tracking-[0.2em]">CURVA S CONSOLIDADA (PORTFOLIO)</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Comparativo PV (Planejado) vs EV (Agregado)</p>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={consolidatedStats.consolidatedSCurve}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} />
                <YAxis fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tickFormatter={v => `R$ ${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '16px' }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="pv" stroke="#3b82f6" fillOpacity={0.05} fill="#3b82f6" name="Planejado (PV)" />
                <Area type="monotone" dataKey="ev" stroke="#10b981" strokeWidth={3} fillOpacity={0.1} fill="#10b981" name="Agregado (EV)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking de Performance por Obra */}
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-xs font-black text-[#1e293b] uppercase tracking-[0.2em]">RANKING DE PERFORMANCE (CPI)</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Eficiência de Custo por Empreendimento</p>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={consolidatedStats.projectPerformance} 
                layout="vertical"
                margin={{ left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" domain={[0, (dataMax: number) => Math.max(dataMax, 1.2)]} fontSize={9} axisLine={false} tickLine={false} />
                <YAxis dataKey="nome" type="category" fontSize={9} fontWeight="black" axisLine={false} tickLine={false} width={100} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: number) => v.toFixed(2)}
                />
                <ReferenceLine x={1} stroke="#94a3b8" strokeDasharray="3 3" />
                <Bar dataKey="cpi" radius={[0, 8, 8, 0]} barSize={32}>
                  {consolidatedStats.projectPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cpi >= 1 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Tabela de Gestão por Exceção (Tarefas Críticas) */}
        <div className="lg:col-span-2 bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black text-[#1e293b] uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity size={16} className="text-red-500" /> TAREFAS COM IMPACTO CRÍTICO
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-5">Tarefa / Obra</th>
                  <th className="px-8 py-5">Fim Planejado</th>
                  <th className="px-8 py-5 text-right">Progresso</th>
                  <th className="px-8 py-5 text-right text-red-500">Valor em Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {criticalTasks.slice(0, 6).map(task => {
                  const p = projects.find(proj => proj.id === task.obraId);
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <p className="text-[11px] font-black text-[#1e293b] uppercase tracking-tight">{task.nome}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{p?.nome}</p>
                      </td>
                      <td className="px-8 py-5 text-[11px] font-bold text-slate-500">
                        {new Date(task.fimPlanejado + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="text-[11px] font-black text-slate-700">{(task.qtdRealizada/task.qtdPlanejada * 100).toFixed(0)}%</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <span className="text-[11px] font-black text-red-600 uppercase">{formatCurrency(task.riskValue)}</span>
                      </td>
                    </tr>
                  );
                })}
                {criticalTasks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">
                      Nenhuma tarefa crítica atrasada. Operação estável.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inércia de Campo */}
        <div className="bg-[#0f172a] p-10 rounded-[40px] text-white shadow-xl flex flex-col">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
            <Zap size={16} className="text-blue-400" /> INÉRCIA DE CAMPO (+48H)
          </h3>
          <div className="space-y-6 flex-1">
            {fieldInertia.map(p => (
              <div key={p.id} className="bg-slate-800/50 p-6 rounded-[24px] border border-slate-700/50 flex items-center gap-4 group hover:border-blue-500 transition-all">
                <div className="w-12 h-12 bg-slate-800 text-blue-400 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Building2 size={24} />
                </div>
                <div>
                  <h4 className="text-[12px] font-black uppercase tracking-tight">{p.nome}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <CalendarDays size={12} className="text-slate-500" />
                    <p className="text-[9px] font-bold text-slate-500 uppercase">Aguardando Diário</p>
                  </div>
                </div>
              </div>
            ))}
            {fieldInertia.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center opacity-50">
                <CheckCircle2 size={40} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Todos os canteiros atualizados</p>
              </div>
            )}
          </div>
          <div className="mt-10 pt-8 border-t border-slate-800">
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Notificações automáticas ativadas para gestores.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
