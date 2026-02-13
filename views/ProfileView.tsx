import React, { useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { User, Tenant, Role, GlobalConfig, PlanTemplate } from '../types';
import { authService } from '../services/authService'; // 🔐 Named export
import { dataSyncService } from '../services/dataService';
import { emailService } from '../services/emailService'; // 📧 Email service
import { v4 as uuidv4 } from 'uuid'; // 🔑 UUID generator
import { useImageUpload } from '../hooks/useImageUpload';
import { 
  User as UserIcon, 
  Building, 
  Users, 
  Shield, 
  Camera, 
  Upload, 
  PenTool, 
  Trash2,
  X,
  CreditCard,
  ChevronRight,
  Plus,
  Edit2,
  Palette,
  Terminal,
  Activity,
  CheckCircle2,
  Calendar,
  Lock,
  Check,
  AlertCircle,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageUploader from '../components/ImageUploader';
import ImagePreviewModal from '../components/ImagePreviewModal';

interface ProfileViewProps {
  user: User;
  onUpdateUser: (u: User) => void;
  tenant: Tenant;
  onUpdateTenant: (t: Tenant) => void;
  allUsers: User[];
  onUpdateUsers: (u: User[]) => void;
  plansConfig: PlanTemplate[]; // Propriedade adicionada para sincronismo
  globalConfig: GlobalConfig;
  onUpdateGlobalConfig: (c: GlobalConfig) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ 
  user, 
  onUpdateUser, 
  tenant, 
  onUpdateTenant, 
  allUsers, 
  onUpdateUsers,
  plansConfig,
  globalConfig,
  onUpdateGlobalConfig
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'perfil' | 'empresa' | 'equipe' | 'seguranca' | 'branding'>('perfil');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false); // 📧 Loading do envio de e-mail
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [previewImageOpen, setPreviewImageOpen] = useState(false);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string>('');
  const sigInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Avatar upload state
  const { loading: avatarLoading, error: avatarError, progress: avatarProgress, imageUrl: avatarUrl, upload: uploadAvatar, reset: resetAvatarUpload } = useImageUpload();

  const isSuperAdmin = user.role === Role.SUPERADMIN;
  const isAdmin = user.role === Role.ADMIN || isSuperAdmin;
  const primaryColor = globalConfig.primaryColor || '#3b82f6';

  // --- LÓGICA DE SINCRONIZAÇÃO DINÂMICA DE LIMITES (Master Admin) ---
  const currentPlan = useMemo(() => {
    return plansConfig.find(p => p.id === tenant.planoId);
  }, [plansConfig, tenant.planoId]);

  // Se o plano global mudou (ex: de 5 para 50), o sistema prioriza o valor do modelo de plano
  const effectiveUserLimit = currentPlan ? currentPlan.limiteUsuarios : tenant.limiteUsuarios;

  const handleInviteUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Bloqueio corrigido usando o limite efetivo
    if (allUsers.length >= effectiveUserLimit) {
      toast.error('Capacidade da licença atingida. Solicite upgrade no Master Admin.');
      return;
    }
    
    setInviteLoading(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      const nome = formData.get('nome') as string;
      const inviteEmail = formData.get('email');
      const role = formData.get('role') as Role;
      const cargo = formData.get('cargo') as string;
      
      // 🔒 BLINDAGEM: Captura segura de e-mail (previne TypeError: toLowerCase())
      const targetEmail = String(inviteEmail || '').trim().toLowerCase();
      
      // 🔒 VALIDAÇÃO PREVENTIVA: E-mail obrigatório
      if (!targetEmail) {
        toast.error('❌ E-mail não detectado. Por favor, preencha o campo de e-mail.');
        setInviteLoading(false);
        return;
      }
      
      // 🔒 VALIDAÇÃO: Nome obrigatório
      if (!nome || typeof nome !== 'string' || nome.trim() === '') {
        toast.error('❌ Por favor, preencha o nome do convidado.');
        setInviteLoading(false);
        return;
      }
      
      // 🔒 VALIDAÇÃO: Formato de e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(targetEmail)) {
        toast.error('❌ Formato de e-mail inválido.');
        setInviteLoading(false);
        return;
      }
      
      // 🔒 VALIDAÇÃO: Role obrigatório
      if (!role) {
        toast.error('❌ Por favor, selecione o nível de acesso.');
        setInviteLoading(false);
        return;
      }
      
      // 🔑 Gerar token único de convite (UUID v4)
      const inviteToken = uuidv4();
      
      // ⏰ Token válido por 7 dias
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7);
      
      // 💾 PRIORIDADE 1: Salvar convite na tabela user_invites (BANCO PRIMEIRO)
      const inviteData = {
        token: inviteToken,
        email: targetEmail,
        name: nome.trim(),
        tenant_id: tenant.id,
        role: role,
        invited_by: user.id,
        expires_at: expiryDate.toISOString(),
        status: 'pending',
        metadata: {
          cargo: cargo || '',
          invited_by_name: user.nome || 'Administrador',
          tenant_name: tenant.nome || 'Sistema'
        }
      };
      
      const { data: dbInvite, error: dbError } = await dataSyncService.supabase
        .from('user_invites')
        .insert(inviteData)
        .select()
        .single();
      
      if (dbError) {
        console.error('[ProfileView] Erro ao salvar convite no banco:', dbError);
        toast.error('❌ Erro ao criar convite no banco de dados. Tente novamente.');
        setInviteLoading(false);
        return;
      }
      
      // 📊 LOG DE INSERÇÃO: Confirma criação do token
      console.log('✅ Convite salvo no banco:', dbInvite);
      
      // 👤 Criar novo usuário no estado local (sincronismo)
      const newUser: User = {
        id: `u-${Date.now()}`,
        nome: nome.trim(),
        email: targetEmail,
        tenantId: tenant.id,
        role,
        cargo,
        ativo: true,
        inviteToken,
        inviteTokenExpiry: expiryDate.toISOString(),
        hasCompletedOnboarding: false,
      };
      
      const updatedUsers = [...allUsers, newUser];
      onUpdateUsers(updatedUsers);
      
      // 📧 PRIORIDADE 2: Enviar e-mail APENAS após sucesso no banco
      const emailResult = await emailService.sendInviteEmail({
        toEmail: targetEmail,
        toName: nome.trim(),
        inviteToken,
        tenantName: tenant.nome || 'Sistema',
        role,
        invitedByName: user.nome || 'Administrador',
        primaryColor: globalConfig.primaryColor || '#3b82f6',
      });
      
      if (emailResult.success) {
        toast.success('✅ Convite enviado com sucesso! O usuário receberá um e-mail.');
        setShowInviteModal(false);
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(`❌ Convite criado, mas erro ao enviar e-mail: ${emailResult.error}`);
      }
      
    } catch (error: any) {
      console.error('[ProfileView] Erro ao enviar convite:', error);
      toast.error('❌ Erro ao processar convite. Tente novamente.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'signature') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (type === 'signature') onUpdateUser({ ...user, signatureUrl: result });
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async (url: string) => {
    // 1. Atualizar estado local
    const updatedTenant = { ...tenant, logoUrl: url };
    onUpdateTenant(updatedTenant);
    
    // 2. Persistir no banco de dados
    try {
      await dataSyncService.syncTenants([updatedTenant], tenant.id);
      console.log('[ProfileView] Logo URL saved to database:', url);
    } catch (error) {
      console.error('[ProfileView] Error saving logo URL to database:', error);
    }
  };

  const handleAvatarUpload = async (url: string) => {
    // 1. Atualizar estado local
    const updatedUser = { ...user, avatarUrl: url };
    onUpdateUser(updatedUser);
    onUpdateUsers(allUsers.map(u => (u.id === updatedUser.id ? updatedUser : u)));
    
    // 2. Persistir no banco de dados
    try {
      console.log('[ProfileView] Saving avatar to database:', {
        userId: user.id,
        tenantId: user.tenantId,
        avatarUrl: url,
        userObj: updatedUser
      });
      
      await dataSyncService.syncUsers([updatedUser], user.tenantId);
      console.log('[ProfileView] ✓ Avatar URL saved to database:', url);
    } catch (error) {
      console.error('[ProfileView] ✗ Error saving avatar URL to database:', error);
    }
  };

  const handleSysLogoUpload = (url: string) => {
    onUpdateGlobalConfig({ ...globalConfig, systemLogoUrl: url });
  };

  const handlePreviewImage = (url: string) => {
    setSelectedPreviewUrl(url);
    setPreviewImageOpen(true);
  };

  /* =====================================================
     GESTÃO DE CREDENCIAIS - TROCA DE SENHA SEGURA
     ===================================================== */
  const handleChangePassword = async () => {
    setPasswordError('');
    
    // Validações
    if (!currentPassword.trim()) {
      setPasswordError('Informe sua senha atual para validação.');
      return;
    }
    
    if (user.password && currentPassword !== user.password) {
      setPasswordError('Senha atual incorreta.');
      return;
    }
    
    if (!newPassword.trim()) {
      setPasswordError('Informe uma nova senha.');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    
    if (newPassword === currentPassword) {
      setPasswordError('A nova senha não pode ser igual à atual.');
      return;
    }
    
    try {
      setPasswordLoading(true);
      
      console.log('🔐 [ProfileView] Iniciando troca de senha via authService');
      
      // Chamar authService real (Supabase Auth)
      const result = await authService.updatePassword(newPassword);
      
      console.log('🔐 [ProfileView] Resultado authService:', result);
      
      if (!result.success) {
        // Erro do Supabase
        setPasswordError(result.error || 'Erro desconhecido ao atualizar senha.');
        return;
      }
      
      // ✅ Sucesso: Atualizar user local com lastPasswordChange
      const updatedUser = {
        ...user,
        lastPasswordChange: new Date().toISOString()
      };
      onUpdateUser(updatedUser);
      
      // Resetar formulário
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordModal(false);
      
      // Toast de sucesso (simular toast nativo)
      const toastDiv = document.createElement('div');
      toastDiv.className = 'fixed top-8 right-8 z-[300] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-top-5 duration-500';
      toastDiv.textContent = '✅ Senha alterada com sucesso!';
      document.body.appendChild(toastDiv);
      
      setTimeout(() => {
        toastDiv.classList.add('animate-out', 'fade-out', 'slide-out-to-top-5');
        setTimeout(() => toastDiv.remove(), 500);
      }, 4000);
      
    } catch (error) {
      console.error('❌ [ProfileView] Exception ao alterar senha:', error);
      setPasswordError('Erro inesperado. Tente novamente ou contate o suporte.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const rolesToInvite = Object.values(Role).filter(r => isSuperAdmin ? true : r !== Role.SUPERADMIN);

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto pb-12">
      
      {/* Sub-navegação Lateral */}
      <aside className="w-full lg:w-72 space-y-2">
        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-8 px-4 flex items-center gap-2">
          <Terminal size={14} className="text-blue-500" /> Comando Central
        </h2>
        
        <button 
          onClick={() => setActiveSubTab('perfil')}
          className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'perfil' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
          style={{ color: activeSubTab === 'perfil' ? primaryColor : undefined }}
        >
          <div className="flex items-center gap-4">
            <UserIcon size={18} />
            <span className="text-[11px] font-black uppercase tracking-widest">Meu Perfil</span>
          </div>
          <ChevronRight size={14} className={activeSubTab === 'perfil' ? 'opacity-100' : 'opacity-0'} />
        </button>

        {isAdmin && (
          <>
            <button 
              onClick={() => setActiveSubTab('empresa')}
              className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'empresa' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
              style={{ color: activeSubTab === 'empresa' ? primaryColor : undefined }}
            >
              <div className="flex items-center gap-4">
                <Building size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest">Empresa</span>
              </div>
              <ChevronRight size={14} className={activeSubTab === 'empresa' ? 'opacity-100' : 'opacity-0'} />
            </button>

            <button 
              onClick={() => setActiveSubTab('equipe')}
              className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'equipe' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
              style={{ color: activeSubTab === 'equipe' ? primaryColor : undefined }}
            >
              <div className="flex items-center gap-4">
                <Users size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest">Minha Equipe</span>
              </div>
              <ChevronRight size={14} className={activeSubTab === 'equipe' ? 'opacity-100' : 'opacity-0'} />
            </button>

            <button 
              onClick={() => setActiveSubTab('seguranca')}
              className={`w-full flex items-center justify-between p-4 rounded-[20px] transition-all group ${activeSubTab === 'seguranca' ? 'bg-white shadow-2xl' : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}`}
              style={{ color: activeSubTab === 'seguranca' ? primaryColor : undefined }}
            >
              <div className="flex items-center gap-4">
                <Shield size={18} />
                <span className="text-[11px] font-black uppercase tracking-widest">Segurança</span>
              </div>
              <ChevronRight size={14} className={activeSubTab === 'seguranca' ? 'opacity-100' : 'opacity-0'} />
            </button>
          </>
        )}

        {/* SaaS Branding moved to Master Admin Config. White-label menu */}

        <div className="pt-10">
           <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[32px] text-white shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none"><CreditCard size={80} /></div>
              <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.4em] mb-1">Status Licença</p>
              <p className="text-sm font-black uppercase mb-6 tracking-tight">Active Plan</p>
              
              <div className="space-y-4">
                 <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 mb-1">
                       <CheckCircle2 size={14} className="text-emerald-500" />
                       <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Válido até</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <Calendar size={18} className="text-emerald-500" />
                       <span className="text-base font-black text-emerald-500 tracking-tight">
                          {new Date(tenant.dataFimLicenca).toLocaleDateString()}
                       </span>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      {/* Conteúdo Principal Flexível */}
      <div className="flex-1">
        {activeSubTab === 'perfil' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
            <div className="flex items-center gap-8 mb-8">
              <div className="shrink-0 flex flex-col items-center gap-2">
                {/* Avatar Interativo - Clean Design */}
                <div className="relative group">
                  {/* Avatar com Foto */}
                  {user.avatarUrl || avatarUrl ? (
                    <div className="relative w-28 h-28 rounded-3xl overflow-hidden border-4 border-slate-50 shadow-lg cursor-pointer transition-transform group-hover:scale-105">
                      <img 
                        src={avatarUrl || user.avatarUrl} 
                        alt="Avatar"
                        className="w-full h-full object-cover"
                        onClick={() => handlePreviewImage(avatarUrl || user.avatarUrl!)}
                      />
                      {/* Overlay Hover com Câmera */}
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-3xl">
                        <Camera size={28} className="text-white" />
                        <input 
                          ref={avatarInputRef}
                          type="file" 
                          accept="image/jpeg,image/png,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await uploadAvatar(file, user.id, { bucket: 'fotos-usuario', tenantId: user.tenantId, maxSizeMB: 3 });
                                await handleAvatarUpload(url);
                                resetAvatarUpload();
                              } catch (error) {
                                console.error('Erro no upload:', error);
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    /* Avatar Padrão com Inicial */
                    <label className="relative w-28 h-28 rounded-3xl border-4 border-slate-50 shadow-lg flex items-center justify-center font-black text-5xl text-white cursor-pointer transition-transform group-hover:scale-105" style={{ backgroundColor: primaryColor }}>
                      {user.nome[0]?.toUpperCase()}
                      {/* Overlay Hover com Câmera */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                        <Camera size={28} className="text-white" />
                      </div>
                      <input 
                        ref={avatarInputRef}
                        type="file" 
                        accept="image/jpeg,image/png,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const url = await uploadAvatar(file, user.id, { bucket: 'fotos-usuario', tenantId: user.tenantId, maxSizeMB: 3 });
                              await handleAvatarUpload(url);
                              resetAvatarUpload();
                            } catch (error) {
                              console.error('Erro no upload:', error);
                            }
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Status Feedback - Discreto e Abaixo */}
                <div className="text-center text-xs h-6 flex items-center justify-center">
                  {avatarLoading && (
                    <div className="flex items-center gap-1 text-blue-600 font-semibold">
                      <div className="animate-spin rounded-full h-3 w-3 border border-blue-600 border-t-transparent"></div>
                      <span>{avatarProgress}%</span>
                    </div>
                  )}
                  {avatarUrl && !avatarError && !avatarLoading && (
                    <div className="flex items-center gap-1 text-green-600 font-semibold">
                      <CheckCircle2 size={14} />
                      <span>Enviado</span>
                    </div>
                  )}
                  {avatarError && (
                    <div className="flex items-center gap-1 text-red-600 font-semibold">
                      <AlertCircle size={14} />
                      <span>Erro</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter truncate max-w-md">{user.nome}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-500">{user.role}</span>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{user.cargo || 'Cargo não definido'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                <input type="text" value={user.nome} onChange={e => onUpdateUser({...user, nome: e.target.value})} className="w-full bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail Corporativo</label>
                <input type="email" value={user.email} readOnly className="w-full bg-slate-100 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 cursor-not-allowed" />
              </div>
              
              <div className="md:col-span-2 pt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-3">Assinatura Digital (PNG Transparente)</label>
                <div 
                  onClick={() => sigInputRef.current?.click()}
                  className="w-full h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all relative group overflow-hidden hover:border-blue-300"
                >
                  {user.signatureUrl ? (
                    <img src={user.signatureUrl} className="max-h-[80%] object-contain block" alt="Assinatura" />
                  ) : (
                    <div className="flex flex-col items-center">
                       <PenTool size={28} className="text-slate-300 mb-1" />
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clique para upload</p>
                    </div>
                  )}
                  <input ref={sigInputRef} type="file" accept="image/*" onChange={e => handleFileUpload(e, 'signature')} className="hidden" />
                </div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-50 flex justify-end">
               <button className="px-8 py-3 rounded-xl text-white font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:brightness-110" style={{ backgroundColor: primaryColor }}>Salvar Alterações</button>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'empresa' && isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
              <Building size={16} style={{ color: primaryColor }} /> Identidade Visual do Cliente
            </h3>
            
            <div className="flex flex-col md:flex-row gap-8">
               <div className="shrink-0 space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Logo da Empresa</label>
                  
                  {/* Preview do Logo Atual */}
                  {tenant.logoUrl && (
                    <div className="mb-4 relative group mx-auto w-40">
                      <img 
                        src={tenant.logoUrl} 
                        alt="Logo atual"
                        className="w-40 h-40 object-cover rounded-[32px] border border-slate-200 cursor-pointer"
                        onClick={() => handlePreviewImage(tenant.logoUrl!)}
                      />
                      <button
                        onClick={() => handlePreviewImage(tenant.logoUrl!)}
                        className="absolute top-2 right-2 p-2 bg-blue-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all"
                        title="Visualizar logo"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  )}

                  {/* ImageUploader Component */}
                  <ImageUploader
                    entityId={tenant.id}
                    tenantId={tenant.id}
                    bucket="fotos-recurso"
                    label="Upload de Logo (WebP)"
                    onUploadSuccess={handleLogoUpload}
                    maxSizeMB={5}
                  />
               </div>

               <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Razão Social</label>
                    <input type="text" value={tenant.nome} onChange={e => onUpdateTenant({...tenant, nome: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">CNPJ</label>
                    <input type="text" value={tenant.cnpj} onChange={e => onUpdateTenant({...tenant, cnpj: e.target.value})} placeholder="00.000.000/0000-00" className="w-full bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div className="pt-2">
                     <div className="p-5 bg-slate-900 rounded-2xl text-white flex items-center justify-between shadow-xl">
                        <div>
                           <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-0.5">Capacidade Total</p>
                           <h4 className="text-sm font-black uppercase tracking-tighter">{effectiveUserLimit} Usuários Permitidos</h4>
                        </div>
                        <Activity size={20} style={{ color: primaryColor }} />
                     </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'equipe' && isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 pointer-events-none"><Users size={100} /></div>
              <div className="flex-1 space-y-4 relative z-10 w-full">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Utilização de Licença</p>
                  {/* EXIBIÇÃO CORRIGIDA: Usa o limite efetivo de 50 */}
                  <p className="text-xs font-black uppercase tracking-tighter">{allUsers.length} / {effectiveUserLimit} USUÁRIOS</p>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full rounded-full shadow-lg" 
                    style={{ width: `${(allUsers.length / effectiveUserLimit) * 100}%`, backgroundColor: primaryColor }}
                  ></div>
                </div>
              </div>
              <button 
                onClick={() => setShowInviteModal(true)}
                className="w-full md:w-auto px-8 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 relative z-10 text-white hover:brightness-110"
                style={{ backgroundColor: primaryColor }}
              >
                <Plus size={16} /> Convidar Usuário
              </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-xl overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-4">Membro da Equipe</th>
                    <th className="px-8 py-4">Acesso (Role)</th>
                    <th className="px-8 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-[10px] uppercase overflow-hidden shrink-0 aspect-square border border-white/10 shadow-sm">
                             {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full object-cover block" /> : u.nome[0]}
                          </div>
                          <div className="min-w-0">
                             <p className="text-xs font-black text-slate-700 uppercase tracking-tight truncate">{u.nome}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                         <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-500">
                           {u.role}
                         </span>
                      </td>
                      <td className="px-8 py-4 text-right">
                         <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"><Edit2 size={16} /></button>
                           <button onClick={() => onUpdateUsers(allUsers.filter(x => x.id !== u.id))} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-slate-100 transition-all"><Trash2 size={16} /></button>
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'seguranca' && isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
              <Shield size={18} className="text-amber-500" /> Segurança da Conta
            </h3>

            <div className="space-y-8">
              {/* Card de Status de Segurança */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">Última Alteração de Senha</p>
                      <p className="text-sm font-black text-emerald-800">
                        {user.lastPasswordChange 
                          ? (() => {
                              const date = new Date(user.lastPasswordChange);
                              const formatted = new Intl.DateTimeFormat('pt-BR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              }).format(date);
                              // Formato: DD/MM/YYYY às HH:mm
                              const [datePart, timePart] = formatted.split(' ');
                              return `${datePart} às ${timePart}`;
                            })()
                          : 'Nunca alterada'
                        }
                      </p>
                    </div>
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  </div>
                </div>

                <div className="p-6 bg-blue-50 border border-blue-100 rounded-2xl">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Conta Ativa</p>
                      <p className="text-sm font-black text-blue-800">
                        {user.ativo ? '✅ Ativa' : '🔒 Desativada'}
                      </p>
                    </div>
                    <CheckCircle2 size={20} className="text-blue-600" />
                  </div>
                </div>

                <div className="p-6 bg-purple-50 border border-purple-100 rounded-2xl">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[9px] font-black text-purple-600 uppercase tracking-widest mb-2">Nível de Acesso</p>
                      <p className="text-sm font-black text-purple-800 capitalize">
                        {user.role.toLowerCase()}
                      </p>
                    </div>
                    <Lock size={20} className="text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Divisor */}
              <hr className="border-slate-100" />

              {/* Seção de Troca de Senha */}
              <div>
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3">
                  <Lock size={16} className="text-amber-500" /> Alterar Senha
                </h4>

                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl">
                  <p className="text-xs font-bold text-slate-600 mb-6 leading-relaxed">
                    Por segurança, recomendamos alterar sua senha periodicamente. Escolha uma senha forte com números, letras maiúsculas/minúsculas e símbolos.
                  </p>

                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="flex items-center gap-2 px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 hover:brightness-110"
                  >
                    <Lock size={16} /> Alterar Senha Agora
                  </button>
                </div>
              </div>

              {/* Recomendações de Segurança */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-3">
                  <Activity size={16} className="text-blue-500" /> Dicas de Segurança
                </h4>
                <ul className="space-y-3 text-xs font-bold text-slate-600">
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-black">✓</span> Nunca compartilhe sua senha com colegas ou suporte
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-black">✓</span> Use uma senha única e diferente de outras plataformas
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-black">✓</span> Altere sua senha a cada 90 dias
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-black">✓</span> Não use informações pessoais (datas, nomes, etc)
                  </li>
                  <li className="flex gap-3">
                    <span className="text-blue-500 font-black">✓</span> Realize logout ao usar computadores compartilhados
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal de Troca de Senha */}
            <AnimatePresence>
              {showPasswordModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => !passwordLoading && setShowPasswordModal(false)}
                  className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
                >
                  <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
                  >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-6 flex items-center justify-between">
                      <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2">
                        <Lock size={18} /> Alterar Senha
                      </h3>
                      <button
                        onClick={() => setShowPasswordModal(false)}
                        className="text-white/80 hover:text-white transition-colors"
                        disabled={passwordLoading}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Conteúdo */}
                    <div className="p-8 space-y-6">
                      {/* Erro */}
                      {passwordError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                          <p className="text-xs font-bold text-red-800">{passwordError}</p>
                        </div>
                      )}

                      {/* Senha Atual */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1 flex items-center gap-2">
                          <Lock size={14} /> Senha Atual
                        </label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Digite sua senha atual"
                          disabled={passwordLoading}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-100 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      {/* Divider */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200"></div>
                        </div>
                        <div className="relative flex justify-center text-xs">
                          <span className="px-2 bg-white text-slate-500 font-black">NOVA SENHA</span>
                        </div>
                      </div>

                      {/* Nova Senha */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1 flex items-center gap-2">
                          <Lock size={14} /> Nova Senha
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mín. 6 caracteres"
                          disabled={passwordLoading}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-100 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>

                      {/* Confirmar Senha */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-1 flex items-center gap-2">
                          <Check size={14} /> Confirmar Nova Senha
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repita a nova senha"
                          disabled={passwordLoading}
                          className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-100 transition-all disabled:bg-slate-100 disabled:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 border-t border-slate-100 flex items-center gap-3 justify-end">
                      <button
                        onClick={() => setShowPasswordModal(false)}
                        disabled={passwordLoading}
                        className="px-6 py-2.5 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:text-slate-800 transition-colors disabled:text-slate-400"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleChangePassword}
                        disabled={passwordLoading}
                        className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {passwordLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Processando...
                          </>
                        ) : (
                          <>
                            <Check size={16} /> Confirmar Alteração
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* SaaS Branding moved to Master Admin Config. White-label menu */}
      </div>

      {/* JANELA DE MODAL TRIPARTITE (CONVITE) - ESTRUTURA 500PX ALTURA */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[500px]">
            
            {/* 1. HEADER FIXO */}
            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Convidar Novo Usuário</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-80">Gestão de credenciais de acesso</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors hover:text-slate-600"><X size={20} /></button>
            </div>
            
            {/* 2. BODY COM SCROLL INTERNO E ALTA DENSIDADE */}
            <form id="invite-form-final" onSubmit={handleInviteUser} className="px-8 py-6 overflow-y-auto flex-1 scrollbar-hide bg-slate-50/20">
               <div className="grid grid-cols-2 gap-4">
                 
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                    <input name="nome" required type="text" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ex: Engenheiro Roberto Almeida" />
                 </div>

                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail Corporativo</label>
                    <input name="email" required type="email" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="usuario@empresa.com.br" />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nível de Acesso (Role)</label>
                    <select name="role" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none cursor-pointer appearance-none focus:ring-2 focus:ring-blue-100">
                       {rolesToInvite.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cargo / Função</label>
                    <input name="cargo" type="text" className="w-full bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition-all" placeholder="Ex: Eng. de Produção" />
                 </div>

                 <div className="col-span-2 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 mt-2">
                    <Shield size={16} className="text-blue-500 mt-0.5 shrink-0" />
                    <p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase">
                      As instruções de login serão enviadas ao e-mail informado.
                    </p>
                 </div>
               </div>
            </form>

            {/* 3. FOOTER FIXO */}
            <div className="px-8 py-5 border-t border-slate-100 shrink-0 bg-white flex items-center justify-between gap-4">
               <button 
                type="button" 
                onClick={() => setShowInviteModal(false)}
                disabled={inviteLoading}
                className="text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Cancelar
               </button>
               <button 
                form="invite-form-final"
                type="submit"
                disabled={inviteLoading}
                className="flex-1 text-white py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all active:scale-95 hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
               >
                 {inviteLoading ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                     Enviando...
                   </>
                 ) : (
                   'Enviar Convite'
                 )}
               </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Preview Modal */}
      <ImagePreviewModal
        isOpen={previewImageOpen}
        images={selectedPreviewUrl ? [selectedPreviewUrl] : []}
        title="Preview da Imagem"
        onClose={() => setPreviewImageOpen(false)}
      />
    </div>
  );
};

export default ProfileView;