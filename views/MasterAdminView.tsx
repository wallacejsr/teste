
// Fix: Added explicit React import to avoid UMD global errors
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Globe, 
  Building2, 
  Users, 
  CreditCard, 
  Palette, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  MoreHorizontal,
  ShieldCheck, 
  ShieldAlert,
  Save,
  Trash2,
  Calendar,
  Zap,
  Upload,
  Search,
  MessageSquare,
  ChevronDown,
  Activity,
  HardHat,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Mail,
  Briefcase,
  Edit2,
  Check,
  Wallet,
  Lock,
  Eye,
  EyeOff,
  Link,
  Phone,
  Truck,
  HelpCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobalConfig, Tenant, LicenseStatus, User, Role, PlanTemplate, Project, DailyLog } from '../types';
import { ProtectedElement } from '../hooks/usePermission';
import { Resource as PermissionResource, Action } from '../types/permissions';
import { dataSyncService } from '../services/dataService';
import { toast } from 'sonner';

interface MasterAdminViewProps {
  activeTab: string;
  globalConfig: GlobalConfig;
  onUpdateGlobalConfig: (c: GlobalConfig) => void;
  allTenants: Tenant[];
  onUpdateTenants: (ts: Tenant[]) => void;
  allUsers: User[];
  onUpdateUsers: (us: User[]) => void;
  allProjects: Project[];
  allDailyLogs: DailyLog[];
  plansConfig: PlanTemplate[];
  onUpdatePlansConfig: (ps: PlanTemplate[]) => void;
  onSimulateAccess: (u: User) => void;
}

