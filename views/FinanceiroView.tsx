import React, { useMemo, useState, useEffect } from 'react';
import { Project, Task, Resource, DailyLog } from '../types';
import { calculateFinancialEVA, countWorkDays } from '../services/planningEngine';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Activity, 
  Target, 
  Building2, 
  ChevronDown, 
  Users, 
  Zap, 
  AlertCircle,
  Lock // Ícone para a trava dinâmica
} from 'lucide-react';

interface FinanceiroViewProps {
  projects: Project[];
  project: Project | null;
  planFeatures: string[]; // Propriedade Dinâmica
  onOpenUpgrade: () => void; // Gatilho de Venda
  tasks: Task[];
  resources: Resource[];
  dailyLogs: DailyLog[];
}

const FinanceiroView: React.FC<FinanceiroViewProps> = ({ 
  projects, 
  project, 
  planFeatures,
  onOpenUpgrade,
  tasks, 
  resources, 
  dailyLogs 
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(project?.id || null);

  useEffect(() => {
    if (project) {
      setSelectedProjectId(project.id);
    }
  }, [project]);

  // VERIFICAÇÃO DINÂMICA DE RECURSOS
  const hasGestaoFinanceira = planFeatures.includes('Gestão Financeira');

  const currentProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || project;
  }, [projects, selectedProjectId, project]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => t.obraId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  const filteredLogs = useMemo(() => {
    return dailyLogs.filter(l => l.obraId === selectedProjectId);
  }, [dailyLogs, selectedProjectId]);

  const taskCalculations = useMemo(() => {
    return filteredTasks.filter(t => t.wbs.includes('.')).map(t => {
      const dailyCost = t.alocacoes.reduce((s, aloc) => {
        const res = resources.find(r => r.id === aloc.recursoId);
        return s + (res ? res.custoHora * aloc.quantidade * 8 : 0);
      }, 0);
      const duration = countWorkDays(t.inicioPlanejado, t.fimPlanejado);
      const bac = dailyCost * duration;
      const progress = t.qtdRealizada / t.qtdPlanejada;
      const ev = bac * progress;
      const totalExtraForTask = filteredLogs.reduce((acc, log) => {
        const avanco = log.avancos.find(av => av.tarefaId === t.id);
        return acc + (avanco?.custoExtra || 0);
      }, 0);
      const ac = t.custoRealizado + totalExtraForTask;
      const cpi = ac > 0 ? ev / ac : 0;
      return { id: t.id, wbs: t.wbs, nome: t.nome, bac, ev, ac, cpi, dailyCost, duration, alocacoes: t.alocacoes };
    });
  }, [filteredTasks, resources, filteredLogs]);

  const evaData = useMemo(() => {
    if (!currentProject) return [];
    return calculateFinancialEVA(filteredTasks, resources, currentProject, filteredLogs, true);
  }, [filteredTasks, resources, currentProject, filteredLogs]);

  const financials = useMemo(() => {
    const totals = taskCalculations.reduce((acc, curr) => ({
      bac: acc.bac + curr.bac,
      ev: acc.ev + curr.ev,
      ac: acc.ac + curr.ac
    }), { bac: 0, ev: 0, ac: 0 });

    const cpi = totals.ac > 0 ? totals.ev / totals.ac : 0;
    const technicalReserve = currentProject ? currentProject.orcamento - totals.bac : 0;
    
    return { ...totals, cpi, technicalReserve };
  }, [taskCalculations, currentProject]);

  const compositionData = useMemo(() => {
    let labor = 0;
    let equipment = 0;
    taskCalculations.forEach(calc => {
      calc.alocacoes.forEach(aloc => {
        const res = resources.find(r => r.id === aloc.recursoId);
        if (res) {
          const cost = res.custoHora * aloc.quantidade * 8 * calc.duration;
          if (res.tipo === 'HUMANO') labor += cost;
          else equipment += cost;
        }
      });
    });
    return [
      { name: 'Mão de Obra', value: labor, color: '#3b82f6' },
      { name: 'Maquinário', value: equipment, color: '#f59e0b' }
    ];
  }, [taskCalculations, resources]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-300">
        <Activity size={48} className="mb-4 opacity-20" />
        <p className="text-sm font-black uppercase tracking-widest">Nenhuma obra selecionada</p>
      </div>
    );
  }

  const cards = [
    { label: 'Orçamento (BAC)', value: formatCurrency(financials.bac), subtext: `Teto Estimado: ${formatCurrency(currentProject.orcamento)}`, icon: Wallet, color: 'text-slate-900', bg: 'bg-white' },
    { label: 'Reserva Técnica', value: formatCurrency(financials.technicalReserve), subtext: 'Margem de Segurança', icon: AlertCircle, color: financials.technicalReserve < 0 ? 'text-red-600' : 'text-blue-600', bg: 'bg-white' },
    { label: 'Valor Agregado (EV)', value: formatCurrency(financials.ev), subtext: 'Produção Convertida em R$', icon: Target, color: 'text-blue-600', bg: 'bg-white' },
    { label: 'Gasto Real (AC)', value: formatCurrency(financials.ac), subtext: financials.ac === 0 ? 'Nenhum custo registrado' : 'Consolidado (Base + Extras)', icon: DollarSign, color: 'text-orange-600', bg: 'bg-white' },
    { label: 'Eficiência (CPI)', value: financials.ac === 0 ? '-' : financials.cpi.toFixed(2), subtext: financials.ac === 0 ? 'Aguardando lançamentos' : (financials.cpi >= 1 ? 'Operação Lucrativa' : 'Atenção ao Custo'), icon: financials.cpi >= 1 ? TrendingUp : TrendingDown, color: financials.ac === 0 ? 'text-slate-400' : (financials.cpi >= 1 ? 'text-emerald-600' : 'text-red-600'), bg: financials.ac === 0 ? 'bg-slate-50' : (financials.cpi >= 1 ? 'bg-emerald-50/30' : 'bg-red-50/30') },
  ];

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 pb-20 relative">
      
      {/* Camada de Desfoque e Trava para Planos sem Gestão Financeira */}
      {!hasGestaoFinanceira && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-10 text-center bg-white/20 backdrop-blur-md rounded-[48px] border border-white/60">
          <div className="w-20 h-20 bg-amber-500 text-white rounded-[32px] flex items-center justify-center shadow-2xl mb-6 animate-bounce-slow">
            <Lock size={40} fill="currentColor" />
          </div>
          <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-2">Gestão Financeira PRO</h2>
          <p className="max-w-md text-slate-500 font-bold uppercase text-[11px] tracking-widest leading-relaxed mb-8">
            A Análise de Valor Agregado (EVA) e o acompanhamento de CPI/SPI exigem a ativação deste recurso no seu painel administrativo.
          </p>
          <button 
            onClick={onOpenUpgrade}
            className="px-10 py-5 bg-[#0f172a] text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 transition-all active:scale-95"
          >
            Falar com Consultor
          </button>
        </div>
      )}

      <div className={`space-y-8 transition-all duration-700 ${!hasGestaoFinanceira ? 'blur-xl grayscale pointer-events-none' : ''}`}>
        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-xl font-black text-[#1e293b] uppercase tracking-tight">Análise de Valor Agregado (EVA)</h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Sincronização Financeira: Produção vs Custos</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 min-w-[280px] relative">
            <Building2 size={16} className="text-blue-600" />
            <select value={selectedProjectId || ''} onChange={(e) => setSelectedProjectId(e.target.value)} className="flex-1 bg-transparent text-[11px] font-black uppercase tracking-widest outline-none cursor-pointer appearance-none pr-8">
              {projects.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {cards.map((card, i) => (
            <div key={i} className={`${card.bg} p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-blue-200 transition-all`}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
                <div className={`p-3 rounded-2xl ${card.bg === 'bg-white' ? 'bg-slate-50' : 'bg-white'} ${card.color} shadow-sm group-hover:scale-110 transition-transform`}>
                  <card.icon size={20} />
                </div>
              </div>
              <div>
                  <p className={`text-xl font-black ${card.color} tracking-tight`}>{card.value}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{card.subtext}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xs font-black text-[#1e293b] uppercase tracking-[0.2em]">Curva S de Valor Agregado</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Performance Financeira Cumulativa</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">PV</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EV</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">AC</span></div>
              </div>
            </div>
            <div className="h-[400px]">
              {evaData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={evaData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} tickMargin={10} />
                    <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(dataMax, currentProject.orcamento * 1.1)]} tickFormatter={v => `R$ ${v/1000}k`} />
                    <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.1)', padding: '20px' }} labelStyle={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }} formatter={(v: number) => formatCurrency(v)} />
                    <ReferenceLine y={currentProject.orcamento} stroke="#94a3b8" strokeDasharray="8 4" strokeWidth={2} label={{ position: 'right', value: 'TETO', fill: '#94a3b8', fontSize: 9, fontWeight: '900' }} />
                    <Area type="monotone" dataKey="pv" fillOpacity={0.03} fill="#3b82f6" stroke="#3b82f6" strokeWidth={2} name="Planejado" />
                    <Line type="monotone" dataKey="ev" stroke="#10b981" strokeWidth={4} dot={false} name="Agregado" connectNulls={true} />
                    <Line type="monotone" dataKey="ac" stroke="#f97316" strokeWidth={4} dot={false} name="Realizado" connectNulls={true} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-100 text-center px-12">
                  <Target size={32} className="text-slate-200 mb-4" />
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Aguardando consolidação dos dados financeiros para {currentProject.nome}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-10 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
            <h3 className="text-xs font-black text-[#1e293b] uppercase tracking-[0.2em] mb-10">Composição por Ativo</h3>
            <div className="flex-1 min-h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={compositionData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                    {compositionData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Orçamento BAC</p>
                <p className="text-lg font-black text-[#1e293b] tracking-tight">{formatCurrency(financials.bac)}</p>
              </div>
            </div>
            <div className="mt-10 space-y-4">
              {compositionData.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div><span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{item.name}</span></div>
                  <span className="text-[11px] font-black text-slate-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-[#1e293b] uppercase tracking-[0.2em] mb-8 flex items-center gap-3"><Activity size={18} className="text-blue-600" /> Monitoramento por Atividade</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-5">WBS</th>
                  <th className="px-8 py-5">Tarefa / Atividade</th>
                  <th className="px-8 py-5">Equipe</th>
                  <th className="px-8 py-5 text-right">BAC</th>
                  <th className="px-8 py-5 text-right">EV</th>
                  <th className="px-8 py-5 text-right">AC</th>
                  <th className="px-8 py-5 text-right">CPI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {taskCalculations.map(calc => (
                  <tr key={calc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5 text-[11px] font-black text-slate-400">{calc.wbs}</td>
                    <td className="px-8 py-5">
                      <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{calc.nome}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{calc.duration} dias úteis</p>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex flex-wrap gap-2">
                        {calc.alocacoes.map(aloc => {
                          const res = resources.find(r => r.id === aloc.recursoId);
                          return (
                            <div key={aloc.recursoId} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-sm" title={res?.nome}>
                               {res?.tipo === 'HUMANO' ? <Users size={12} className="text-blue-500" /> : <Zap size={12} className="text-orange-500" />}
                               <span className="text-[10px] font-black text-slate-600">{aloc.quantidade}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right text-[11px] font-black text-slate-500">{formatCurrency(calc.bac)}</td>
                    <td className="px-8 py-5 text-right text-[11px] font-black text-blue-600">{formatCurrency(calc.ev)}</td>
                    <td className="px-8 py-5 text-right text-[11px] font-black text-orange-600">{formatCurrency(calc.ac)}</td>
                    <td className={`px-8 py-5 text-right`}>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${calc.ac === 0 ? 'bg-slate-50 text-slate-400' : (calc.cpi < 0.9 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}`}>
                        {calc.ac === 0 ? '-' : calc.cpi.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceiroView;