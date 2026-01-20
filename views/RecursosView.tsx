
import React, { useState, useMemo, useEffect } from 'react';
import { Task, Project, Resource } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine,
  Brush,
  Cell
} from 'recharts';
// Added X to the import list below
import { Calendar, Filter, ChevronDown, Users, LayoutGrid, Info, Clock, CalendarDays, BarChart4, AlertCircle, ShieldAlert, ShieldCheck, X } from 'lucide-react';

interface RecursosViewProps {
  tasks: Task[];
  projects: Project[];
  resources: Resource[];
}

// Função auxiliar para identificar dias úteis (Segunda a Sexta)
const isWorkDay = (date: Date): boolean => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 = Domingo, 6 = Sábado
};

const RecursosView: React.FC<RecursosViewProps> = ({ tasks, projects, resources }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'pessoas' | 'horas'>('pessoas');
  const [timeStep, setTimeStep] = useState<'diario' | 'semanal'>('semanal');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [capacityLimit, setCapacityLimit] = useState<number>(20); // Limite em quantidade de pessoas
  const [showCapacityInfo, setShowCapacityInfo] = useState(false);
  
  // Período total do dataset para o Slider (Brush)
  const fullDateRange = useMemo(() => {
    if (tasks.length === 0) return { start: '', end: '' };
    const filteredTasks = tasks.filter(t => selectedProjectId === 'all' || t.obraId === selectedProjectId);
    if (filteredTasks.length === 0) return { start: '', end: '' };

    const starts = filteredTasks.map(t => new Date(t.inicioPlanejado + 'T00:00:00').getTime());
    const ends = filteredTasks.map(t => new Date(t.fimPlanejado + 'T00:00:00').getTime());
    
    return {
      start: new Date(Math.min(...starts)).toISOString().split('T')[0],
      end: new Date(Math.max(...ends)).toISOString().split('T')[0]
    };
  }, [tasks, selectedProjectId]);

  const [period, setPeriod] = useState({ start: '', end: '' });

  useEffect(() => {
    if (fullDateRange.start && fullDateRange.end) {
      setPeriod(fullDateRange);
      const diffTime = Math.abs(new Date(fullDateRange.end).getTime() - new Date(fullDateRange.start).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        setTimeStep('semanal');
      } else {
        setTimeStep('diario');
      }
    }
  }, [fullDateRange]);

  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    const relevantTasks = tasks.filter(t => 
      selectedProjectId === 'all' || t.obraId === selectedProjectId
    );
    relevantTasks.forEach(task => {
      task.alocacoes.forEach(aloc => {
        const res = resources.find(r => r.id === aloc.recursoId);
        if (res && res.nome) roles.add(res.nome);
      });
    });
    return Array.from(roles).sort();
  }, [tasks, selectedProjectId, resources]);

  const toggleFilter = (role: string) => {
    setActiveFilters(prev => 
      prev.includes(role) ? prev.filter(f => f !== role) : [...prev, role]
    );
  };

  // Cálculo do Limite Efetivo baseado no modo de exibição e agrupamento
  const effectiveLimit = useMemo(() => {
    if (displayMode === 'pessoas') return capacityLimit;
    // Se modo horas, converte o limite de pessoas para HH
    // Diário: 8h por dia. Semanal: 40h (5 dias úteis)
    return timeStep === 'diario' ? capacityLimit * 8 : capacityLimit * 40;
  }, [capacityLimit, displayMode, timeStep]);

  const histogramData = useMemo(() => {
    if (!period.start || !period.end) return [];
    const data: Record<string, any> = {};
    const filteredTasks = tasks.filter(t => 
      (selectedProjectId === 'all' || t.obraId === selectedProjectId) &&
      t.wbs.includes('.') 
    );

    const start = new Date(period.start + 'T00:00:00');
    const end = new Date(period.end + 'T00:00:00');
    const stepSize = timeStep === 'diario' ? 1 : 7;
    
    let current = new Date(start);
    while (current <= end) {
      const dateStr = current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const bucketKey = timeStep === 'diario' ? dateStr : `Sem. ${dateStr}`;
      data[bucketKey] = { 
        period: bucketKey, 
        total: 0, 
        timestamp: current.getTime(),
        fullDate: current.toLocaleDateString('pt-BR')
      };
      availableRoles.forEach(role => data[bucketKey][role] = 0);
      current.setDate(current.getDate() + stepSize);
    }

    filteredTasks.forEach(task => {
      const taskStart = new Date(task.inicioPlanejado + 'T00:00:00');
      const taskEnd = new Date(task.fimPlanejado + 'T00:00:00');
      task.alocacoes.forEach(aloc => {
        const res = resources.find(r => r.id === aloc.recursoId);
        if (!res || (activeFilters.length > 0 && !activeFilters.includes(res.nome))) return;

        Object.keys(data).forEach(bucketKey => {
          const bucket = data[bucketKey];
          const bDateStart = new Date(bucket.timestamp);
          let contribution = 0;
          if (timeStep === 'diario') {
            if (isWorkDay(bDateStart) && bDateStart >= taskStart && bDateStart <= taskEnd) {
              contribution = (displayMode === 'horas') ? (aloc.quantidade * 8) : aloc.quantidade;
            }
          } else {
            let weeklySum = 0;
            let isActiveAtSomeWorkDay = false;
            for (let i = 0; i < 7; i++) {
              const dayToCheck = new Date(bDateStart);
              dayToCheck.setDate(dayToCheck.getDate() + i);
              if (isWorkDay(dayToCheck) && dayToCheck >= taskStart && dayToCheck <= taskEnd) {
                if (displayMode === 'horas') weeklySum += (aloc.quantidade * 8);
                else isActiveAtSomeWorkDay = true;
              }
            }
            contribution = (displayMode === 'horas') ? weeklySum : (isActiveAtSomeWorkDay ? aloc.quantidade : 0);
          }
          bucket[res.nome] = (bucket[res.nome] || 0) + contribution;
          bucket.total += contribution;
        });
      });
    });
    return Object.values(data).sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [tasks, selectedProjectId, resources, period, activeFilters, availableRoles, displayMode, timeStep]);

  const averageValue = useMemo(() => {
    if (histogramData.length === 0) return '0';
    const activeBuckets = histogramData.filter(d => d.total > 0);
    if (activeBuckets.length === 0) return '0';
    const sum = activeBuckets.reduce((acc, curr) => acc + curr.total, 0);
    const avg = sum / activeBuckets.length;
    return displayMode === 'horas' ? avg.toFixed(0) : avg.toFixed(1).replace('.0', '');
  }, [histogramData, displayMode]);

  const isOverloaded = useMemo(() => {
    return histogramData.some(d => d.total > effectiveLimit);
  }, [histogramData, effectiveLimit]);

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Header Centralizado */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-[#1e293b]">Histograma de Recursos</h2>
          <p className="text-slate-400 text-sm font-medium">Análise interativa de mobilização e capacidade</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm mr-2">
            <button 
              onClick={() => setTimeStep('diario')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeStep === 'diario' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <CalendarDays size={14} /> Diário
            </button>
            <button 
              onClick={() => setTimeStep('semanal')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${timeStep === 'semanal' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <BarChart4 size={14} /> Semanal
            </button>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
            <button 
              onClick={() => setDisplayMode('pessoas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${displayMode === 'pessoas' ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Users size={14} /> Pessoas
            </button>
            <button 
              onClick={() => setDisplayMode('horas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${displayMode === 'horas' ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              <Clock size={14} /> Horas
            </button>
          </div>

          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
            <LayoutGrid size={18} className="text-slate-300 ml-3" />
            <select 
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                setActiveFilters([]);
              }}
              className="bg-transparent pl-2 pr-8 py-2 text-xs font-black text-[#1e293b] uppercase tracking-wider outline-none appearance-none cursor-pointer"
            >
              <option value="all">Todas as Obras</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Barra de Filtros com Limite de Capacidade */}
      <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">PERÍODO PERSONALIZADO</p>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="date" 
                value={period.start} 
                onChange={e => setPeriod(p => ({...p, start: e.target.value}))}
                className="bg-transparent text-[11px] font-bold outline-none text-slate-600 cursor-pointer" 
              />
              <span className="text-slate-300 text-xs font-black">à</span>
              <input 
                type="date" 
                value={period.end} 
                onChange={e => setPeriod(p => ({...p, end: e.target.value}))}
                className="bg-transparent text-[11px] font-bold outline-none text-slate-600 cursor-pointer" 
              />
            </div>
          </div>

          <div className="space-y-1 relative">
            <div className="flex items-center gap-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CAPACIDADE MÁXIMA (PESSOAS)</p>
              <button 
                onClick={() => setShowCapacityInfo(!showCapacityInfo)}
                className="text-blue-500 hover:text-blue-700 transition-colors"
              >
                <Info size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 focus-within:border-blue-400 transition-all">
              <Users size={14} className="text-slate-400" />
              <input 
                type="number" 
                min="1"
                value={capacityLimit}
                onChange={e => setCapacityLimit(Number(e.target.value))}
                className="bg-transparent text-[11px] font-bold outline-none text-slate-600 w-16" 
              />
            </div>

            {/* Card Informativo de Capacidade */}
            {showCapacityInfo && (
              <div className="absolute top-full mt-2 left-0 w-64 bg-slate-900 text-white p-5 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-400">Linha de Capacidade</h5>
                  <button onClick={() => setShowCapacityInfo(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-300">
                  Esta linha representa o limite máximo de recursos disponíveis para a sua equipe em cada dia (ou semana).
                  <br /><br />
                  Quando a carga de trabalho ultrapassa esse limite, as barras ficam com <span className="text-red-400 font-black">alerta visual</span>, indicando necessidade de reorganização ou novas contratações.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">FILTRAR POR FUNÇÃO</p>
          <div className="flex flex-wrap gap-2">
            {availableRoles.map(role => (
              <button
                key={role}
                onClick={() => toggleFilter(role)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${activeFilters.includes(role) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Painel Lateral de Dados */}
        <div className="space-y-6">
          {/* Status da Equipe */}
          <div className={`p-8 rounded-[32px] border shadow-sm transition-all ${isOverloaded ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Status da Equipe</p>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${isOverloaded ? 'bg-white text-red-500' : 'bg-white text-emerald-500'}`}>
                {isOverloaded ? <ShieldAlert size={24} /> : <ShieldCheck size={24} />}
              </div>
              <div>
                <p className={`text-sm font-black uppercase tracking-widest ${isOverloaded ? 'text-red-600' : 'text-emerald-600'}`}>
                  {isOverloaded ? 'Sobrecarga' : 'Operação OK'}
                </p>
                <p className="text-[10px] font-bold text-slate-500">
                  {isOverloaded ? 'Ajuste o cronograma' : 'Dentro do limite'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Média (Dias Úteis)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-blue-600 tracking-tighter">{averageValue}</span>
              <span className="text-slate-400 font-black text-[10px] uppercase tracking-widest">{displayMode === 'horas' ? 'hh' : 'colab.'}</span>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Ativos no Gráfico</p>
            <div className="space-y-5">
              {availableRoles.length > 0 ? (
                availableRoles.map((role, idx) => {
                  const isFiltered = activeFilters.length === 0 || activeFilters.includes(role);
                  const activeItems = histogramData.filter(d => d[role] > 0);
                  const total = activeItems.reduce((acc, curr) => acc + (curr[role] || 0), 0);
                  const avg = (total / (activeItems.length || 1));
                  const displayAvg = displayMode === 'horas' ? avg.toFixed(0) : avg.toFixed(1).replace('.0', '');
                  
                  return (
                    <div key={role} className={`flex items-center justify-between transition-opacity ${isFiltered ? 'opacity-100' : 'opacity-30'}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                        <span className="text-[11px] font-black text-[#1e293b] uppercase tracking-tight truncate max-w-[120px]">{role}</span>
                      </div>
                      <span className="text-[11px] font-black text-slate-400">{displayAvg}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-[10px] text-slate-300 font-bold uppercase italic text-center py-4">Sem alocação ativa</p>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico com Slider (Brush) e Linha de Capacidade */}
        <div className="lg:col-span-3 bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h3 className="text-lg font-black text-[#1e293b] tracking-tight">Carga vs Capacidade {timeStep === 'diario' ? 'Diária' : 'Semanal'}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`w-2 h-2 rounded-full animate-pulse ${isOverloaded ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Unidade: {displayMode === 'horas' ? 'Esforço Real (HH)' : 'Mobilização (QTD)'}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="period" 
                  fontSize={10} 
                  axisLine={false} 
                  tickLine={false} 
                  tickMargin={15}
                  stroke="#94a3b8" 
                  fontWeight="bold"
                />
                <YAxis 
                  fontSize={10} 
                  axisLine={false} 
                  tickLine={false} 
                  stroke="#94a3b8"
                  fontWeight="bold"
                  tickFormatter={(v) => displayMode === 'horas' ? `${v}h` : v}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase' }}
                  labelStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '8px' }}
                  formatter={(value: any, name: string) => [
                    displayMode === 'horas' ? `${value.toFixed(0)}h` : value.toString().replace('.0', ''),
                    name.toUpperCase()
                  ]}
                />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ paddingTop: '50px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                />
                
                {availableRoles.map((role, idx) => (
                  <Bar 
                    key={role}
                    dataKey={role} 
                    stackId="a" 
                    fill={colors[idx % colors.length]} 
                    radius={[0, 0, 0, 0]}
                    hide={activeFilters.length > 0 && !activeFilters.includes(role)}
                  >
                    {histogramData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        stroke={entry.total > effectiveLimit ? '#ef4444' : 'none'} 
                        strokeWidth={entry.total > effectiveLimit ? 1.5 : 0}
                      />
                    ))}
                  </Bar>
                ))}

                <ReferenceLine 
                  y={effectiveLimit} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={2}
                  label={{ position: 'right', value: 'LIMITE', fill: '#ef4444', fontSize: 10, fontWeight: '900' }} 
                />

                <ReferenceLine 
                  y={Number(averageValue.replace(',', '.'))} 
                  stroke="#cbd5e1" 
                  strokeDasharray="3 3" 
                  label={{ position: 'left', value: 'MÉDIA', fill: '#94a3b8', fontSize: 9, fontWeight: '900' }} 
                />

                <Brush 
                  dataKey="period" 
                  height={30} 
                  stroke="#3b82f6" 
                  fill="#eff6ff" 
                  travellerWidth={10}
                  startIndex={0}
                  endIndex={histogramData.length > 0 ? Math.min(histogramData.length - 1, 30) : 0}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Memória de Cálculo / Tabela */}
      <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden mt-8">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-100">
               <BarChart4 size={18} />
             </div>
             <h4 className="text-[11px] font-black text-[#1e293b] uppercase tracking-[0.2em]">Memória de Cálculo (Dias Úteis)</h4>
           </div>
           <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all border border-blue-100">Exportar Planilha <ChevronDown size={14} /></button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-10 py-5">Período / Data</th>
                {availableRoles.map(role => <th key={role} className="px-10 py-5 text-center">{role}</th>)}
                <th className="px-10 py-5 text-right bg-blue-50/30 text-blue-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {histogramData.map((row, i) => (
                <tr key={i} className={`hover:bg-slate-50/50 transition-colors group ${row.total === 0 ? 'opacity-30' : ''} ${row.total > effectiveLimit ? 'bg-red-50/50' : ''}`}>
                  <td className="px-10 py-5">
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-black uppercase tracking-tight ${row.total > effectiveLimit ? 'text-red-600' : 'text-slate-700'}`}>{row.period}</span>
                      <span className="text-[9px] font-bold text-slate-300">{row.fullDate}</span>
                    </div>
                  </td>
                  {availableRoles.map(role => (
                    <td key={role} className="px-10 py-5 text-center text-[11px] font-black text-slate-700 group-hover:text-blue-600 transition-colors">
                      {displayMode === 'horas' 
                        ? (row[role] > 0 ? row[role].toFixed(0) : '-') 
                        : (row[role] > 0 ? row[role].toString().replace('.0', '') : '-')}
                    </td>
                  ))}
                  <td className={`px-10 py-5 text-right text-[11px] font-black ${row.total > effectiveLimit ? 'text-red-500' : 'text-blue-600'}`}>
                    {row.total > 0 ? (displayMode === 'horas' ? `${row.total.toFixed(0)}h` : row.total.toString().replace('.0', '')) : '-'}
                    {row.total > effectiveLimit && <span className="ml-2 inline-block text-[8px] px-1 bg-red-100 text-red-600 rounded">ALERTA</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {histogramData.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
               <AlertCircle size={48} className="mb-4 opacity-20" />
               <p className="text-sm font-black uppercase tracking-widest opacity-30">Nenhum dado disponível para o período selecionado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecursosView;