const MasterAdminView: React.FC<MasterAdminViewProps> = ({ 
  activeTab, 
  globalConfig, 
  onUpdateGlobalConfig, 
  allTenants, 
  onUpdateTenants, 
  allUsers,
  onUpdateUsers,
  allProjects,
  allDailyLogs,
  plansConfig,
  onUpdatePlansConfig,
  onSimulateAccess
}) => {
  const getUserTenantId = (u: User | any) => (u as any).tenantId ?? (u as any).tenant_id;
  const isAdminUser = (u: User | any) => String((u as any).role || '').toUpperCase() === Role.ADMIN;
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'expiring'>('all');
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Operação realizada com sucesso!");
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadUsersIfNeeded = async () => {
      if (activeTab !== 'master-dash' || allUsers.length > 0) return;
      const users = await dataSyncService.loadAllUsers();
      if (users.length > 0) onUpdateUsers(users);
    };
    loadUsersIfNeeded();
  }, [activeTab, allUsers.length, onUpdateUsers]);

  const resolvePlanLimits = (planId: PlanTemplate['id']) => {
    const plan = plansConfig.find(p => p.id === planId) || plansConfig[0];
    return {
      limiteUsuarios: plan?.limiteUsuarios ?? 0,
      limiteObras: plan?.limiteObras ?? 0,
      limiteMaoDeObra: plan?.limiteMaoDeObra ?? 0,
      limiteMaquinario: plan?.limiteMaquinario ?? 0,
      limiteCargos: plan?.limiteCargos ?? 0,
    };
  };

  const defaultPlanId = (plansConfig[0]?.id ?? 'PRO') as PlanTemplate['id'];
  const defaultPlanLimits = resolvePlanLimits(defaultPlanId);

  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    emailAdmin: '',
    nomeGestor: '',
    logoUrl: '',
    plano: defaultPlanId,
    ...defaultPlanLimits,
    vencimento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
  });

  const primaryColor = globalConfig.primaryColor || '#3b82f6';

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Automação de limites baseada no plano selecionado
  useEffect(() => {
    const limits = resolvePlanLimits(formData.plano);
    setFormData(prev => ({
      ...prev,
      ...limits
    }));
  }, [formData.plano, plansConfig]);

  const maskCNPJ = (value: string) => {
    const raw = value.replace(/\D/g, '');
    return raw.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{4})(\d)/, '$1-$2').slice(0, 18);
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) });
  };

  const validateStep1 = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.nome.trim()) return "Informe o nome da organização.";
    if (!formData.nomeGestor.trim()) return "Informe o nome completo do gestor.";
    if (formData.cnpj.replace(/\D/g, '').length !== 14) return "CNPJ incompleto.";
    if (!emailRegex.test(formData.emailAdmin)) return "E-mail inválido.";
    return null;
  };

  /* =====================================================
     GERADOR DE SENHA FORTE COM CRYPTO (SEGURANÇA)
     ===================================================== */
  const generateSecurePassword = (): string => {
    const length = 12;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const charsetArray = new Uint8Array(length);
    
    try {
      window.crypto.getRandomValues(charsetArray);
      let password = '';
      for (let i = 0; i < length; i++) {
        password += charset[charsetArray[i] % charset.length];
      }
      return password;
    } catch (error) {
      console.error('Erro ao gerar senha segura:', error);
      // Fallback para crypto menos seguro
      return 'Temp' + Math.random().toString(36).slice(2, 10) + '!@#';
    }
  };

  /* =====================================================
     INTEGRAÇÃO EMAILJS - DISPARO DE BOAS-VINDAS
     ===================================================== */
  const sendWelcomeEmail = async (user: User, password: string): Promise<boolean> => {
    try {
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        console.warn('EmailJS não configurado - verifique variáveis de ambiente');
        return false;
      }

      // Template HTML elegante para e-mail
      const emailBodyHTML = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8f9fa; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            
            <!-- Header com gradiente -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">🚀 Bem-vindo à Plataforma!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">ENGENHARIAPRO SAAS</p>
            </div>

            <!-- Conteúdo principal -->
            <div style="padding: 40px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6;">Olá <strong>${user.nome}</strong>,</p>
              <p style="color: #666; font-size: 14px; line-height: 1.8; margin: 20px 0;">
                Sua conta foi criada com sucesso! Abaixo estão seus dados de acesso para entrar na plataforma. 
                Por favor, <strong>altere sua senha no primeiro login</strong> por razões de segurança.
              </p>

              <!-- Bloco de credenciais destacado -->
              <div style="background-color: #f0f7ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <p style="color: #1e40af; font-weight: bold; margin: 0 0 15px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">📋 DADOS DE ACESSO</p>
                <div style="background-color: white; padding: 15px; border-radius: 6px; margin-bottom: 10px;">
                  <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #999;">E-mail de Acesso</p>
                  <p style="margin: 0; color: #333; font-size: 16px; font-weight: bold; font-family: 'Courier New', monospace;">${user.email}</p>
                </div>
                <div style="background-color: white; padding: 15px; border-radius: 6px;">
                  <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #999;">Senha Temporária</p>
                  <p style="margin: 0; color: #333; font-size: 16px; font-weight: bold; font-family: 'Courier New', monospace; letter-spacing: 2px;">${password}</p>
                </div>
              </div>

              <!-- Instruções de segurança -->
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #856404; margin: 0; font-size: 13px; font-weight: bold;">⚠️ Importante:</p>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #856404; font-size: 13px;">
                  <li>Altere sua senha imediatamente após o primeiro login</li>
                  <li>Nunca compartilhe suas credenciais com terceiros</li>
                  <li>Use uma senha forte e única</li>
                </ul>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://seu-dominio.com/login" style="background-color: #3b82f6; color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
                  Acessar Plataforma
                </a>
              </div>

              <!-- Rodapé -->
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
              <p style="color: #999; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
                Em caso de dúvidas, entre em contato com o suporte: <strong>support@engenhariapro.com.br</strong>
              </p>
            </div>
          </div>
        </div>
      `;

      // ✅ Preparar dados do template - EXATAMENTE como definido no template do EmailJS
      // Template "Welcome" espera esses campos:
      const templateParams = {
        email: user.email,              // ✅ Campo "To Email" do template
        TO_NAME: user.nome,             // ✅ Campo {{TO_NAME}} no conteúdo
        TO_EMAIL: user.email,           // ✅ Campo {{TO_EMAIL}} no conteúdo
        TEMP_PASSWORD: password,        // ✅ Campo {{TEMP_PASSWORD}} no conteúdo
        APP_NAME: 'ENGENHARIAPRO'       // ✅ Campo {{APP_NAME}} no subject
      };

      console.log('📧 Enviando e-mail com params:', {
        service_id: serviceId,
        template_id: templateId,
        email: user.email,
        TO_NAME: user.nome
      });

      // Usar fetch ou emailjs library (aqui usando fetch para compatibilidade)
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: templateParams
        })
      });

      if (response.ok) {
        console.log('E-mail de boas-vindas enviado com sucesso para:', user.email);
        return true;
      } else {
        console.error('Erro ao enviar e-mail:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('Erro crítico ao disparar e-mail de boas-vindas:', error);
      toast.error('Falha ao enviar e-mail de boas-vindas. O usuário foi criado, mas notifique-o manualmente sobre as credenciais.');
      return false;
    }
  };

  const handleNextStep = () => {
    const error = validateStep1();
    if (error) { toast.error(error); return; }
    setCurrentStep(2);
  };

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(now.getDate() + 30);

    const mrr = allTenants.reduce((acc, t) => {
      if (t.status !== LicenseStatus.ATIVA) return acc;
      const plan = plansConfig.find(p => p.id === t.planoId);
      return acc + (plan?.precoMensal || 0);
    }, 0);

    const totalVGV = allProjects.reduce((acc, p) => acc + (p.orcamento || 0), 0);

    const engagement24h = allDailyLogs.filter(log => {
      const logDate = new Date(log.data + 'T00:00:00');
      const diffHours = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60);
      return diffHours >= 0 && diffHours <= 24;
    }).length;

    const renewalAlerts = allTenants.filter(t => {
      const end = new Date(t.dataFimLicenca + 'T00:00:00');
      return end > now && end <= thirtyDaysFromNow;
    }).length;

    const marketShareData = plansConfig.map(plan => ({
      name: plan.id,
      value: allTenants.filter(t => t.planoId === plan.id).length,
      color: plan.cor
    }));

    const growthData = [
      { name: 'Jan', users: Math.floor(allUsers.length * 0.4) },
      { name: 'Fev', users: Math.floor(allUsers.length * 0.7) },
      { name: 'Mar', users: Math.floor(allUsers.length * 0.85) },
      { name: 'Abr', users: allUsers.length },
    ];

    const atLimitTenants = allTenants.map(t => {
      const uCount = allUsers.filter(u => u.tenantId === t.id).length;
      const pCount = allProjects.filter(p => p.tenantId === t.id).length;
      const uUsage = (uCount / t.limiteUsuarios) * 100;
      const pUsage = (pCount / t.limiteObras) * 100;
      return { ...t, uCount, pCount, uUsage, pUsage, maxUsage: Math.max(uUsage, pUsage) };
    }).filter(t => t.maxUsage >= 80).sort((a, b) => b.maxUsage - a.maxUsage);

    const churnRiskTenants = allTenants.filter(t => {
      const logs = allDailyLogs.filter(l => l.tenantId === t.id);
      if (logs.length === 0) return true;
      const latestLogDate = Math.max(...logs.map(l => new Date(l.data + 'T00:00:00').getTime()));
      const daysInative = (now.getTime() - latestLogDate) / (1000 * 60 * 60 * 24);
      return daysInative > 7;
    }).map(t => {
      const logs = allDailyLogs.filter(l => l.tenantId === t.id);
      const latestLogDate = logs.length > 0 
        ? new Date(Math.max(...logs.map(l => new Date(l.data + 'T00:00:00').getTime())))
        : null;
      return { ...t, latestLogDate };
    });

    return { mrr, totalVGV, engagement24h, renewalAlerts, marketShareData, growthData, atLimitTenants, churnRiskTenants };
  }, [allTenants, allUsers, allProjects, allDailyLogs, plansConfig]);

  const filteredTenants = useMemo(() => {
    return allTenants.filter(t => {
      const matchesSearch = t.nome.toLowerCase().includes(searchTerm.toLowerCase()) || t.cnpj.includes(searchTerm);
      let matchesFilter = true;
      if (filterStatus === 'active') matchesFilter = t.status === LicenseStatus.ATIVA;
      if (filterStatus === 'suspended') matchesFilter = t.status === LicenseStatus.SUSPENSA;
      if (filterStatus === 'expiring') {
        const diff = new Date(t.dataFimLicenca).getTime() - new Date().getTime();
        matchesFilter = diff > 0 && diff < (7 * 24 * 60 * 60 * 1000);
      }
      return matchesSearch && matchesFilter;
    });
  }, [allTenants, searchTerm, filterStatus]);

  const handleDeleteTenant = (id: string) => {
    if (window.confirm(`Excluir organização irreversivelmente?`)) {
      onUpdateTenants(allTenants.filter(t => t.id !== id));
      onUpdateUsers(allUsers.filter(u => u.tenantId !== id));
    }
  };

  const handleEditTenant = async (tenant: Tenant) => {
    setEditingTenantId(tenant.id);
    
    // Carregar registro fresco do banco para garantir dados atualizados
    const freshTenant = await dataSyncService.loadTenantData(tenant.id);
    const tenantData = freshTenant || tenant;
    
    const adminUser = allUsers.find(u => getUserTenantId(u) === tenantData.id && isAdminUser(u));
    const planLimits = resolvePlanLimits((tenantData.planoId || defaultPlanId) as PlanTemplate['id']);
    
    setFormData({
      nome: tenantData.nome,
      cnpj: tenantData.cnpj,
      emailAdmin: adminUser?.email || '',
      nomeGestor: adminUser?.nome || '',
      logoUrl: tenantData.logoUrl || '',
      plano: (tenantData.planoId || defaultPlanId) as PlanTemplate['id'],
      limiteUsuarios: tenantData.limiteUsuarios ?? planLimits.limiteUsuarios,
      limiteObras: tenantData.limiteObras ?? planLimits.limiteObras,
      limiteMaoDeObra: tenantData.limiteMaoDeObra ?? planLimits.limiteMaoDeObra,
      limiteMaquinario: tenantData.limiteMaquinario ?? planLimits.limiteMaquinario,
      limiteCargos: tenantData.limiteCargos ?? planLimits.limiteCargos,
      vencimento: tenantData.dataFimLicenca
    });
    setCurrentStep(1);
    setShowAddModal(true);
  };

  const handleSimulateAccess = (tenant: Tenant) => {
    console.log('[Admin Lookup - Tenant]', { id: tenant.id, nome: tenant.nome });
    console.log('[Admin Lookup - Array]', {
      total: allUsers.length,
      users: allUsers.map(u => ({ 
        id: u.id, 
        tenantId: (u as any).tenantId, 
        tenant_id: (u as any).tenant_id,
        role: (u as any).role 
      }))
    });
    
    // Debug do primeiro usuário para auditoria completa
    if (allUsers.length > 0) {
      console.log('[Admin Lookup - Primeiro Usuário (Chaves Completas)]', Object.keys(allUsers[0]));
      console.log('[Admin Lookup - Primeiro Usuário (Valores)]', allUsers[0]);
    }
    
    // Busca com comparação flexível (string normalizada e case-insensitive)
    const tenantAdmin = allUsers.find(u => {
      const userTenantId = getUserTenantId(u);
      const userRole = (u.role || '').toUpperCase();
      const match = String(userTenantId) === String(tenant.id) && (userRole === 'ADMIN' || userRole === 'SUPERADMIN');
      
      console.log('[Admin Lookup - Comparação]', {
        userId: u.id,
        userTenantId,
        targetTenantId: tenant.id,
        userRole,
        tenantMatch: String(userTenantId) === String(tenant.id),
        roleMatch: userRole === 'ADMIN' || userRole === 'SUPERADMIN',
        finalMatch: match
      });
      
      return match;
    });
    
    if (tenantAdmin) {
      console.log('[Admin Lookup - SUCCESS]', { adminId: tenantAdmin.id, nome: tenantAdmin.nome });
      onSimulateAccess(tenantAdmin);
    } else {
      console.error('[Admin Lookup - FAILED] Nenhum admin encontrado para tenant:', tenant.id);
      toast.error('Administrador não encontrado para esta organização.');
    }
  };

  const resetModal = () => {
    const limits = resolvePlanLimits(defaultPlanId);
    setFormData({ 
      nome: '', cnpj: '', emailAdmin: '', nomeGestor: '', logoUrl: '', plano: defaultPlanId, 
      ...limits,
      vencimento: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0] 
    });
    setCurrentStep(1);
    setEditingTenantId(null);
  };

  const handleSaveTenant = async () => {
    const error = validateStep1();
    if (error) { toast.error(error); return; }
    const tenantId = editingTenantId || uuidv4();
    const newTenant: Tenant = { 
      id: tenantId, 
      nome: formData.nome.toUpperCase().trim(), 
      cnpj: formData.cnpj, 
      logoUrl: formData.logoUrl || '', 
      limiteUsuarios: formData.limiteUsuarios, 
      limiteObras: formData.limiteObras,
      limiteMaoDeObra: formData.limiteMaoDeObra,
      limiteMaquinario: formData.limiteMaquinario,
      limiteCargos: formData.limiteCargos,
      planoId: formData.plano,
      dataFimLicenca: formData.vencimento, 
      status: LicenseStatus.ATIVA 
    };
    if (editingTenantId) {
      // Atualizar tenant existente
      onUpdateTenants(allTenants.map(t => t.id === editingTenantId ? newTenant : t));
      
      // Sincronizar com Supabase
      try {
        await dataSyncService.syncTenants([newTenant], editingTenantId);
        console.log('[MasterAdmin] Tenant atualizado no Supabase');
      } catch (error) {
        console.warn('[MasterAdmin] Tenant enfileirado para sincronização posterior:', error);
      }
      
      // ✅ ATUALIZAR NOME DO GESTOR TAMBÉM
      const adminUser = allUsers.find(u => getUserTenantId(u) === editingTenantId && isAdminUser(u));
      if (adminUser) {
        const updatedUser = { ...adminUser, nome: formData.nomeGestor.toUpperCase().trim() };
        onUpdateUsers(allUsers.map(u => 
          u.id === adminUser.id ? updatedUser : u
        ));
        
        // Sincronizar usuário atualizado
        try {
          await dataSyncService.syncUsers([updatedUser], editingTenantId);
          console.log('[MasterAdmin] Gestor atualizado no Supabase');
        } catch (error) {
          console.warn('[MasterAdmin] Gestor enfileirado para sincronização posterior:', error);
        }
      }
      
      setToastMessage("Organização atualizada com sucesso!");
    } else {
      // ✅ CRIAR NOVO USUÁRIO ADMIN COM SENHA GERADA
      const tempPassword = generateSecurePassword();
      const newUser: User = { 
        id: `user-${Date.now()}`, 
        nome: formData.nomeGestor.toUpperCase().trim(),
        email: formData.emailAdmin.toLowerCase().trim(), 
        tenantId: tenantId, 
        role: Role.ADMIN, 
        ativo: true, 
        cargo: 'Administrador Master',
        password: tempPassword,  // ✅ Armazenar senha para Auth
        lastPasswordChange: new Date().toISOString()
      };
      
      // Atualizar estado local
      onUpdateTenants([...allTenants, newTenant]);
      onUpdateUsers([...allUsers, newUser]);
      
      // ✅ SINCRONIZAR COM SUPABASE (Tenant + User com Auth)
      try {
        // Sincronizar tenant
        await dataSyncService.syncTenants([newTenant], tenantId);
        console.log('[MasterAdmin] Tenant criado no Supabase');
        
        // Sincronizar usuário (isso vai chamar authService.signup automaticamente)
        await dataSyncService.syncUsers([newUser], tenantId);
        console.log('[MasterAdmin] Usuário criado no Supabase Auth + tabela users');
      } catch (error) {
        console.warn('[MasterAdmin] Operações enfileiradas para sincronização posterior:', error);
      }
      
      // ✅ DISPARAR E-MAIL DE BOAS-VINDAS
      try {
        const emailSent = await sendWelcomeEmail(newUser, tempPassword);
        if (emailSent) {
          setToastMessage(`✅ Organização criada! E-mail enviado para ${formData.emailAdmin}`);
        } else {
          setToastMessage(`⚠️ Organização criada, mas e-mail não foi enviado. Notifique manualmente: ${tempPassword}`);
        }
      } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        setToastMessage(`⚠️ Organização criada. E-mail falhou: ${tempPassword}`);
      }
    }
    
    toast.success(editingTenantId ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!');
    setShowSuccessToast(true); 
    setShowAddModal(false); 
    resetModal();
  };

  const updatePlanField = (planId: string, field: keyof PlanTemplate, value: any) => {
    const newPlans = plansConfig.map(p => p.id === planId ? { ...p, [field]: value } : p);
    onUpdatePlansConfig(newPlans);
  };

  const renderSubscriptionsEditor = () => (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Editor de Ofertas Comerciais</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Defina preços e limites automáticos para novos clientes</p>
          </div>
          <button 
            onClick={async () => {
              setToastMessage('⏳ Salvando planos...');
              setShowSuccessToast(true);
              
              // 1. Salvar templates de plano no Supabase
              const success = await dataSyncService.upsertPlanTemplates(plansConfig);
              
              if (success) {
                // 2. Sincronizar limites para todos os tenants associados
                console.log('🔄 [MasterAdmin] Iniciando sincronização cascata de limites');
                const syncResult = await dataSyncService.syncPlanLimitsToTenants(plansConfig);
                
                // 3. Persistir também no localStorage como fallback
                localStorage.setItem('ep_plans_config', JSON.stringify(plansConfig));
                
                if (syncResult.success) {
                  setToastMessage('✅ Planos e limites sincronizados com sucesso!');
                  setShowSuccessToast(true);
                  console.log('🎉 [MasterAdmin] Plan templates e tenant limits sincronizados');
                } else {
                  const firstError = syncResult.errors[0] || 'Erro desconhecido ao sincronizar limites';
                  setToastMessage(`⚠️ Erro ao sincronizar limites: ${firstError}`);
                  setShowSuccessToast(true);
                  console.warn('⚠️ [MasterAdmin] Planos salvos, limites não sincronizados', syncResult.errors);
                }
              } else {
                // Se falhar em salvar os planos, salva localmente mesmo assim
                localStorage.setItem('ep_plans_config', JSON.stringify(plansConfig));
                setToastMessage('⚠️ Planos salvos localmente (erro ao sincronizar com servidor)');
                setShowSuccessToast(true);
                console.warn('⚠️ [MasterAdmin] Plan templates salvos localmente apenas');
              }
            }}
            className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2"
          >
            <Save size={16} /> Salvar Alterações Globais
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plansConfig.map((plan, idx) => (
          <motion.div 
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white/80 backdrop-blur-xl rounded-[40px] border border-slate-100 shadow-xl overflow-hidden flex flex-col relative group"
          >
            <div className="p-10 pb-6 border-b border-slate-50 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none -mr-10 -mt-10">
                  <CreditCard size={120} style={{ color: plan.cor }} />
               </div>
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.cor }} />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Pacote {plan.id}</span>
               </div>
               <input 
                 value={plan.nome} 
                 onChange={e => onUpdatePlansConfig(plansConfig.map(p => p.id === plan.id ? {...p, nome: e.target.value} : p))}
                 className="text-2xl font-black text-slate-800 uppercase tracking-tighter bg-transparent outline-none w-full"
               />
            </div>

            <div className="p-10 space-y-8 flex-1">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mensalidade (BRL)</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">R$</span>
                    <input 
                      type="number" 
                      value={plan.precoMensal}
                      onChange={e => updatePlanField(plan.id, 'precoMensal', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-100 pl-12 pr-6 py-4 rounded-2xl text-xl font-black text-[#1e293b] outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    />
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1"><Users size={10} /> Usuários</label>
                    <input 
                      type="number" 
                      value={plan.limiteUsuarios}
                      onChange={e => updatePlanField(plan.id, 'limiteUsuarios', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-100 px-5 py-3 rounded-xl text-sm font-black text-slate-700 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1"><HardHat size={10} /> Obras</label>
                    <input 
                      type="number" 
                      value={plan.limiteObras}
                      onChange={e => updatePlanField(plan.id, 'limiteObras', Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-100 px-5 py-3 rounded-xl text-sm font-black text-slate-700 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest px-1 flex items-center gap-1"><Users size={10} /> Mão Obra</label>
                    <input 
                      type="number" 
                      value={plan.limiteMaoDeObra}
                      onChange={e => updatePlanField(plan.id, 'limiteMaoDeObra', Number(e.target.value))}
                      className="w-full bg-blue-50/30 border border-blue-100 px-5 py-3 rounded-xl text-sm font-black text-blue-700 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest px-1 flex items-center gap-1"><Truck size={10} /> Máquinas</label>
                    <input 
                      type="number" 
                      value={plan.limiteMaquinario}
                      onChange={e => updatePlanField(plan.id, 'limiteMaquinario', Number(e.target.value))}
                      className="w-full bg-orange-50/30 border border-orange-100 px-5 py-3 rounded-xl text-sm font-black text-orange-700 outline-none"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-1 flex items-center gap-1"><Briefcase size={10} /> Cargos & HH</label>
                    <input 
                      type="number" 
                      value={plan.limiteCargos}
                      onChange={e => updatePlanField(plan.id, 'limiteCargos', Number(e.target.value))}
                      className="w-full bg-slate-100 border border-slate-200 px-5 py-3 rounded-xl text-sm font-black text-slate-800 outline-none"
                    />
                  </div>
               </div>

               <div className="space-y-3 pt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Recursos Incluídos</p>
                  <div className="space-y-2">
                    {['Cronograma Básico', 'Diário de Obra', 'Curva S Realizada', 'Gestão Financeira', 'Relatórios PDF', 'Assinatura Digital', 'API Integration'].map(feature => {
                       const isChecked = plan.recursos.includes(feature);
                       return (
                         <div 
                           key={feature}
                           onClick={() => {
                             const newRecursos = isChecked 
                               ? plan.recursos.filter(f => f !== feature) 
                               : [...plan.recursos, feature];
                             updatePlanField(plan.id, 'recursos', newRecursos);
                           }}
                           className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${isChecked ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'}`}
                         >
                            <span className="text-[10px] font-bold uppercase tracking-tight">{feature}</span>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200'}`}>
                               {isChecked && <Check size={12} strokeWidth={4} />}
                            </div>
                         </div>
                       );
                    })}
                  </div>
               </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderPaymentsEditor = () => (
    <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
          <Wallet size={18} className="text-blue-600" /> Configuração do Gateway de Pagamento
        </h3>
        
        <div className="space-y-8">
          {/* Seleção de Gateway */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Selecione o Gateway Ativo</label>
            <div className="grid grid-cols-3 gap-4">
              {['STRIPE', 'ASAAS', 'MERCADO_PAGO'].map(gateway => (
                <button 
                  key={gateway}
                  onClick={() => onUpdateGlobalConfig({ ...globalConfig, gatewayType: gateway as any })}
                  className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all border ${globalConfig.gatewayType === gateway ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                >
                  <Zap size={14} className={globalConfig.gatewayType === gateway ? 'text-blue-400' : 'text-slate-300'} />
                  {gateway.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Chaves de API */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                {globalConfig.gatewayType === 'MERCADO_PAGO' ? 'Public Key' : 'Chave Pública (API Key)'}
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  value={globalConfig.publicKey || ''} 
                  onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, publicKey: e.target.value })}
                  placeholder={globalConfig.gatewayType === 'MERCADO_PAGO' ? 'APP_USR-...' : 'pk_test_...'} 
                  className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" 
                />
                <Lock size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                {globalConfig.gatewayType === 'MERCADO_PAGO' ? 'Access Token' : 'Chave Secreta (Private Key)'}
              </label>
              <div className="relative">
                <input 
                  type={showSecretKey ? "text" : "password"} 
                  value={globalConfig.secretKey || ''} 
                  onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, secretKey: e.target.value })}
                  placeholder={globalConfig.gatewayType === 'MERCADO_PAGO' ? 'APP_USR-...' : 'sk_test_...'} 
                  className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" 
                />
                <button 
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-blue-500 transition-colors"
                >
                  {showSecretKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Webhook Endpoint */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Endpoint de Webhook</h4>
                <div className="flex items-center gap-2 text-emerald-600">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-[9px] font-black uppercase">Pronto para receber sinais</span>
                </div>
             </div>
             <div className="bg-white border border-slate-100 px-6 py-4 rounded-2xl flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  https://api.projexmaster.io/webhooks/v1/{globalConfig.gatewayType?.toLowerCase() || 'payments'}
                </span>
                <Link size={14} className="text-blue-500 cursor-pointer" onClick={() => { 
                  navigator.clipboard.writeText(`https://api.projexmaster.io/webhooks/v1/${globalConfig.gatewayType?.toLowerCase() || 'payments'}`); 
                  setToastMessage("Link de Webhook copiado!");
                  setShowSuccessToast(true);
                }} />
             </div>
          </div>

          {/* Mercado Pago Help */}
          {globalConfig.gatewayType === 'MERCADO_PAGO' && (
            <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex items-start gap-4">
              <HelpCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Como configurar o Mercado Pago</p>
                <p className="text-[10px] text-blue-600 leading-relaxed font-medium">
                  1. Acesse o <span className="font-black">Painel do Mercado Pago</span> {'>'} Suas Aplicações.<br/>
                  2. Vá em <span className="font-black">Webhooks</span> e cole a URL acima.<br/>
                  3. Selecione os eventos: <span className="italic">payment.created, payment.updated, payment.approved, payment.rejected</span>.<br/>
                  4. Certifique-se de estar usando as chaves de <span className="font-black">Produção</span> para recebimentos reais.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Botão Salvar */}
        <div className="mt-12 pt-8 border-t border-slate-50 flex justify-end">
          <button 
            onClick={() => {
              setToastMessage("Configurações de pagamento atualizadas!");
              setShowSuccessToast(true);
            }}
            className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-2xl"
          >
            <Save size={18} /> Salvar Credenciais
          </button>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receita Global (MRR)</p>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><DollarSign size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dashboardStats.mrr)}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Mensalidade Ativa</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">VGV sob Gestão</p>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Wallet size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(dashboardStats.totalVGV)}
          </p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Volume de Obras</p>
        </div>
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Engajamento Diário</p>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Zap size={20} /></div>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{dashboardStats.engagement24h}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">RDOs Lançados (24h)</p>
        </div>
        <div className={`p-8 rounded-[32px] border shadow-sm flex flex-col justify-between ${dashboardStats.renewalAlerts > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alerta de Renovação</p>
            <div className={`p-3 rounded-2xl ${dashboardStats.renewalAlerts > 0 ? 'bg-red-500 text-white' : 'bg-slate-50 text-slate-300'}`}>
              <AlertCircle size={20} />
            </div>
          </div>
          <p className={`text-2xl font-black tracking-tight ${dashboardStats.renewalAlerts > 0 ? 'text-red-600' : 'text-slate-900'}`}>{dashboardStats.renewalAlerts}</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Vencimentos (30 dias)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-10">Market Share por Plano</h3>
          <div className="h-[250px] min-h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dashboardStats.marketShareData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {dashboardStats.marketShareData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base</span>
              <span className="text-xl font-black text-slate-800">{allTenants.length}</span>
            </div>
          </div>
        </div>
        <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] mb-10">Crescimento da Base</h3>
          <div className="h-[250px] min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardStats.growthData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="users" stroke={primaryColor} fillOpacity={0.1} fill={primaryColor} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" /> Empresas no Limite (+80%)
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-4">Empresa</th>
                  <th className="px-8 py-4">Uso (Máx)</th>
                  <th className="px-8 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dashboardStats.atLimitTenants.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{t.nome}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{t.planoId}</p>
                    </td>
                    <td className="px-8 py-4">
                      <div className="w-32 space-y-1">
                        <div className="flex justify-between text-[8px] font-black uppercase text-slate-400">
                          <span>Uso</span>
                          <span>{t.maxUsage.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${t.maxUsage >= 95 ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${t.maxUsage}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <a href={`https://wa.me/5511999999999?text=Olá, sou da Projex. Vi que a ${t.nome} está próxima ao limite do plano ${t.planoId}.`} target="_blank" className="inline-flex p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm">
                        <Phone size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
              <ShieldAlert size={16} className="text-red-500" /> Risco de Churn (Inatividade +7d)
            </h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-8 py-4">Empresa</th>
                  <th className="px-8 py-4">Último RDO</th>
                  <th className="px-8 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dashboardStats.churnRiskTenants.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4"><p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{t.nome}</p></td>
                    <td className="px-8 py-4 text-[10px] font-bold text-slate-400 uppercase">{t.latestLogDate ? t.latestLogDate.toLocaleDateString() : 'NUNCA'}</td>
                    <td className="px-8 py-4 text-right"><span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[8px] font-black uppercase">CRÍTICO</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 relative">
      <AnimatePresence>{showSuccessToast && <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3"><CheckCircle2 size={24} /><p className="text-sm font-black uppercase tracking-widest">{toastMessage}</p></motion.div>}</AnimatePresence>
      {activeTab === 'master-dash' && renderDashboard()}
      {activeTab === 'tenants' && (
        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
              <div className="relative w-full sm:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} /><input type="text" placeholder="Buscar por Nome ou CNPJ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-50 border border-slate-100 pl-11 pr-4 py-3 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" /></div>
            </div>
            <button onClick={() => { resetModal(); setShowAddModal(true); }} className="px-6 py-3.5 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 hover:brightness-110" style={{ backgroundColor: primaryColor }}><Plus size={16} /> Nova Organização</button>
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left">
              <thead><tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><th className="px-8 py-5 w-10">Saúde</th><th className="px-8 py-5">Organização / Tenant</th><th className="px-8 py-5">Usage</th><th className="px-8 py-5">Vencimento</th><th className="px-8 py-5 text-center">Status</th><th className="px-8 py-5 text-right">Controles</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTenants.map(t => {
                  const uCount = allUsers.filter(u => u.tenantId === t.id).length;
                  const percent = Math.min(100, (uCount / t.limiteUsuarios) * 100);
                  return (
                    <React.Fragment key={t.id}>
                      <tr className={`hover:bg-slate-50/50 transition-all group`}>
                        <td className="px-8 py-5"><div className={`w-3 h-3 rounded-full ${t.status === LicenseStatus.SUSPENSA ? 'bg-red-500' : 'bg-emerald-500'}`} /></td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">{t.logoUrl ? <img src={t.logoUrl} className="w-full h-full object-cover" /> : <Building2 size={16} className="text-slate-400" />}</div>
                            <div><p className="text-xs font-black text-slate-800 uppercase">{t.nome}</p><p className="text-[9px] font-bold text-slate-400">{t.cnpj}</p></div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${percent}%` }} /></div>
                        </td>
                        <td className="px-8 py-5 text-xs font-bold text-slate-600">{new Date(t.dataFimLicenca).toLocaleDateString()}</td>
                        <td className="px-8 py-5 text-center"><span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${t.status === LicenseStatus.ATIVA ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{t.status}</span></td>
                        <td className="px-8 py-5 text-right"><div className="flex justify-end gap-2">
                          <ProtectedElement resource={PermissionResource.TENANTS} action={Action.MANAGE}>
                            <button onClick={() => handleSimulateAccess(t)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Zap size={14} /></button>
                          </ProtectedElement>
                          <ProtectedElement resource={PermissionResource.TENANTS} action={Action.UPDATE}>
                            <button onClick={() => handleEditTenant(t)} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-900 hover:text-white transition-all"><Edit2 size={14} /></button>
                          </ProtectedElement>
                          <ProtectedElement resource={PermissionResource.TENANTS} action={Action.DELETE}>
                            <button onClick={() => handleDeleteTenant(t.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"><Trash2 size={14} /></button>
                          </ProtectedElement>
                        </div></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'subscriptions' && renderSubscriptionsEditor()}
      {activeTab === 'payments' && renderPaymentsEditor()}
      {activeTab === 'system-branding' && (
        <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.4em] mb-10 flex items-center gap-3"><Palette size={18} className="text-blue-600" /> White-label Global Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Software Primary Name</label><input type="text" value={globalConfig.softwareName} onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, softwareName: e.target.value.toUpperCase() })} className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-black uppercase outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Subtítulo Estratégico</label><input type="text" value={globalConfig.softwareSubtitle || ''} onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, softwareSubtitle: e.target.value })} placeholder="Ex: Engineering Suite" className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Global Theme Color</label><div className="flex gap-4"><input type="color" value={globalConfig.primaryColor} onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, primaryColor: e.target.value })} className="w-16 h-14 bg-white border border-slate-100 rounded-2xl cursor-pointer p-1 overflow-hidden" /><input type="text" value={globalConfig.primaryColor} onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, primaryColor: e.target.value })} className="flex-1 bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-black uppercase outline-none" /></div></div>
              </div>
              <div className="space-y-6 flex flex-col items-center justify-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl mb-4" style={{ backgroundColor: globalConfig.primaryColor }}>{globalConfig.systemLogoUrl ? <img src={globalConfig.systemLogoUrl} className="w-16 h-16 object-contain" /> : <Zap className="text-white" size={40} />}</div>
                <input
                  type="text"
                  value={globalConfig.systemLogoUrl || ''}
                  onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, systemLogoUrl: e.target.value })}
                  placeholder="URL da logo (PNG/SVG)"
                  className="w-full bg-white border border-slate-200 px-4 py-2 rounded-xl text-[9px] font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 transition-all mb-3"
                />
                <button 
                  onClick={() => {
                    setToastMessage("URL de logo atualizada. Salve para persistir!");
                    setShowSuccessToast(true);
                  }}
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-2"><Upload size={14} /> Adicionar Logo URL</button>
              </div>
            </div>
            
            {/* 🎨 NOVA SEÇÃO: Personalização da Tela de Login */}
            <div className="mt-12 pt-12 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-600 uppercase tracking-[0.3em] mb-6 flex items-center gap-2"><Lock size={16} className="text-indigo-600" /> Personalização da Tela de Login</h4>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">URL da Imagem de Fundo</label>
                  <input 
                    type="text" 
                    value={globalConfig.loginBackgroundUrl || ''} 
                    onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, loginBackgroundUrl: e.target.value })} 
                    placeholder="https://exemplo.com/imagem-fundo.jpg" 
                    className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-100 transition-all" 
                  />
                  <p className="text-[9px] text-slate-400 font-medium px-1">Deixe vazio para usar a imagem padrão de obra</p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Título Principal</label>
                  <input 
                    type="text" 
                    value={globalConfig.loginHeading || ''} 
                    onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, loginHeading: e.target.value })} 
                    placeholder="Engenharia que conecta pessoas" 
                    className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-100 transition-all" 
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Texto Descritivo</label>
                  <textarea 
                    value={globalConfig.loginDescription || ''} 
                    onChange={(e) => onUpdateGlobalConfig({ ...globalConfig, loginDescription: e.target.value })} 
                    placeholder="Planeje, colabore e execute seus projetos com a precisão de uma obra bem coordenada. Tecnologia e engenharia em perfeita sinergia." 
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none" 
                  />
                </div>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-slate-50 flex justify-end">
              <button 
                onClick={async () => {
                  console.log('💾 [MasterAdmin] Salvando global config:', globalConfig);
                  const success = await dataSyncService.upsertGlobalConfig(globalConfig);
                  if (success) {
                    // Atualizar estado local do App (força re-render)
                    onUpdateGlobalConfig(globalConfig);
                    
                    // Persistir no localStorage para sobrevivência de F5
                    localStorage.setItem('ep_global_config', JSON.stringify(globalConfig));
                    
                    // Aplicar CSS Variables imediatamente
                    if (globalConfig.primaryColor) {
                      document.documentElement.style.setProperty('--primary-color', globalConfig.primaryColor);
                    }
                    
                    // Feedback visual
                    setToastMessage("✅ Configurações globais salvas no Supabase!");
                    setShowSuccessToast(true);
                    
                    console.log('✅ [MasterAdmin] Global config aplicado em toda interface');
                  } else {
                    setToastMessage("⚠️ Erro ao salvar no Supabase. Configurações salvas localmente.");
                    setShowSuccessToast(true);
                  }
                }}
                className="flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-2xl"><Save size={18} /> Persist Global Assets</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRAR / EDITAR */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in overflow-hidden">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white w-full max-w-2xl max-h-[550px] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-slate-100">
              <div className="px-10 py-6 border-b border-slate-100 bg-white shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xl font-black text-[#1e293b] tracking-tight uppercase">{editingTenantId ? 'Editar Organização' : 'Configurar Nova Organização'}</h3>
                    <div className="flex items-center gap-3 mt-1.5"><div className={`w-2 h-2 rounded-full transition-all ${currentStep === 1 ? 'bg-blue-600 w-6' : 'bg-slate-200 cursor-pointer'}`} onClick={() => setCurrentStep(1)}></div><div className={`w-2 h-2 rounded-full transition-all ${currentStep === 2 ? 'bg-blue-600 w-6' : 'bg-slate-200 cursor-pointer'}`} onClick={handleNextStep}></div><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Etapa {currentStep} de 2</span></div>
                  </div>
                  <button onClick={() => { setShowAddModal(false); resetModal(); }} className="p-2.5 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"><X size={20} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 scrollbar-hide bg-slate-50/20">
                {currentStep === 1 ? (
                  <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Fantasia da Organização</label><input type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} placeholder="Nome da Organização" className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 transition-all" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CNPJ Fiscal</label><input type="text" value={formData.cnpj} onChange={handleCNPJChange} placeholder="00.000.000/0000-00" className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo do Gestor</label><input type="text" value={formData.nomeGestor} onChange={e => setFormData({...formData, nomeGestor: e.target.value})} placeholder="Ex: João Silva Santos" className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 transition-all" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail Administrativo Master</label><input type="email" value={formData.emailAdmin} onChange={e => setFormData({...formData, emailAdmin: e.target.value})} placeholder="admin@empresa.com" className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" /></div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-6">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Plano de Assinatura</label>
                        <div className="relative">
                          <select value={formData.plano} onChange={e => setFormData({...formData, plano: e.target.value as PlanTemplate['id']})} className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-4 focus:ring-blue-50 appearance-none cursor-pointer">
                            {plansConfig.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
                          </select>
                          <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Vencimento da Licença</label><input type="date" value={formData.vencimento} onChange={e => setFormData({...formData, vencimento: e.target.value})} className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50" /></div>
                      
                      {/* Inputs bloqueados (readOnly) com automação baseada no plano selecionado */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Limite Logins</label>
                        <input readOnly type="number" value={formData.limiteUsuarios} className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-xs font-black text-slate-400 opacity-70 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Limite Obras</label>
                        <input readOnly type="number" value={formData.limiteObras} className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl text-xs font-black text-slate-400 opacity-70 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">Capacidade Mão Obra</label>
                        <input readOnly type="number" value={formData.limiteMaoDeObra} className="w-full bg-slate-50 border border-blue-50 px-5 py-3 rounded-2xl text-xs font-black text-blue-300 opacity-70 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest px-1">Capacidade Maquinário</label>
                        <input readOnly type="number" value={formData.limiteMaquinario} className="w-full bg-slate-50 border border-orange-50 px-5 py-3 rounded-2xl text-xs font-black text-orange-300 opacity-70 cursor-not-allowed" />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1">Capacidade Cargos & HH</label>
                        <input readOnly type="number" value={formData.limiteCargos} className="w-full bg-slate-100 border border-slate-200 px-5 py-3 rounded-2xl text-xs font-black text-slate-400 opacity-70 cursor-not-allowed" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="px-10 py-6 bg-white border-t border-slate-100 shrink-0 flex items-center justify-between">
                <div className="flex gap-4"><button onClick={() => { setShowAddModal(false); resetModal(); }} className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>{currentStep === 2 && <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 text-slate-600 font-black text-[11px] uppercase tracking-widest hover:text-slate-900 transition-all"><ChevronLeft size={16} /> Voltar</button>}</div>
                <div className="flex gap-4">{currentStep === 1 ? (<button onClick={handleNextStep} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all">Próximo <ChevronRight size={16} /></button>) : (
                  <ProtectedElement resource={PermissionResource.TENANTS} action={editingTenantId ? Action.UPDATE : Action.CREATE}>
                    <button onClick={handleSaveTenant} className="text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all" style={{ backgroundColor: primaryColor }}><CheckCircle2 size={18} /> {editingTenantId ? 'Salvar Alterações' : 'Concluir Cadastro'}</button>
                  </ProtectedElement>
                )}</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MasterAdminView;
