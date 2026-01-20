
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, Task, User, DailyLog, Tenant, Resource, GlobalConfig, Impedimento } from '../types';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  Wind, 
  Camera, 
  Save, 
  CheckCircle2, 
  Trash2, 
  AlertTriangle, 
  Calendar, 
  History,
  X,
  Plus,
  Edit2,
  Maximize2,
  ChevronDown,
  HardHat,
  FileText,
  Download,
  Printer,
  Eye,
  CalendarDays,
  Thermometer,
  ShieldCheck,
  Building2,
  UserCheck,
  MapPin,
  DollarSign,
  Briefcase,
  Truck,
  Users,
  Layers,
  Lock,
  RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';

interface DiarioViewProps {
  project: Project | null;
  projects: Project[];
  tenant: Tenant;
  globalConfig: GlobalConfig;
  planFeatures: string[];
  onOpenUpgrade: () => void;
  tasks: Task[];
  resources: Resource[];
  allUsers: User[];
  onTasksChange: (tasks: Task[]) => void;
  onAddDailyLog: (log: DailyLog) => void;
  onRemoveDailyLog: (id: string) => void;
  dailyLogs: DailyLog[];
  user: User;
}

type WeatherCondition = 'SOL' | 'NUBLADO' | 'CHUVA' | 'IMPEDIDO';

// Mapa de roles padrão (same as in EquipeView)
const DEFAULT_ROLES_MAP: Record<string, string> = {
  'c-1': 'Engenheiro',
  'c-2': 'Mestre de Obras',
  'c-3': 'Pedreiro',
  'c-4': 'Eletricista',
  'c-5': 'Administrativo',
  'c-6': 'Apoio Técnico',
};

