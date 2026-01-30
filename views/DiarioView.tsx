
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Project, Task, User, DailyLog, Tenant, Resource, GlobalConfig, Impedimento } from '../types';
import { EmptyProjectState } from '../components/EmptyProjectState';
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
import { ProtectedElement } from '../hooks/usePermission';
import { Resource as PermissionResource, Action } from '../types/permissions';
import { useImageUpload } from '../hooks/useImageUpload';
import ImageUploader from '../components/ImageUploader';
import ImagePreviewModal from '../components/ImagePreviewModal';

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
  setActiveTab?: (tab: string) => void;
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
  user,
  setActiveTab: setActiveTabProp
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

  // ============================================================================
  // NOVO: Sistema de Abas e Estados Relacionados
  // ============================================================================
  type TabType = 'geral' | 'producao' | 'ocorrencias' | 'evidencias';
  const [activeTabLocal, setActiveTabLocal] = useState<TabType>('geral');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const [weatherMorning, setWeatherMorning] = useState<WeatherCondition>('SOL');
  const [weatherAfternoon, setWeatherAfternoon] = useState<WeatherCondition>('SOL');
  const [impediments, setImpediments] = useState<Impedimento[]>([]);
  const [advancements, setAdvancements] = useState<Record<string, { quantity: string, notes: string, extraCost: string }>>({});
  const [globalObservations, setGlobalObservations] = useState('');
  const [photosUrls, setPhotosUrls] = useState<string[]>([]);  // URLs de armazenamento ao invés de base64
  const [previewPhotosOpen, setPreviewPhotosOpen] = useState(false);  // Modal de preview
  const [aplicouCascata, setAplicouCascata] = useState(false);
  
  // Hook para upload de imagens
  const { upload: uploadPhoto, loading: photoLoading, error: photoError } = useImageUpload();

  const weatherOptions = useMemo(() => ([
    { id: 'SOL', label: 'Céu Limpo', icon: Sun },
    { id: 'NUBLADO', label: 'Nublado', icon: Cloud },
    { id: 'CHUVA', label: 'Chuva', icon: CloudRain },
    { id: 'IMPEDIDO', label: 'Impedido', icon: Wind }
  ]), []);

  // Estado para motivos de parada (persistência)
  const [motivosList, setMotivosList] = useState<string[]>([
    'Falta de Materiais',
    'Condições Climáticas',
    'Falta de Mão de Obra',
    'Problemas Técnicos',
    'Erro de Projeto',
    'Atraso de Fornecedor'
  ]);

  // Estado para Modal de novo motivo
  const [showMotivModal, setShowMotivModal] = useState(false);
  const [motivInputValue, setMotivInputValue] = useState('');
  const [motivInputRef, setMotivInputRef] = useState<HTMLInputElement | null>(null);
  const [pendingImpedimentIndex, setPendingImpedimentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (project) setSelectedProjectId(project.id);
  }, [project]);

  // Função para adicionar novo motivo à lista permanentemente
  const handleAddNewMotivo = () => {
    const novoMotivo = motivInputValue.trim().toUpperCase();
    
    if (!novoMotivo) {
      setMotivInputValue('');
      setShowMotivModal(false);
      return;
    }

    // Evita duplicatas
    if (!motivosList.includes(novoMotivo)) {
      const novaLista = [...motivosList, novoMotivo];
      setMotivosList(novaLista);
      
      // Se há um impedimento pendente, atribui o novo motivo
      if (pendingImpedimentIndex !== null) {
        const newI = [...impediments];
        newI[pendingImpedimentIndex].motivo = novoMotivo;
        setImpediments(newI);
      }
    }

    // Limpa modal
    setMotivInputValue('');
    setShowMotivModal(false);
    setPendingImpedimentIndex(null);
  };

  // ============================================================================
  // FUNÇÕES DE CALENDÁRIO E EFEITO CASCATA
  // ============================================================================
  const isWorkDay = (date: Date): boolean => {
    const day = date.getDay();
    return day !== 0 && day !== 6; // 0=domingo, 6=sábado
  };

  const addWorkDays = (dateStr: string, workDays: number): string => {
    if (!dateStr) return '';
    let date = new Date(dateStr + 'T00:00:00');
    let daysAdded = 0;
    
    while (daysAdded < workDays) {
      date.setDate(date.getDate() + 1);
      if (isWorkDay(date)) {
        daysAdded++;
      }
    }
    
    return date.toISOString().split('T')[0];
  };

  const nextWorkDay = (dateStr: string): string => {
    if (!dateStr) return '';
    let date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + 1);
    
    while (!isWorkDay(date)) {
      date.setDate(date.getDate() + 1);
    }
    
    return date.toISOString().split('T')[0];
  };

  const applyCascade = (allTasks: Task[], changedTaskId: string, newEndDate: string, visitedIds: Set<string> = new Set()): Task[] => {
    // Proteção contra loop infinito (dependências circulares)
    if (visitedIds.has(changedTaskId)) {
      console.warn(`[Cascata] Ciclo detectado para tarefa ${changedTaskId}, abortando recursão`);
      return allTasks;
    }

    const newVisited = new Set(visitedIds);
    newVisited.add(changedTaskId);

    let updated = [...allTasks];
    const successors = updated.filter(t => t.dependencias.includes(changedTaskId));
    
    successors.forEach(succ => {
      const nextStart = nextWorkDay(newEndDate);
      const nextEnd = addWorkDays(nextStart, succ.duracaoDias - 1);
      
      updated = updated.map(t => 
        t.id === succ.id 
          ? { ...t, inicioPlanejado: nextStart, fimPlanejado: nextEnd }
          : t
      );
      updated = applyCascade(updated, succ.id, nextEnd, newVisited);
    });
    return updated;
  };

  const availableTasks = useMemo(() => {
    let filtered = tasks.filter((t) => {
      // Filtra por projeto
      if (selectedProjectId && t.obraId !== selectedProjectId) return false;
      
      // Apenas tarefas "folha" (com ponto no WBS) e não concluídas
      if (!t.wbs.includes('.') || t.qtdRealizada >= t.qtdPlanejada) return false;
      
      return true;
    });

    // Se não estiver mostrando todos os logs, filtrar por data
    if (!showAllLogs && selectedDate) {
      const logDate = new Date(selectedDate + 'T00:00:00');
      filtered = filtered.filter(task => {
        const taskStart = new Date(task.inicioPlanejado + 'T00:00:00');
        const taskEnd = new Date(task.fimPlanejado + 'T00:00:00');
        return logDate >= taskStart && logDate <= taskEnd;
      });
    }

    return filtered;
  }, [tasks, selectedProjectId, showAllLogs, selectedDate]);

  const timelineLogs = useMemo(() => {
    let logs = dailyLogs.filter((log) => !selectedProjectId || log.obraId === selectedProjectId);
    if (!showAllLogs) {
      logs = logs.filter((log) => log.data === selectedDate);
    }
    return [...logs].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [dailyLogs, selectedProjectId, showAllLogs, selectedDate]);

  const getWeatherInfo = (obs: string) => {
    const match = obs.match(/\[MANHÃ:\s*(.*?)\s*\|\s*TARDE:\s*(.*?)\]/);
    if (!match) return null;
    return { morning: match[1], afternoon: match[2] };
  };

  const canAccessTab = (tab: TabType) => {
    if (tab === 'geral') return true;
    return !!selectedProjectId;
  };

  const isTabComplete = (tab: TabType) => {
    switch (tab) {
      case 'geral':
        return !!selectedProjectId && !!selectedDate && !!weatherMorning && !!weatherAfternoon;
      case 'producao':
        return Object.values(advancements).some((a) => a.quantity !== '' && !Number.isNaN(Number(a.quantity)));
      case 'ocorrencias':
        return true;
      case 'evidencias':
        return true;
      default:
        return false;
    }
  };

  const getMissingTabs = () => {
    const labels: Record<TabType, string> = {
      geral: 'Geral',
      producao: 'Produção',
      ocorrencias: 'Ocorrências',
      evidencias: 'Evidências'
    };
    return (['geral', 'producao'] as TabType[])
      .filter((tab) => !isTabComplete(tab))
      .map((tab) => labels[tab]);
  };

  const canFinalize = () => {
    // Aba geral deve estar completa
    if (!isTabComplete('geral')) return false;

    // Deve haver pelo menos um dos seguintes:
    const hasAdvancement = Object.values(advancements).some((a) => a.quantity !== '' && !Number.isNaN(Number(a.quantity)) && Number(a.quantity) > 0);
    const hasObservation = globalObservations.trim().length > 0;
    const hasImpediment = impediments.length > 0;

    return hasAdvancement || hasObservation || hasImpediment;
  };

  const resetForm = () => {
    setAdvancements({});
    setImpediments([]);
    setGlobalObservations('');
    setPhotosUrls([]);  // Limpar URLs de fotos
    setWeatherMorning('SOL');
    setWeatherAfternoon('SOL');
    setEditingLogId(null);
    setIsValidated(false);
    setAplicouCascata(false);
    setActiveTabLocal('geral');
  };

  const handleAdvancementChange = (taskId: string, field: 'quantity' | 'notes' | 'extraCost', value: string) => {
    setAdvancements((prev) => {
      const current = prev[taskId] || { quantity: '', notes: '', extraCost: '' };
      return { ...prev, [taskId]: { ...current, [field]: value } };
    });
  };

  const handlePhotoUpload = async (url: string) => {
    // Callback chamado quando ImageUploader completa o upload com sucesso
    if (url) {
      setPhotosUrls((prev) => [...prev, url]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotosUrls((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleOpenMotivModal = (index: number) => {
    setPendingImpedimentIndex(index);
    setShowMotivModal(true);
  };

  const handleSave = () => {
    try {
      // ============================================================================
      // VERIFICAÇÃO DE PROPS EXTERNAS
      // ============================================================================
      if (!onTasksChange || !onAddDailyLog) {
        console.error('[handleSave] Props obrigatórias ausentes:', { onTasksChange: !!onTasksChange, onAddDailyLog: !!onAddDailyLog });
        toast.error('Erro interno: Funções de callback não foram fornecidas pelo componente pai.');
        return;
      }

      console.log('[handleSave] Iniciando fluxo de salvamento...');

      if (!canFinalize()) {
        setFeedbackMessage({ type: 'error', text: `Preencha as abas obrigatórias: ${getMissingTabs().join(', ')}` });
        setShowFeedbackModal(true);
        setActiveTabLocal('geral');
        return;
      }

      const logAdvancements = Object.entries(advancements).map(([taskId, data]) => ({
        tarefaId: taskId,
        quantidade: Number(data.quantity) || 0,
        observacaoTarefa: data.notes,
        custoExtra: Number(data.extraCost) || 0
      }));

      let finalTasks = tasks.map((task) => {
        const adv = logAdvancements.find((a) => a.tarefaId === task.id);
        if (!adv) return task;
        const novoRealizado = Math.min(task.qtdPlanejada, task.qtdRealizada + adv.quantidade);
        return { 
          ...task, 
          qtdRealizada: novoRealizado,
          custoRealizado: (task.custoRealizado || 0) + (adv.custoExtra || 0)
        };
      });

      let cascataAplicada = false;

      // ============================================================================
      // DETECÇÃO DE IMPEDIMENTOS E EFEITO CASCATA
      // ============================================================================
      if (impediments.length > 0) {
        const confirmarCascata = window.confirm(
          'Foram registrados impedimentos neste RDO.\n\n' +
          'Deseja aplicar o efeito cascata para adiar automaticamente o término das tarefas ativas e suas sucessoras em 1 dia útil?'
        );

        if (confirmarCascata) {
          console.log('[handleSave] Iniciando efeito cascata...');
          
          // Identificar tarefas ativas na data selecionada
          const activeTasks = finalTasks.filter(task => {
            const taskStart = new Date(task.inicioPlanejado + 'T00:00:00');
            const taskEnd = new Date(task.fimPlanejado + 'T00:00:00');
            const logDate = new Date(selectedDate + 'T00:00:00');
            return logDate >= taskStart && logDate <= taskEnd;
          });

          console.log('[handleSave] Tarefas ativas encontradas:', activeTasks.length);

          // Aplicar adiamento de 1 dia útil para cada tarefa ativa
          activeTasks.forEach(task => {
            const newEndDate = addWorkDays(task.fimPlanejado, 1);
            
            finalTasks = finalTasks.map(t => 
              t.id === task.id 
                ? { ...t, fimPlanejado: newEndDate }
                : t
            );

            // Aplicar cascata recursiva para sucessores com proteção contra loops
            finalTasks = applyCascade(finalTasks, task.id, newEndDate, new Set());
          });

          cascataAplicada = true;
          console.log('[handleSave] Efeito cascata concluído');
        }
      }

      const newLog: DailyLog = {
        id: editingLogId || `log-${Date.now()}`,
        tenantId: project?.tenantId || tenant.id,
        obraId: selectedProjectId || '',
        data: selectedDate,
        usuarioId: user.id,
        observacoes: `[MANHÃ: ${weatherMorning} | TARDE: ${weatherAfternoon}] ${globalObservations}`,
        avancos: logAdvancements,
        fotos: photosUrls,  // Usar URLs ao invés de base64
        impedimentos: impediments,
        aplicouCascata: cascataAplicada
      };

      console.log('[handleSave] Chamando onTasksChange com', finalTasks.length, 'tarefas');
      onTasksChange(finalTasks);

      console.log('[handleSave] Chamando onAddDailyLog');
      onAddDailyLog(newLog);

      console.log('[handleSave] Resetando formulário');
      resetForm();
      
      setFeedbackMessage({
        type: 'success',
        text: editingLogId ? 'RDO Atualizado com Sucesso!' : 'RDO Consolidado com Sucesso! 🎉'
      });
      setShowFeedbackModal(true);
      
      console.log('[handleSave] Retornando à aba geral');
      setActiveTabLocal('geral');

      console.log('[handleSave] Fluxo de salvamento concluído com sucesso');
    } catch (error) {
      console.error('[handleSave] Erro durante o salvamento:', error);
      
      const errorMessage = error instanceof Error 
        ? `Erro interno: ${error.message}` 
        : 'Erro interno ao salvar o RDO. Verifique o console para mais detalhes.';
      
      setFeedbackMessage({
        type: 'error',
        text: errorMessage
      });
      setShowFeedbackModal(true);
    }
  };

  const handleEdit = (log: DailyLog) => {
    setEditingLogId(log.id);
    setSelectedProjectId(log.obraId);
    setSelectedDate(log.data);
    const weather = getWeatherInfo(log.observacoes);
    if (weather) {
      setWeatherMorning(weather.morning as WeatherCondition);
      setWeatherAfternoon(weather.afternoon as WeatherCondition);
    }
    setGlobalObservations(log.observacoes.replace(/\[MANHÃ: .*? \| TARDE: .*?\]\s*/, ''));
    setPhotosUrls(log.fotos || []);  // Usar URLs ao invés de base64
    setImpediments((log as any).impedimentos || []);

    const advMap: Record<string, { quantity: string; notes: string; extraCost: string }> = {};
    log.avancos.forEach((av) => {
      advMap[av.tarefaId] = {
        quantity: av.quantidade?.toString() || '',
        notes: av.observacaoTarefa || '',
        extraCost: av.custoExtra?.toString() || ''
      };
    });
    setAdvancements(advMap);
    setActiveTabLocal('geral');
    setShowHistory(false);
    setIsValidated(false);
  };

  const handleDelete = (id: string) => {
    onRemoveDailyLog(id);
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
    <>
      {/* Empty State quando nenhuma obra selecionada */}
      {!project ? (
        <div className="animate-in fade-in duration-700">
          <EmptyProjectState
            title="Nenhuma Obra Selecionada"
            message="Selecione uma obra no menu Projetos para visualizar e registrar o Relatório Diário de Obra (RDO)."
            primaryAction={{
              label: 'Ir para Projetos',
              onClick: () => setActiveTabProp?.('obras')
            }}
            onNavigateToDashboard={() => setActiveTabProp?.('obras')}
          />
        </div>
      ) : (
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

      {/* ============================================================================ */}
      {/* NOVO: Sistema de Abas (Tabs) com Indicadores de Conclusão */}
      {/* ============================================================================ */}
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

      {/* Tab Navigation */}
      <div className="mb-8 print:hidden">
        <div className="flex gap-4 border-b border-slate-100 pb-4 flex-wrap">
          {([
            { id: 'geral', label: 'Geral', icon: Building2 },
            { id: 'producao', label: 'Produção', icon: Briefcase },
            { id: 'ocorrencias', label: 'Ocorrências', icon: AlertTriangle },
            { id: 'evidencias', label: 'Evidências', icon: Camera }
          ] as { id: TabType, label: string, icon: any }[]).map(tab => {
            const isActive = activeTabLocal === tab.id;
            const isComplete = isTabComplete(tab.id);
            const canAccess = canAccessTab(tab.id);
            const IconComponent = tab.icon;
            
            return (
              <motion.button
                key={tab.id}
                onClick={() => canAccess && setActiveTabLocal(tab.id)}
                disabled={!canAccess}
                className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed relative ${
                  isActive 
                    ? 'bg-blue-50 border-2 border-blue-500 text-blue-700 shadow-md shadow-blue-100' 
                    : 'border border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                whileHover={canAccess ? { scale: 1.05 } : {}}
                whileTap={canAccess ? { scale: 0.95 } : {}}
              >
                <IconComponent size={16} />
                {tab.label}
                {isComplete && <CheckCircle2 size={16} className="text-emerald-500" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div ref={reportRef} className="print:p-0">
        {/* ===== ABAS COM ANIMAÇÃO CONSOLIDADA ===== */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key="geral-tab"
            initial={false}
            animate={activeTabLocal === 'geral' ? { opacity: 1, y: 0, pointerEvents: 'auto', display: 'block' } : { opacity: 0, y: 10, pointerEvents: 'none', display: 'none' }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Identificação do Projeto</h3>
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
                </div>
              </div>

              {/* NOVO: Weather Cards Interativos */}
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] px-8 py-4">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Condições Climáticas</h3>
                </div>
                <div className="p-8 space-y-6">
                  {['Manhã', 'Tarde'].map((period) => {
                    const currentWeather = period === 'Manhã' ? weatherMorning : weatherAfternoon;
                    
                    return (
                      <div key={period}>
                        <label className="text-[11px] font-black text-slate-600 uppercase tracking-widest block mb-4">{period}</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {weatherOptions.map((opt) => {
                            const isSelected = currentWeather === opt.id;
                            const IconComponent = opt.icon;
                            const colorMap: Record<string, string> = {
                              'SOL': 'from-yellow-50 to-amber-50 border-amber-200 shadow-amber-100',
                              'NUBLADO': 'from-slate-50 to-slate-100 border-slate-200 shadow-slate-100',
                              'CHUVA': 'from-blue-50 to-cyan-50 border-blue-200 shadow-blue-100',
                              'IMPEDIDO': 'from-red-50 to-rose-50 border-red-200 shadow-red-100'
                            };
                            const glowMap: Record<string, string> = {
                              'SOL': 'bg-amber-500/20',
                              'NUBLADO': 'bg-slate-400/20',
                              'CHUVA': 'bg-blue-500/20',
                              'IMPEDIDO': 'bg-red-500/20'
                            };

                            return (
                              <motion.button
                                key={opt.id}
                                onClick={() => period === 'Manhã' ? setWeatherMorning(opt.id as WeatherCondition) : setWeatherAfternoon(opt.id as WeatherCondition)}
                                className={`relative p-6 rounded-[24px] border-2 transition-all group ${
                                  isSelected 
                                    ? `bg-gradient-to-br ${colorMap[opt.id]} border-2 shadow-xl ${glowMap[opt.id]}` 
                                    : 'bg-white border-slate-100 hover:border-slate-200'
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <div className="flex flex-col items-center justify-center">
                                  <motion.div
                                    initial={{ scale: 1 }}
                                    animate={isSelected ? { scale: 1.2 } : { scale: 1 }}
                                    transition={{ type: 'spring', damping: 10 }}
                                  >
                                    <IconComponent 
                                      size={32} 
                                      className={`transition-colors ${
                                        isSelected 
                                          ? opt.id === 'SOL' ? 'text-amber-600' : opt.id === 'NUBLADO' ? 'text-slate-600' : opt.id === 'CHUVA' ? 'text-blue-600' : 'text-red-600'
                                          : 'text-slate-300 group-hover:text-slate-400'
                                      }`}
                                    />
                                  </motion.div>
                                  <span className="text-[11px] font-black text-slate-600 mt-3 uppercase tracking-tight">{opt.label}</span>
                                  {isSelected && (
                                    <motion.div
                                      layoutId={`weather-check-${period}`}
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full"
                                    >
                                      <CheckCircle2 size={16} />
                                    </motion.div>
                                  )}
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>

          <motion.div
            key="producao-tab"
            initial={false}
            animate={activeTabLocal === 'producao' ? { opacity: 1, y: 0, pointerEvents: 'auto', display: 'block' } : { opacity: 0, y: 10, pointerEvents: 'none', display: 'none' }}
            transition={{ duration: 0.2 }}
          >
              <div className="space-y-8">
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Produção e Avanço Físico</h3>
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
              </div>
            </motion.div>

          <motion.div
            key="ocorrencias-tab"
            initial={false}
            animate={activeTabLocal === 'ocorrencias' ? { opacity: 1, y: 0, pointerEvents: 'auto', display: 'block' } : { opacity: 0, y: 10, pointerEvents: 'none', display: 'none' }}
            transition={{ duration: 0.2 }}
          >
              <div className="space-y-8">
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] px-8 py-4 flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Impedimentos e Paradas</h3>
                  <button onClick={() => setImpediments([...impediments, { motivo: '', horasPerdidas: 0, detalhamento: '' }])} className="text-[10px] font-black text-red-400 uppercase flex items-center gap-2 hover:text-red-300 transition-colors">
                    <Plus size={14} /> Nova Parada
                  </button>
                </div>
                <div className="p-8">
                  {impediments.length === 0 ? (
                    <p className="text-center text-slate-300 text-[10px] font-bold uppercase py-2">Nenhum impedimento registrado.</p>
                  ) : (
                    <div className="space-y-4">
                      {impediments.map((imp, i) => {
                        return (
                          <div key={i} className="bg-red-50/50 p-4 rounded-[20px] border border-red-100 flex items-center gap-3 animate-in slide-in-from-left-2">
                            <AlertTriangle className="text-red-500 flex-shrink-0" size={18} />
                            
                            {/* Motivo (Searchable Select) */}
                            <div className="flex-1">
                              <div className="text-[9px] font-black text-red-600 uppercase tracking-widest px-2 mb-1">Motivo</div>
                              <select 
                                value={imp.motivo} 
                                onChange={(e) => {
                                  if (e.target.value === '+ NOVO MOTIVO') {
                                    handleOpenMotivModal(i);
                                    setTimeout(() => motivInputRef?.focus(), 0);
                                  } else {
                                    const newI = [...impediments];
                                    newI[i].motivo = e.target.value;
                                    setImpediments(newI);
                                  }
                                }}
                                className="w-full bg-white border border-red-200 px-3 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-red-300 transition-all cursor-pointer"
                              >
                                <option value="">Selecione...</option>
                                {motivosList.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="+ NOVO MOTIVO" className="font-black text-red-500">+ NOVO MOTIVO</option>
                              </select>
                            </div>

                            {/* Horas Perdidas */}
                            <div className="w-24">
                              <div className="text-[9px] font-black text-red-600 uppercase tracking-widest px-2 mb-1">Horas</div>
                              <input 
                                type="number" 
                                value={imp.horasPerdidas} 
                                onChange={(e) => {
                                  const newI = [...impediments];
                                  newI[i].horasPerdidas = Number(e.target.value) || 0;
                                  setImpediments(newI);
                                }}
                                placeholder="0" 
                                className="w-full bg-white border border-red-200 px-2 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-red-300 transition-all text-center" 
                              />
                            </div>

                            {/* Detalhamento */}
                            <div className="flex-1">
                              <div className="text-[9px] font-black text-red-600 uppercase tracking-widest px-2 mb-1">Detalhe</div>
                              <input 
                                type="text" 
                                value={imp.detalhamento} 
                                onChange={(e) => {
                                  const newI = [...impediments];
                                  newI[i].detalhamento = e.target.value;
                                  setImpediments(newI);
                                }}
                                placeholder="Descrição..." 
                                className="w-full bg-white border border-red-200 px-3 py-2 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-red-300 transition-all" 
                              />
                            </div>

                            {/* Botão Remover */}
                            <button 
                              onClick={() => setImpediments(impediments.filter((_, idx) => idx !== i))} 
                              className="text-red-400 hover:text-red-600 hover:bg-red-100 p-2 rounded-lg transition-colors flex-shrink-0"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Notas Gerais */}
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] px-8 py-4">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Notas Gerais e Observações</h3>
                </div>
                <div className="p-8">
                  <textarea value={globalObservations} onChange={e => setGlobalObservations(e.target.value)} placeholder="RESUMO DO DIA..." className="w-full h-48 bg-slate-50 border border-slate-100 p-8 rounded-[40px] text-[14px] font-medium outline-none shadow-inner" />
                </div>
              </div>
              </div>
            </motion.div>

          <motion.div
            key="evidencias-tab"
            initial={false}
            animate={activeTabLocal === 'evidencias' ? { opacity: 1, y: 0, pointerEvents: 'auto', display: 'block' } : { opacity: 0, y: 10, pointerEvents: 'none', display: 'none' }}
            transition={{ duration: 0.2 }}
          >
              <div className="space-y-8">
              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] px-8 py-4">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Evidências Fotográficas</h3>
                </div>
                <div className="p-10">
                  {/* Uploader Component */}
                  <div className="mb-8">
                    <ImageUploader
                      entityId={selectedProjectId || 'temp'}
                      tenantId={tenant.id}
                      bucket="fotos-obra"
                      label="Adicionar Foto (Obra)"
                      onUploadSuccess={handlePhotoUpload}
                      maxSizeMB={10}
                    />
                  </div>

                  {/* Galeria de Fotos */}
                  <div className="space-y-4">
                    {photosUrls.length > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{photosUrls.length} foto{photosUrls.length !== 1 ? 's' : ''} adicionada{photosUrls.length !== 1 ? 's' : ''}</p>
                          <button
                            onClick={() => setPreviewPhotosOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors text-sm font-medium"
                          >
                            <Eye size={16} />
                            Visualizar Galeria
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                          {photosUrls.map((url, i) => (
                            <div key={i} className="aspect-square bg-slate-100 rounded-[32px] overflow-hidden relative group border border-slate-200 cursor-pointer shadow-sm">
                              <img 
                                src={url} 
                                alt={`Foto ${i + 1}`}
                                className="w-full h-full object-cover" 
                                onClick={() => setPreviewPhotosOpen(true)} 
                              />
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRemovePhoto(i); }} 
                                className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
                                title="Remover foto"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              </div>

              {/* Preview Modal */}
              <ImagePreviewModal
                isOpen={previewPhotosOpen}
                images={photosUrls}
                title="Fotos da Obra"
                onClose={() => setPreviewPhotosOpen(false)}
              />
            </motion.div>

        {/* ===== PAINEL DE ASSINATURA FLUTUANTE (APENAS NA ÚLTIMA ABA) ===== */}
        {activeTabLocal === 'evidencias' && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={canFinalize() ? { y: 0, opacity: 1 } : { y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed bottom-6 right-6 print:hidden z-40"
          >
            <div className={`relative overflow-hidden rounded-[32px] shadow-2xl ${!hasDigitalSignature ? 'blur-md grayscale' : (isValidated ? 'bg-emerald-600 border border-emerald-500 shadow-emerald-200' : 'bg-slate-800 border border-slate-700')}`}>
              <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <button 
                    onClick={() => {
                      if (!hasDigitalSignature) {
                        onOpenUpgrade();
                        return;
                      }
                      setIsValidated(!isValidated);
                    }}
                    className={`w-14 h-14 rounded-[20px] flex items-center justify-center transition-all active:scale-90 shadow-lg ${isValidated ? 'bg-white text-emerald-600' : 'bg-slate-700 text-slate-400 hover:text-emerald-400'}`}
                  >
                    <CheckCircle2 size={28} />
                  </button>
                  <div className="text-left">
                    <h4 className="text-sm font-black text-white uppercase tracking-tighter">Validação</h4>
                    <p className={`text-[10px] font-bold mt-0.5 ${isValidated ? 'text-emerald-100' : 'text-slate-400'}`}>
                      Atestado de veracidade
                    </p>
                  </div>
                </div>
                
                <ProtectedElement resource={PermissionResource.REPORTS} action={editingLogId ? Action.UPDATE : Action.CREATE}>
                  <button 
                    disabled={!isValidated || !hasDigitalSignature} 
                    onClick={handleSave}
                    className={`px-8 py-3 rounded-[20px] text-[11px] font-black uppercase tracking-[0.1em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${isValidated ? 'bg-white text-emerald-600 hover:scale-105' : 'bg-slate-700 text-slate-600 cursor-not-allowed'}`}
                  >
                    {editingLogId ? <><Edit2 size={14}/> Salvar</> : <><Save size={14}/> Finalizar</>}
                  </button>
                </ProtectedElement>
              </div>

              {!hasDigitalSignature && (
                <div className="absolute inset-0 bg-white/50 z-10 flex flex-col items-center justify-center text-center p-4">
                  <Lock size={20} className="mb-1" />
                  <p className="text-[8px] font-black text-slate-700">Bloqueado</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>

      </div>

      {/* ===== MODAL DE NOVO MOTIVO ===== */}
      <AnimatePresence>
        {showMotivModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowMotivModal(false);
              setMotivInputValue('');
              setPendingImpedimentIndex(null);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-8 border border-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-[15px] font-black text-[#0f172a] uppercase tracking-tighter">Novo Motivo</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Digite o motivo de interrupção</p>
                </div>
                <button 
                  onClick={() => {
                    setShowMotivModal(false);
                    setMotivInputValue('');
                    setPendingImpedimentIndex(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Input */}
              <div className="mb-6">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Descrição do Motivo</label>
                <input
                  ref={(el) => {
                    setMotivInputRef(el);
                    if (el) el.focus();
                  }}
                  type="text"
                  value={motivInputValue}
                  onChange={(e) => setMotivInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddNewMotivo();
                    if (e.key === 'Escape') {
                      setShowMotivModal(false);
                      setMotivInputValue('');
                      setPendingImpedimentIndex(null);
                    }
                  }}
                  placeholder="Ex: Falta de ferramental específico"
                  className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-[12px] font-bold outline-none focus:bg-white focus:ring-2 focus:ring-red-300 transition-all"
                  autoFocus
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMotivModal(false);
                    setMotivInputValue('');
                    setPendingImpedimentIndex(null);
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-[10px] font-black text-slate-700 uppercase px-4 py-2.5 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddNewMotivo}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-[10px] font-black text-white uppercase px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MODAL DE FEEDBACK (SUCESSO/ERRO) ===== */}
      <AnimatePresence>
        {showFeedbackModal && feedbackMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
            onClick={() => setShowFeedbackModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 40 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className={`rounded-[40px] shadow-2xl max-w-md w-full p-10 text-center border ${
                feedbackMessage.type === 'success' 
                  ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200' 
                  : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {feedbackMessage.type === 'success' ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10, delay: 0.1 }}
                    className="mb-6 flex justify-center"
                  >
                    <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl">
                      <CheckCircle2 size={48} />
                    </div>
                  </motion.div>
                  <h3 className="text-[20px] font-black text-emerald-700 uppercase tracking-tight mb-2">
                    {feedbackMessage.text}
                  </h3>
                  <p className="text-[12px] text-emerald-600 font-bold mb-8">
                    Seu RDO foi registrado com sucesso no sistema.
                  </p>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10, delay: 0.1 }}
                    className="mb-6 flex justify-center"
                  >
                    <div className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl">
                      <AlertTriangle size={48} />
                    </div>
                  </motion.div>
                  <h3 className="text-[20px] font-black text-red-700 uppercase tracking-tight mb-2">
                    Formulário Incompleto
                  </h3>
                  <p className="text-[12px] text-red-600 font-bold mb-6">
                    {feedbackMessage.text}
                  </p>
                  <div className="space-y-2">
                    {getMissingTabs().map((tab, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        className="px-4 py-2 bg-red-100 rounded-lg text-[11px] font-black text-red-700 uppercase"
                      >
                        ⚠️ {tab}
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
              
              <button
                onClick={() => setShowFeedbackModal(false)}
                className={`mt-8 w-full px-6 py-3 rounded-[20px] text-[12px] font-black uppercase tracking-[0.1em] transition-all shadow-lg active:scale-95 ${
                  feedbackMessage.type === 'success'
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {feedbackMessage.type === 'success' ? 'Fechar' : 'Corrigir'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seção de Histórico */}

      <section className="mt-24 pt-12 border-t border-slate-100 mb-24">
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
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }} 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4"
            >
              {timelineLogs.map((log) => {
                const climate = getWeatherInfo(log.observacoes);
                
                // Mapear condições climáticas para cores
                const getClimateColor = (condition: string) => {
                  const colors: Record<string, string> = {
                    'SOL': 'bg-amber-100 text-amber-700 border-amber-200',
                    'NUBLADO': 'bg-slate-100 text-slate-600 border-slate-200',
                    'CHUVA': 'bg-blue-100 text-blue-700 border-blue-200',
                    'IMPEDIDO': 'bg-red-100 text-red-700 border-red-200'
                  };
                  return colors[condition] || 'bg-slate-100 text-slate-600 border-slate-200';
                };

                return (
                  <div key={log.id} className="bg-white p-6 rounded-[32px] border border-slate-100 transition-all relative group border-l-[6px] border-l-blue-500 shadow-sm hover:shadow-lg">
                    <div className="flex justify-between items-start mb-6">
                      <span className="px-4 py-2 bg-blue-50 text-blue-600 rounded-2xl text-[10px] font-black uppercase shadow-sm">
                        {new Date(log.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={() => generatePDF(log)} 
                            disabled={isExporting && logToExport?.id === log.id}
                            className={`p-2 rounded-xl transition-all shadow-sm flex items-center justify-center ${isExporting && logToExport?.id === log.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                            title="Baixar PDF"
                         >
                            {isExporting && logToExport?.id === log.id ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                         </button>
                         <ProtectedElement resource={PermissionResource.REPORTS} action={Action.UPDATE}>
                          <button 
                            onClick={() => handleEdit(log)} 
                            className="p-2 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                         </ProtectedElement>
                         <ProtectedElement resource={PermissionResource.REPORTS} action={Action.DELETE}>
                          <button 
                            onClick={() => handleDelete(log.id)} 
                            className="p-2 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                         </ProtectedElement>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-black text-[#0f172a] uppercase truncate max-w-[180px]">
                          {log.usuarioId === user.id ? user.nome : 'Resp. Técnico'}
                        </p>
                        {climate && (
                          <div className="flex gap-1.5">
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${getClimateColor(climate.morning)}`}>
                              M: {climate.morning}
                            </span>
                            <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${getClimateColor(climate.afternoon)}`}>
                              T: {climate.afternoon}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-[20px] text-[11px] font-medium text-slate-600 line-clamp-3 leading-relaxed border border-slate-100 italic">
                        "{log.observacoes.replace(/\[MANHÃ: .*? \| TARDE: .*?\] /, '') || 'Sem observações.'}"
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-tight">
                         <Layers size={12} className="text-blue-500" /> 
                         <span>{log.avancos.length} atividade{log.avancos.length !== 1 ? 's' : ''}</span>
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
      )}    </>
  );
};

export default DiarioView;