const DiarioView: React.FC<DiarioViewProps> = ({ 
  project, 
  projects,
  tenant,
  globalConfig,
  planFeatures,
  onOpenUpgrade,
  tasks, 
  resources,
  allUsers,
  onTasksChange, 
  onAddDailyLog, 
  onRemoveDailyLog,
  dailyLogs, 
  user 
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(project?.id || null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false); 
  const [isExporting, setIsExporting] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [isValidated, setIsValidated] = useState(false);
  
  const [logToExport, setLogToExport] = useState<DailyLog | null>(null);

  const hasPDFExport = planFeatures.includes('Relatórios PDF');
  const hasDigitalSignature = planFeatures.includes('Assinatura Digital');

  const [weatherMorning, setWeatherMorning] = useState<WeatherCondition>('SOL');
  const [weatherAfternoon, setWeatherAfternoon] = useState<WeatherCondition>('SOL');
  const [impediments, setImpediments] = useState<Impedimento[]>([]);
  const [advancements, setAdvancements] = useState<Record<string, { quantity: string, notes: string, extraCost: string }>>({});
  const [globalObservations, setGlobalObservations] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (project) setSelectedProjectId(project.id);
  }, [project]);

  const getWeatherInfo = (obs: string) => {
    const match = obs.match(/\[MANHÃ: (.*?) \| TARDE: (.*?)\]/);
    if (match) return { morning: match[1] as WeatherCondition, afternoon: match[2] as WeatherCondition };
    return null;
  };

  const weatherOptions = [
    { id: 'SOL', icon: Sun, label: 'Ensolarado' },
    { id: 'NUBLADO', icon: Cloud, label: 'Nublado' },
    { id: 'CHUVA', icon: CloudRain, label: 'Chuvoso' },
    { id: 'IMPEDIDO', icon: Wind, label: 'Impraticável' },
  ];

  const getWeatherIcon = (type: WeatherCondition) => {
    const option = weatherOptions.find(o => o.id === type);
    return option ? <option.icon size={14} /> : <Sun size={14} />;
  };

  const availableTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter(t => {
      const isFromProject = t.obraId === selectedProjectId;
      const isActionable = t.wbs.includes('.') && t.qtdRealizada < t.qtdPlanejada;
      if (!showAllLogs) {
        return isFromProject && isActionable && 
               selectedDate >= t.inicioPlanejado && 
               selectedDate <= t.fimPlanejado;
      }
      return isFromProject && isActionable;
    });
  }, [tasks, selectedProjectId, selectedDate, showAllLogs]);

  const timelineLogs = useMemo(() => {
    if (!selectedProjectId) return [];
    const projectLogs = dailyLogs.filter(l => l.tenantId === tenant.id && l.obraId === selectedProjectId);
    const filtered = showAllLogs ? projectLogs : projectLogs.filter(l => l.data === selectedDate);
    return filtered.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [dailyLogs, selectedProjectId, selectedDate, showAllLogs, tenant.id]);

  const handleAdvancementChange = (taskId: string, field: 'quantity' | 'notes' | 'extraCost', value: string) => {
    setAdvancements(prev => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || { quantity: '', notes: '', extraCost: '' }), [field]: value }
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => setPhotos(prev => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
    }
  };

  const resetForm = () => {
    setAdvancements({});
    setGlobalObservations('');
    setPhotos([]);
    setIsValidated(false);
    setEditingLogId(null);
    setImpediments([]);
    setWeatherMorning('SOL');
    setWeatherAfternoon('SOL');
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleDelete = (logId: string) => {
    if (window.confirm('Atenção: A exclusão deste RDO reverterá os avanços físicos nas tarefas. Confirmar?')) {
      const log = dailyLogs.find(l => l.id === logId);
      if (log) {
        const revertedTasks = tasks.map(t => {
          const adv = log.avancos.find(a => a.tarefaId === t.id);
          return adv ? { ...t, qtdRealizada: Math.max(0, t.qtdRealizada - adv.quantidade) } : t;
        });
        onTasksChange(revertedTasks);
        onRemoveDailyLog(logId);
      }
    }
  };

  const handleEdit = (log: DailyLog) => {
    setEditingLogId(log.id);
    setSelectedProjectId(log.obraId);
    setSelectedDate(log.data);
    const weatherData = getWeatherInfo(log.observacoes);
    if (weatherData) {
      setWeatherMorning(weatherData.morning);
      setWeatherAfternoon(weatherData.afternoon);
      setGlobalObservations(log.observacoes.replace(/\[MANHÃ: .*? \| TARDE: .*?\] /, ''));
    } else {
      setGlobalObservations(log.observacoes);
    }
    setPhotos(log.fotos);
    const advMap: Record<string, { quantity: string, notes: string, extraCost: string }> = {};
    log.avancos.forEach(a => {
      advMap[a.tarefaId] = { quantity: a.quantidade.toString(), notes: a.observacaoTarefa || '', extraCost: a.custoExtra?.toString() || '' };
    });
    setAdvancements(advMap);
    setIsValidated(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Função auxiliar para verificar se é dia útil (segunda a sexta)
  const isWorkDay = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0 = domingo, 6 = sábado
  };

  // Função auxiliar para adicionar dias úteis (ignora fins de semana)
  const addWorkDays = (dateStr: string, workDays: number): string => {
    if (!dateStr || workDays <= 0) return dateStr;
    
    const date = new Date(dateStr + 'T00:00:00');
    let daysAdded = 0;
    
    while (daysAdded < workDays) {
      date.setDate(date.getDate() + 1);
      if (isWorkDay(date)) {
        daysAdded++;
      }
    }
    
    return date.toISOString().split('T')[0];
  };

  // Função auxiliar para aplicar efeito cascata nas tarefas (delay de 1 dia útil)
  const applyCascade = (allTasks: Task[], changedTaskIndex: number): Task[] => {
    let updated = [...allTasks];
    const changedTask = updated[changedTaskIndex];
    
    // Encontrar tarefas sucessoras que dependem desta tarefa
    const successors = updated.filter(t => t.dependencias.includes(changedTask.id));
    
    successors.forEach(succ => {
      const succIndex = updated.findIndex(t => t.id === succ.id);
      if (succIndex !== -1) {
        // Adicionar 1 dia útil após o fim da tarefa anterior
        const nextStart = addWorkDays(changedTask.fimPlanejado, 1);
        
        // Calcular nova data final mantendo a duração
        let current = new Date(nextStart + 'T00:00:00');
        let workDaysCount = 0;
        
        while (workDaysCount < succ.duracaoDias) {
          if (isWorkDay(current)) {
            workDaysCount++;
          }
          if (workDaysCount < succ.duracaoDias) {
            current.setDate(current.getDate() + 1);
          }
        }
        
        const nextEnd = current.toISOString().split('T')[0];
        
        updated[succIndex] = {
          ...updated[succIndex],
          inicioPlanejado: nextStart,
          fimPlanejado: nextEnd
        };
        
        // Aplicar cascata recursivamente aos sucessores desta tarefa
        updated = applyCascade(updated, succIndex);
      }
    });
    return updated;
  };

  const handleSave = () => {
    if (!selectedProjectId || !project) return;
    const logAdvancements = Object.entries(advancements).map(([taskId, data]) => ({
        tarefaId: taskId,
        quantidade: Number(data.quantity) || 0,
        observacaoTarefa: data.notes,
        custoExtra: Number(data.extraCost) || 0
      })).filter(a => a.quantidade > 0 || a.custoExtra > 0);

    if (logAdvancements.length === 0 && !globalObservations) {
      alert('Preencha os avanços, custos ou observações antes de finalizar.');
      return;
    }

    let baseTasks = tasks;
    if (editingLogId) {
      const oldLog = dailyLogs.find(l => l.id === editingLogId);
      if (oldLog) {
        baseTasks = tasks.map(t => {
          const adv = oldLog.avancos.find(a => a.tarefaId === t.id);
          return adv ? { ...t, qtdRealizada: Math.max(0, t.qtdRealizada - adv.quantidade) } : t;
        });
        onRemoveDailyLog(editingLogId);
      }
    }

    const updatedTasks = baseTasks.map(t => {
      const adv = logAdvancements.find(a => a.tarefaId === t.id);
      return adv ? { ...t, qtdRealizada: Math.min(t.qtdRealizada + adv.quantidade, t.qtdPlanejada), inicioReal: t.inicioReal || selectedDate } : t;
    });

    // Lógica de Confirmação (Efeito Cascata)
    let aplicouCascata = false;
    let finalTasks = updatedTasks;
    
    if (impediments.length > 0) {
      aplicouCascata = window.confirm('Deseja que este impedimento adie o término das tarefas ativas e suas sucessoras em 1 dia (Efeito Cascata)?');
      
      // Se cascata foi aplicada, atualizar as datas das tarefas
      if (aplicouCascata) {
        // Encontrar tarefas ativas no dia de hoje (que serão impactadas)
        const impactedTaskIndices: number[] = [];
        finalTasks.forEach((task, idx) => {
          const taskStart = new Date(task.inicioPlanejado + 'T00:00:00');
          const taskEnd = new Date(task.fimPlanejado + 'T00:00:00');
          const logDate = new Date(selectedDate + 'T00:00:00');
          
          // Se a tarefa está ativa no dia do impedimento
          if (taskStart <= logDate && logDate <= taskEnd) {
            impactedTaskIndices.push(idx);
          }
        });
        
        // Atualizar PRIMEIRO a data final da tarefa impactada (+1 dia útil)
        impactedTaskIndices.forEach(idx => {
          const task = finalTasks[idx];
          const newEnd = addWorkDays(task.fimPlanejado, 1);
          finalTasks[idx] = {
            ...finalTasks[idx],
            fimPlanejado: newEnd
          };
        });
        
        // DEPOIS aplicar cascata para cada tarefa impactada (afetando sucessoras)
        impactedTaskIndices.forEach(idx => {
          finalTasks = applyCascade(finalTasks, idx);
        });
      }
    }

    const newLog: DailyLog = {
      id: editingLogId || `log-${Date.now()}`,
      tenantId: project.tenantId,
      obraId: selectedProjectId,
      data: selectedDate,
      usuarioId: user.id,
      observacoes: `[MANHÃ: ${weatherMorning} | TARDE: ${weatherAfternoon}] ${globalObservations}`,
      avancos: logAdvancements,
      fotos: photos,
      impedimentos: impediments,
      aplicouCascata: aplicouCascata
    };

    onTasksChange(finalTasks);
    onAddDailyLog(newLog);
    resetForm();
    alert(editingLogId ? 'RDO Atualizado!' : 'RDO Consolidado com sucesso!');
  };

  const generatePDF = async (log: DailyLog) => {
    if (!hasPDFExport) {
      onOpenUpgrade();
      return;
    }
    
    setLogToExport(log);
    setIsExporting(true);
    
    await new Promise(r => setTimeout(r, 1000));

    if (!pdfTemplateRef.current) {
        setIsExporting(false);
        setLogToExport(null);
        return;
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      let currentY = margin;

      // LISTA DE PARTES PARA CAPTURA SEQUENCIAL
      const partIds = [
        'pdf-part-header',
        'pdf-part-id',
        'pdf-part-01',
        'pdf-part-02',
        'pdf-part-03',
        'pdf-part-04',
        'pdf-part-05',
        'pdf-part-photo-title'
      ];

      for (const id of partIds) {
        const el = document.getElementById(id);
        if (el) {
          const canvas = await html2canvas(el, { scale: 2.5, useCORS: true });
          const imgH = (canvas.height * (pageWidth - 2 * margin)) / canvas.width;
          
          if (currentY + imgH > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', margin, currentY, pageWidth - 2 * margin, imgH);
          currentY += imgH + 8; // Spacing entre seções
        }
      }

      // EVIDÊNCIAS FOTOGRÁFICAS
      if (log.fotos.length > 0) {
        const photoWidth = 88;
        const photoHeight = 62;
        const spacing = 8;
        
        for (let i = 0; i < log.fotos.length; i += 2) {
          if (currentY + photoHeight + 15 > pageHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }

          pdf.addImage(log.fotos[i], 'JPEG', margin + 2, currentY, photoWidth, photoHeight);
          if (log.fotos[i + 1]) {
            pdf.addImage(log.fotos[i + 1], 'JPEG', margin + photoWidth + spacing, currentY, photoWidth, photoHeight);
          }
          currentY += photoHeight + spacing;
        }
      }

      // ASSINATURAS SEMPRE AO FINAL
      const elSigs = document.getElementById('pdf-part-signatures');
      if (elSigs) {
        const canvasSigs = await html2canvas(elSigs, { scale: 2.5, useCORS: true });
        const imgSigsH = (canvasSigs.height * (pageWidth - 2 * margin)) / canvasSigs.width;
        
        if (currentY + imgSigsH > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
        
        pdf.addImage(canvasSigs.toDataURL('image/jpeg', 0.95), 'JPEG', margin, currentY, pageWidth - 2 * margin, imgSigsH);
      }
      
      pdf.save(`RDO_${project?.nome || 'Obra'}_#${log.id.slice(-6)}.pdf`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally { 
      setIsExporting(false); 
      setLogToExport(null);
    }
  };

  const getTaskEffort = (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return 0;
    const totalResources = t.alocacoes.reduce((sum, a) => sum + a.quantidade, 0);
    return t.duracaoDias * 8 * totalResources;
  };

  // ESTILOS DINÂMICOS PARA O TEMPLATE OCULTO
  const pdfTableHeaderStyle: React.CSSProperties = {
    backgroundColor: '#0f172a', 
    padding: '18px 10px',
    fontSize: '9px',
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
    border: '1px solid #0f172a',
    textAlign: 'center',
    verticalAlign: 'middle'
  };

  const pdfTableCellStyle: React.CSSProperties = {
    padding: '18px 10px',
    fontSize: '10px',
    border: '1px solid #e2e8f0',
    color: '#334155',
    textAlign: 'center',
    verticalAlign: 'middle'
  };

  const pdfSectionTitleStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: '900',
    textTransform: 'uppercase',
    color: '#ffffff',
    backgroundColor: '#0f172a',
    marginBottom: '12px',
    padding: '10px 15px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '4px',
    width: '100%',
    height: '32px'
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-700 font-['Inter'] relative">
      
      {/* 
          ======================================================================
          TEMPLATE OCULTO DO PDF (OCULTAÇÃO DINÂMICA DE SEÇÕES VAZIAS)
          ======================================================================
      */}
      <div className="fixed left-[-9999px] top-0 pointer-events-none">
        {logToExport && (
          <div ref={pdfTemplateRef} style={{ width: '800px', padding: '15px', backgroundColor: '#ffffff', color: '#0f172a' }} className="font-['Inter']">
            
            <div id="pdf-part-header">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ width: '80px', height: '80px', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                    {tenant.logoUrl ? <img src={tenant.logoUrl} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} /> : <Building2 size={32} color="#cbd5e1" />}
                  </div>
                  <div>
                    <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: '0', textTransform: 'uppercase' }}>{globalConfig.softwareName}</h1>
                    <p style={{ fontSize: '10px', fontWeight: '700', color: '#3b82f6', margin: '2px 0 0 0', textTransform: 'uppercase' }}>Relatório Diário de Obra (RDO)</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '8px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px' }}>
                    RDO #{logToExport.id.slice(-6)}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: '900', color: '#0f172a', margin: '0' }}>{new Date(logToExport.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div style={{ width: '100%', height: '1px', backgroundColor: '#e2e8f0', marginBottom: '15px' }}></div>
            </div>

            <div id="pdf-part-id" style={{ border: '1px solid #e2e8f0', borderRadius: '15px', padding: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Projeto</p>
                <p style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0' }}>{project?.nome}</p>
              </div>
              <div>
                <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Cliente</p>
                <p style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0' }}>{tenant.nome}</p>
              </div>
              <div>
                <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Local</p>
                <p style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0' }}>{project?.local}</p>
              </div>
              <div>
                <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 5px 0' }}>Clima</p>
                <p style={{ fontSize: '10px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', margin: '0' }}>
                   {getWeatherInfo(logToExport.observacoes) ? `Manhã: ${getWeatherInfo(logToExport.observacoes)?.morning} | Tarde: ${getWeatherInfo(logToExport.observacoes)?.afternoon}` : 'Não Informado'}
                </p>
              </div>
            </div>

            {/* SEÇÃO 01: EQUIPE (OCULTA SE VAZIO) */}
            {logToExport.avancos.some(a => tasks.find(t => t.id === a.tarefaId)?.alocacoes.some(al => resources.find(r => r.id === al.recursoId)?.tipo === 'HUMANO')) && (
              <div id="pdf-part-01" style={{ marginBottom: '20px' }}>
                <h3 style={pdfSectionTitleStyle}>01. Equipe e Jornada</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...pdfTableHeaderStyle, textAlign: 'left', width: '45%' }}>Colaborador</th>
                      <th style={{ ...pdfTableHeaderStyle, textAlign: 'center', width: '35%' }}>Função</th>
                      <th style={pdfTableHeaderStyle}>HN</th>
                      <th style={pdfTableHeaderStyle}>HE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logToExport.avancos.flatMap(a => tasks.find(t => t.id === a.tarefaId)?.alocacoes || [])
                      .filter(aloc => resources.find(r => r.id === aloc.recursoId)?.tipo === 'HUMANO')
                      .map((aloc, i) => {
                        const res = resources.find(r => r.id === aloc.recursoId);
                        
                        // Prioridade: cargoNome do resource, depois cargoId (map), depois cargo/role do user, depois "Colaborador"
                        let cargoDisplay = res?.cargoNome || (res?.cargoId ? DEFAULT_ROLES_MAP[res.cargoId] : undefined) || 'Colaborador';
                        
                        // Se ainda não tiver, tenta buscar do usuário
                        if (cargoDisplay === 'Colaborador' && (!res?.cargoNome && !res?.cargoId)) {
                          let matchingUser = undefined;
                          
                          // Tenta por userId
                          if (res?.userId) {
                            matchingUser = allUsers.find(u => u.id === res.userId);
                          }
                          
                          // Se não achou, tenta por nome
                          if (!matchingUser && res?.nome) {
                            matchingUser = allUsers.find(u => u.nome.toLowerCase().trim() === res.nome.toLowerCase().trim());
                          }
                          
                          if (matchingUser?.cargo || matchingUser?.role) {
                            cargoDisplay = matchingUser.cargo || matchingUser.role;
                          }
                        }
                        
                        return (
                          <tr key={i}>
                            <td style={{ ...pdfTableCellStyle, textAlign: 'left' }}>{res?.nome}</td>
                            <td style={{ ...pdfTableCellStyle, textAlign: 'center' }}>{cargoDisplay}</td>
                            <td style={pdfTableCellStyle}>8.0h</td>
                            <td style={pdfTableCellStyle}>-</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SEÇÃO 02: EQUIPAMENTOS (OCULTA SE VAZIO) */}
            {logToExport.avancos.some(a => tasks.find(t => t.id === a.tarefaId)?.alocacoes.some(al => resources.find(r => r.id === al.recursoId)?.tipo === 'EQUIPAMENTO')) && (
              <div id="pdf-part-02" style={{ marginBottom: '20px' }}>
                <h3 style={pdfSectionTitleStyle}>02. Equipamentos</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...pdfTableHeaderStyle, textAlign: 'left' }}>Descrição do Equipamento</th>
                      <th style={{ ...pdfTableHeaderStyle, width: '25%' }}>Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logToExport.avancos.flatMap(a => tasks.find(t => t.id === a.tarefaId)?.alocacoes || [])
                      .filter(aloc => resources.find(r => r.id === aloc.recursoId)?.tipo === 'EQUIPAMENTO')
                      .map((aloc, i) => {
                        const res = resources.find(r => r.id === aloc.recursoId);
                        return (
                          <tr key={i}>
                            <td style={{ ...pdfTableCellStyle, textAlign: 'left' }}>{res?.nome} {res?.placaId ? `(${res.placaId})` : ''}</td>
                            <td style={pdfTableCellStyle}>10h</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SEÇÃO 03: ATIVIDADES (OCULTA SE VAZIO) */}
            {logToExport.avancos.length > 0 && (
              <div id="pdf-part-03" style={{ marginBottom: '20px' }}>
                <h3 style={pdfSectionTitleStyle}>03. Atividades e Avanço</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...pdfTableHeaderStyle, textAlign: 'left' }}>Tarefa / Atividade</th>
                      <th style={pdfTableHeaderStyle}>Esforço Estimado</th>
                      <th style={pdfTableHeaderStyle}>Avanço Diário %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logToExport.avancos.map((av, i) => {
                      const task = tasks.find(t => t.id === av.tarefaId);
                      const effort = getTaskEffort(av.tarefaId);
                      const progress = task ? ((av.quantidade / task.qtdPlanejada) * 100).toFixed(0) : "0";
                      return (
                        <tr key={i}>
                          <td style={{ ...pdfTableCellStyle, textAlign: 'left' }}>
                            <p style={{ margin: '0', fontWeight: '800' }}>{task?.nome || 'Atividade'}</p>
                            {av.observacaoTarefa && (
                              <p style={{ margin: '3px 0 0 0', fontSize: '8.5px', color: '#64748b', fontStyle: 'italic' }}>Obs: {av.observacaoTarefa}</p>
                            )}
                          </td>
                          <td style={pdfTableCellStyle}>{effort} HH</td>
                          <td style={{ ...pdfTableCellStyle, color: '#3b82f6', fontWeight: '900' }}>+{progress}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SEÇÃO 04: IMPEDIMENTOS (OCULTA SE VAZIO) */}
            {((logToExport as any).impedimentos && (logToExport as any).impedimentos.length > 0) && (
              <div id="pdf-part-04" style={{ marginBottom: '20px' }}>
                <h3 style={{ ...pdfSectionTitleStyle, backgroundColor: '#ef4444' }}>04. Impedimentos e Paradas</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...pdfTableHeaderStyle, textAlign: 'left' }}>Motivo da Interrupção</th>
                      <th style={pdfTableHeaderStyle}>Horas Perdidas</th>
                      <th style={{ ...pdfTableHeaderStyle, textAlign: 'left' }}>Detalhamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logToExport as any).impedimentos.map((imp: Impedimento, i: number) => (
                      <tr key={i}>
                        <td style={{ ...pdfTableCellStyle, textAlign: 'left' }}>{imp.motivo}</td>
                        <td style={pdfTableCellStyle}>{imp.horasPerdidas}h</td>
                        <td style={{ ...pdfTableCellStyle, textAlign: 'left' }}>{imp.detalhamento}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(logToExport as any).aplicouCascata && (
                  <div style={{ marginTop: '12px', padding: '10px 15px', backgroundColor: '#fef08a', border: '1px solid #fbbf24', borderRadius: '8px', fontSize: '9px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase' }}>
                    ⚠️ Efeito Cascata Aplicado: Tarefas sucessoras foram adiadas
                  </div>
                )}
              </div>
            )}

            {/* SEÇÃO 05: NOTAS GERAIS (OCULTA SE VAZIO) */}
            {logToExport.observacoes.replace(/\[MANHÃ: .*? \| TARDE: .*?\] /, '').trim().length > 0 && (
              <div id="pdf-part-05" style={{ marginBottom: '25px' }}>
                <h3 style={pdfSectionTitleStyle}>05. Notas e Observações Gerais</h3>
                <div style={{ padding: '15px', border: '1px solid #e2e8f0', borderRadius: '12px', minHeight: '60px', backgroundColor: '#f8fafc' }}>
                  <p style={{ margin: '0', fontSize: '10px', color: '#334155', lineHeight: '1.6', textAlign: 'justify' }}>
                     {logToExport.observacoes.replace(/\[MANHÃ: .*? \| TARDE: .*?\] /, '')}
                  </p>
                </div>
              </div>
            )}

            {/* TÍTULO DE FOTOS (OCULTA SE VAZIO) */}
            {logToExport.fotos.length > 0 && (
              <div id="pdf-part-photo-title">
                 <h3 style={pdfSectionTitleStyle}>Anexo de Evidências Técnicas</h3>
              </div>
            )}

            {/* ASSINATURAS AO FINAL COM QUEBRA DE TEXTO CORRIGIDA */}
            <div id="pdf-part-signatures" style={{ marginTop: '60px', borderTop: '1px dashed #cbd5e1', paddingTop: '50px', paddingBottom: '30px', pageBreakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '40px' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: '70px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '15px' }}>
                    {user.signatureUrl && <img src={user.signatureUrl} style={{ maxHeight: '100%', objectFit: 'contain' }} />}
                  </div>
                  <div style={{ width: '100%', height: '1px', backgroundColor: '#94a3b8', marginBottom: '12px' }}></div>
                  <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Responsável Emissor</p>
                  <p style={{ fontSize: '10px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0', whiteSpace: 'normal', wordWrap: 'break-word', lineHeight: '1.4', minHeight: '40px' }}>{user.nome}</p>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: '70px', marginBottom: '15px' }}></div>
                  <div style={{ width: '100%', height: '1px', backgroundColor: '#94a3b8', marginBottom: '12px' }}></div>
                  <p style={{ fontSize: '8px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Fiscalização / Cliente</p>
                  <p style={{ fontSize: '10px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: '0', whiteSpace: 'normal', wordWrap: 'break-word', lineHeight: '1.4', minHeight: '40px' }}>{tenant.nome}</p>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Interface Visual do Diário */}
      <div className="flex justify-between items-center mb-10 print:hidden">
        <h1 className="text-3xl font-black text-[#0f172a] uppercase tracking-tighter">Lançamento de RDO</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowAllLogs(!showAllLogs)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${showAllLogs ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border border-slate-200 text-slate-400'}`}
          >
            {showAllLogs ? <History size={14} /> : <Eye size={14} />} {showAllLogs ? 'Visão Geral: Ligada' : 'Ver Todos Registros'}
          </button>
          <button onClick={resetForm} className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-slate-50 transition-all shadow-sm">Cancelar Lançamento</button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-8 print:p-0">
        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <div className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">00. Identificação e Clima</h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Projeto Relacionado</label>
              <select 
                value={selectedProjectId || ''} 
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl text-[11px] font-black uppercase outline-none appearance-none cursor-pointer focus:ring-4 focus:ring-blue-50 transition-all"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Data de Referência</label>
              <input 
                type="date" 
                value={selectedDate} 
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 px-5 py-4 rounded-2xl text-[11px] font-black outline-none focus:ring-4 focus:ring-blue-50 transition-all" 
              />
            </div>
            <div className="md:col-span-4 flex flex-col gap-4 border-l border-slate-50 pl-8">
              {['Manhã', 'Tarde'].map((period) => (
                <div key={period} className="flex items-center justify-between gap-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase w-12">{period}</span>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 gap-1">
                    {weatherOptions.map((opt) => {
                      const isActive = (period === 'Manhã' ? weatherMorning : weatherAfternoon) === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => period === 'Manhã' ? setWeatherMorning(opt.id as WeatherCondition) : setWeatherAfternoon(opt.id as WeatherCondition)}
                          className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm scale-110' : 'text-slate-300 hover:text-slate-500'}`}
                        >
                          {getWeatherIcon(opt.id as WeatherCondition)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <div className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">03. Produção e Avanço Físico</h3>
          </div>
          <div className="p-8 space-y-8">
            {availableTasks.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 text-slate-300 border-2 border-dashed border-slate-100 rounded-[32px]">
                  <Briefcase size={32} className="mb-2 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sem frentes abertas para esta data</p>
               </div>
            ) : (
              availableTasks.map(task => {
                const currentData = advancements[task.id] || { quantity: '', notes: '', extraCost: '' };
                const progress = Math.min(100, ((task.qtdRealizada + Number(currentData.quantity)) / task.qtdPlanejada) * 100);
                return (
                  <div key={task.id} className="bg-white p-8 rounded-[32px] border border-slate-100 hover:border-blue-200 transition-all">
                    <div className="flex flex-col md:flex-row items-center gap-10">
                      <div className="w-full md:w-1/3">
                        <h4 className="text-[15px] font-black text-[#0f172a] uppercase leading-tight tracking-tighter">{task.nome}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                           <Layers size={12} className="text-blue-500" /> UNIDADE: {task.unidadeId} | ACUMULADO: {task.qtdRealizada}%
                        </p>
                      </div>
                      <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase">
                            <span>Avanço Físico Diário</span>
                            <span>{progress.toFixed(1)}% Total</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-blue-600" />
                            </div>
                            <input type="number" placeholder="0" value={currentData.quantity} onChange={e => handleAdvancementChange(task.id, 'quantity', e.target.value)} className="w-20 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl text-center text-sm font-black outline-none" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1"><DollarSign size={10} /> Custos/Materiais Extras (R$)</label>
                          <input type="number" placeholder="0,00" value={currentData.extraCost} onChange={e => handleAdvancementChange(task.id, 'extraCost', e.target.value)} className="w-full bg-blue-50/30 border border-blue-100 px-4 py-2.5 rounded-xl text-sm font-black text-blue-700 outline-none" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-6">
                      <input type="text" placeholder="OBSERVAÇÃO TÉCNICA DESTA TAREFA..." value={currentData.notes} onChange={e => handleAdvancementChange(task.id, 'notes', e.target.value)} className="w-full bg-slate-50/50 border border-slate-100 px-6 py-3 rounded-2xl text-[11px] font-medium outline-none focus:bg-white transition-all" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <div className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">04. Impedimentos e Paradas</h3>
            <button onClick={() => setImpediments([...impediments, { motivo: '', horasPerdidas: 0, detalhamento: '' }])} className="text-[10px] font-black text-red-400 uppercase flex items-center gap-2 hover:text-red-300 transition-colors">
              <Plus size={14} /> Nova Parada
            </button>
          </div>
          <div className="p-8">
            {impediments.length === 0 ? (
              <p className="text-center text-slate-300 text-[10px] font-bold uppercase py-2">Nenhum impedimento registrado.</p>
            ) : (
              <div className="space-y-6">
                {impediments.map((imp, i) => {
                  const motivos = [
                    'Falta de Materiais',
                    'Condições Climáticas',
                    'Falta de Mão de Obra',
                    'Problemas Técnicos',
                    'Erro de Projeto',
                    'Atraso de Fornecedor',
                    '+ CADASTRAR NOVO MOTIVO...'
                  ];
                  
                  return (
                    <div key={i} className="bg-red-50/30 p-6 rounded-[24px] border border-red-200 space-y-4 animate-in slide-in-from-left-2">
                      <div className="flex items-start gap-4">
                        <AlertTriangle className="text-red-400 mt-2 flex-shrink-0" size={20} />
                        <div className="flex-1 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* MOTIVO */}
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-red-700 uppercase tracking-widest px-1">Motivo da Interrupção</label>
                              <select 
                                value={imp.motivo} 
                                onChange={(e) => {
                                  if (e.target.value === '+ CADASTRAR NOVO MOTIVO...') {
                                    const novoMotivo = window.prompt('Digite o novo motivo:');
                                    if (novoMotivo) {
                                      const newI = [...impediments];
                                      newI[i].motivo = novoMotivo;
                                      setImpediments(newI);
                                    }
                                  } else {
                                    const newI = [...impediments];
                                    newI[i].motivo = e.target.value;
                                    setImpediments(newI);
                                  }
                                }}
                                className="w-full bg-white border border-red-200 px-4 py-3 rounded-2xl text-[11px] font-bold outline-none appearance-none focus:ring-2 focus:ring-red-300 transition-all cursor-pointer"
                              >
                                <option value="">Selecione...</option>
                                {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>

                            {/* HORAS PERDIDAS */}
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-red-700 uppercase tracking-widest px-1">Horas Perdidas</label>
                              <input 
                                type="number" 
                                value={imp.horasPerdidas} 
                                onChange={(e) => {
                                  const newI = [...impediments];
                                  newI[i].horasPerdidas = Number(e.target.value) || 0;
                                  setImpediments(newI);
                                }}
                                placeholder="0" 
                                className="w-full bg-white border border-red-200 px-4 py-3 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-red-300 transition-all" 
                              />
                            </div>

                            {/* DETALHAMENTO */}
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-red-700 uppercase tracking-widest px-1">Detalhamento</label>
                              <input 
                                type="text" 
                                value={imp.detalhamento} 
                                onChange={(e) => {
                                  const newI = [...impediments];
                                  newI[i].detalhamento = e.target.value;
                                  setImpediments(newI);
                                }}
                                placeholder="Detalhe o impedimento..." 
                                className="w-full bg-white border border-red-200 px-4 py-3 rounded-2xl text-[11px] font-bold outline-none focus:ring-2 focus:ring-red-300 transition-all" 
                              />
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setImpediments(impediments.filter((_, idx) => idx !== i))} 
                          className="text-red-400 hover:text-red-600 hover:bg-red-100 p-2 rounded-xl transition-colors flex-shrink-0"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
          <div className="bg-[#0f172a] px-8 py-4 text-white">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em]">05. Evidências e Notas Finais</h3>
          </div>
          <div className="p-10 space-y-10">
            <textarea value={globalObservations} onChange={e => setGlobalObservations(e.target.value)} placeholder="RESUMO DO DIA..." className="w-full h-48 bg-slate-50 border border-slate-100 p-8 rounded-[40px] text-[14px] font-medium outline-none shadow-inner" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {photos.map((p, i) => (
                <div key={i} className="aspect-square bg-slate-100 rounded-[32px] overflow-hidden relative group border border-slate-200 cursor-zoom-in shadow-sm">
                  <img src={p} className="w-full h-full object-cover" onClick={() => setLightboxPhoto(p)} />
                  <button onClick={(e) => { e.stopPropagation(); setPhotos(photos.filter((_, idx) => idx !== i)); }} className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                </div>
              ))}
              <label className="aspect-square rounded-[32px] border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-all shadow-sm group">
                <Camera size={24} className="text-slate-300 group-hover:text-blue-500" />
                <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[32px]">
          <div className={`p-6 border transition-all duration-700 flex flex-col md:flex-row items-center justify-between gap-6 ${!hasDigitalSignature ? 'blur-md grayscale' : (isValidated ? 'bg-emerald-600 border-emerald-500 shadow-xl shadow-emerald-100' : 'bg-[#0f172a] border-slate-800 shadow-lg')}`}>
            <div className="flex items-center gap-5">
              <button 
                onClick={() => hasDigitalSignature && setIsValidated(!isValidated)}
                className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-all active:scale-90 shadow-xl ${isValidated ? 'bg-white text-emerald-600' : 'bg-slate-800 text-slate-500 hover:text-blue-400'}`}
              >
                <CheckCircle2 size={32} />
              </button>
              <div className="text-left flex-1">
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">Validação Técnica</h4>
                <div className="flex items-center gap-4 flex-wrap">
                  <p className={`text-[10px] font-bold mt-1 ${isValidated ? 'text-emerald-100' : 'text-slate-500'}`}>
                    Eu, <span className="underline decoration-2 text-blue-400 font-black">{user.nome}</span>, atesto a veracidade dos registros.
                  </p>
                  {isValidated && user.signatureUrl && (
                    <div className="bg-white/10 p-2 rounded-xl border border-white/5 backdrop-blur-sm animate-in fade-in slide-in-from-left-4">
                      <img src={user.signatureUrl} alt="Assinatura Digital" className="h-12 object-contain grayscale brightness-200 invert" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                disabled={!isValidated || !hasDigitalSignature} 
                onClick={handleSave}
                className={`flex-1 md:flex-initial px-10 py-5 rounded-[24px] text-[12px] font-black uppercase tracking-[0.1em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${isValidated ? 'bg-white text-emerald-600 hover:scale-[1.03]' : 'bg-slate-800 text-slate-700 cursor-not-allowed'}`}
              >
                {editingLogId ? <><Edit2 size={16}/> Salvar Alterações</> : <><Save size={16}/> Finalizar RDO</>}
              </button>
            </div>
          </div>

          {!hasDigitalSignature && (
            <div className="absolute inset-0 bg-white/40 z-10 flex flex-col items-center justify-center text-center p-10">
               <div className="w-14 h-14 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-xl mb-4">
                 <Lock size={28} fill="currentColor" />
               </div>
               <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">Validação e Assinatura</h4>
               <p className="text-[10px] text-slate-500 font-bold uppercase mb-6">Bloqueado para o plano atual.</p>
               <button 
                 onClick={onOpenUpgrade}
                 className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-blue-700 transition-all active:scale-95"
               >
                 Liberar Assinatura Digital
               </button>
            </div>
          )}
        </div>
      </div>

      <section className="mt-24 pt-12 border-t border-slate-100">
        <div className="flex items-center justify-between mb-10 px-4">
          <div className="flex items-center gap-5">
             <div className="p-4 bg-blue-50 text-blue-600 rounded-[20px] shadow-sm"><History size={28} /></div>
             <div>
               <h3 className="text-xl font-black text-[#0f172a] uppercase tracking-tighter">Histórico de Campo</h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{showAllLogs ? 'Exibindo todos os registros' : `Exibindo registros de ${selectedDate}`}</p>
             </div>
          </div>
          <button onClick={() => setShowHistory(!showHistory)} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all shadow-sm">
            {showHistory ? 'Recolher' : 'Explorar Histórico'}
          </button>
        </div>

        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex gap-8 overflow-x-auto pb-10 scrollbar-hide px-4">
              {timelineLogs.map((log) => {
                const climate = getWeatherInfo(log.observacoes);
                return (
                  <div key={log.id} className="min-w-[360px] bg-white p-8 rounded-[40px] border border-slate-100 transition-all relative group border-l-[10px] border-l-blue-500 shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-start mb-8">
                      <span className="px-5 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[11px] font-black uppercase shadow-sm">{new Date(log.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                         <button 
                            onClick={() => generatePDF(log)} 
                            disabled={isExporting && logToExport?.id === log.id}
                            className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center ${isExporting && logToExport?.id === log.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-100'}`}
                         >
                            {isExporting && logToExport?.id === log.id ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                         </button>
                         <button onClick={() => handleEdit(log)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-white border border-transparent hover:border-slate-100 rounded-xl transition-all"><Edit2 size={18} /></button>
                         <button onClick={() => handleDelete(log.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-white border border-transparent hover:border-slate-100 rounded-xl transition-all"><Trash2 size={18} /></button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-[13px] font-black uppercase">
                        <p className="truncate max-w-[200px]">{log.usuarioId === user.id ? user.nome : 'Resp. Técnico'}</p>
                        {climate && <div className="flex gap-2 text-[8px] bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">M: {climate.morning} T: {climate.afternoon}</div>}
                      </div>
                      <div className="p-5 bg-slate-50 rounded-[24px] text-[12px] font-medium text-slate-500 line-clamp-3 leading-relaxed border border-slate-100 shadow-inner italic">
                        "{log.observacoes.replace(/\[MANHÃ: .*? \| TARDE: .*?\] /, '') || 'Sem observações.'}"
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter px-1">
                         <Layers size={12} className="text-blue-500" /> {log.avancos.length} ATIVIDADES REGISTRADAS
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {lightboxPhoto && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8 bg-[#0f172a]/98 backdrop-blur-xl animate-in fade-in" onClick={() => setLightboxPhoto(null)}>
           <button className="absolute top-10 right-10 text-white/50 p-4 rounded-full hover:bg-white/10"><X size={40} /></button>
           <img src={lightboxPhoto} className="max-w-full max-h-full object-contain rounded-[40px] shadow-2xl animate-in zoom-in-95" />
        </div>
      )}
      
    </div>
  );
};

export default DiarioView;
