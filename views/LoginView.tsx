
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, Mail, ChevronRight, UserPlus, Key, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { GlobalConfig, User } from '../types';
import { authService } from '../services/authService';
import { dataSyncService } from '../services/dataService';

interface LoginViewProps {
  onLogin: (email: string, password: string) => void;
  globalConfig: GlobalConfig;
  imagePreloaded?: boolean; // 🖼️ Flag indicando que imagem já foi precarregada
  allUsers?: User[]; // 👥 Lista de usuários para validar token
  onUpdateUsers?: (users: User[]) => void; // ✏️ Callback para atualizar usuários
}

type ViewMode = 'login' | 'signup' | 'reset' | 'invite'; // ➕ Novo modo 'invite'

const LoginView: React.FC<LoginViewProps> = ({ onLogin, globalConfig, imagePreloaded = false, allUsers = [], onUpdateUsers }) => {
  const [mode, setMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // ✅ Usar imagePreloaded do App.tsx ao invés de preload interno
  const [imageReady, setImageReady] = useState(imagePreloaded);
  // 🔑 Estados para token de convite
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitedUser, setInvitedUser] = useState<User | null>(null);
  const primaryColor = globalConfig.primaryColor || '#3b82f6';
  
  // ✨ Sincronizar imageReady com prop imagePreloaded
  useEffect(() => {
    if (imagePreloaded) {
      setImageReady(true);
    }
  }, [imagePreloaded]);

  // 🔑 Detectar token de convite na URL (?invite=xxx)
  useEffect(() => {
    // 🔒 HOTFIX: Limpeza preventiva de sessão para evitar conflitos
    const cleanupSession = async () => {
      try {
        await authService.logout();
        console.log('[LoginView] Sessão limpa preventivamente para convite');
      } catch (error) {
        console.warn('[LoginView] Erro ao limpar sessão:', error);
      }
    };

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('invite');
    
    if (token) {
      // Limpar sessão antes de processar convite
      cleanupSession();
      
      if (allUsers && allUsers.length > 0) {
        // Buscar usuário pelo token
        const user = allUsers.find(u => u.inviteToken === token);
        
        if (user) {
          // Validar expiração do token
          const now = new Date();
          const expiry = user.inviteTokenExpiry ? new Date(user.inviteTokenExpiry) : null;
          
          if (expiry && now > expiry) {
            toast.error('❌ Este convite expirou. Solicite um novo convite ao administrador.');
            // Limpar parâmetro da URL
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
          
          if (user.hasCompletedOnboarding) {
            toast.error('ℹ️ Este convite já foi utilizado. Faça login normalmente.');
            // Limpar parâmetro da URL
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
          
          // Token válido, mudar para modo invite
          setInviteToken(token);
          setInvitedUser(user);
          setEmail(user.email);
          setNome(user.nome);
          setMode('invite');
          toast.success(`👋 Bem-vindo, ${user.nome}! Configure sua senha para acessar o sistema.`);
        } else {
          toast.error('❌ Este convite é inválido ou já foi utilizado. Entre em contato com o administrador.');
          // Limpar parâmetro da URL
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [allUsers]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.login({ email, password });

      if (result.success && result.user) {
        toast.success('Login realizado com sucesso!');
        setTimeout(() => {
          onLogin(email, password);
        }, 500);
      } else {
        toast.error(result.error || 'Falha ao conectar. Verifique suas credenciais.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim() || !nome.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não correspondem');
      return;
    }

    const passwordCheck = authService.isStrongPassword(password);
    if (!passwordCheck.valid) {
      toast.error(passwordCheck.error || 'Senha fraca. Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número');
      return;
    }

    setLoading(true);

    try {
      // Nota: Em produção, o tenantId seria selecionado ou criado
      // Por ora, usamos um tenant de exemplo
      const result = await authService.signup({
        email,
        password,
        nome,
        tenantId: '550e8400-e29b-41d4-a716-446655440000', // Tenant de exemplo
      });

      if (result.success) {
        toast.success('Conta criada! Verifique seu email para confirmar.');
        setTimeout(() => {
          setMode('login');
          setEmail('');
          setPassword('');
          setConfirmPassword('');
          setNome('');
        }, 2000);
      } else {
        toast.error(result.error || 'Não foi possível criar a conta. Tente novamente.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      toast.error('Informe seu email');
      return;
    }

    if (!authService.isValidEmail(email)) {
      toast.error('Email inválido. Verifique o formato.');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.requestPasswordReset({ email });

      if (result.success) {
        toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
        setTimeout(() => {
          setMode('login');
          setEmail('');
        }, 3000);
      } else {
        toast.error(result.error || 'Não foi possível enviar o email. Tente novamente.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar reset. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // 🆕 Handler para completar onboarding (primeiro acesso via convite)
  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!invitedUser || !inviteToken) {
      toast.error('Token de convite inválido.');
      return;
    }

    if (!password.trim()) {
      toast.error('Preencha a senha');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não correspondem');
      return;
    }

    const passwordCheck = authService.isStrongPassword(password);
    if (!passwordCheck.valid) {
      toast.error(passwordCheck.error || 'Senha fraca. Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número');
      return;
    }

    setLoading(true);

    try {
      // Atualizar usuário: remover token, marcar onboarding completo, criar senha
      const updatedUser: User = {
        ...invitedUser,
        password, // Em produção, deve ser hash via backend
        hasCompletedOnboarding: true,
        inviteToken: undefined,
        inviteTokenExpiry: undefined,
        lastPasswordChange: new Date().toISOString(),
      };

      // Atualizar no estado
      if (onUpdateUsers && allUsers) {
        const updatedUsers = allUsers.map(u => 
          u.id === updatedUser.id ? updatedUser : u
        );
        onUpdateUsers(updatedUsers);

        // Persistir no banco
        await dataSyncService.syncUsers(updatedUsers, invitedUser.tenantId);
      }

      toast.success('✅ Senha configurada com sucesso! Você será redirecionado...');
      
      // Fazer login automático
      setTimeout(() => {
        onLogin(updatedUser.email, password);
      }, 1500);

    } catch (error: any) {
      console.error('[LoginView] Erro ao completar onboarding:', error);
      toast.error('❌ Erro ao configurar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'login') {
      handleLogin(e);
    } else if (mode === 'signup') {
      handleSignup(e);
    } else if (mode === 'invite') {
      handleCompleteOnboarding(e);
    } else {
      handlePasswordReset(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="h-screen w-full flex bg-white font-['Inter'] overflow-hidden"
    >
      {/* LEFT SIDE - Visual (60%) */}
      <div className="hidden lg:flex w-3/5 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* 🖼️ IMAGEM DE FUNDO: Já precarregada pelo App.tsx, fade-in suave */}
        <motion.img 
          src={globalConfig.loginBackgroundUrl || "https://images.unsplash.com/photo-1589492477543-e4f4c8ee3a7d?w=1200&h=1600&fit=crop&q=80"} 
          alt="Background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Overlay escuro elegante */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-slate-900/20"></div>

        {/* 📝 CONTEÚDO VISUAL: Fade-in sincronizado com imagem */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute inset-0 flex flex-col justify-center items-start pl-16 text-white z-10"
        >
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <h2 className="text-5xl font-black mb-6 max-w-lg leading-tight">
              {globalConfig.loginHeading ? (
                <span dangerouslySetInnerHTML={{ __html: globalConfig.loginHeading.replace('conecta', '<span class="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">conecta</span>') }} />
              ) : (
                <>Engenharia que <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">conecta</span> pessoas</>
              )}
            </h2>
            <p className="text-xl text-slate-300 max-w-md font-light leading-relaxed">
              {globalConfig.loginDescription || 'Planeje, colabore e execute seus projetos com a precisão de uma obra bem coordenada. Tecnologia e engenharia em perfeita sinergia.'}
            </p>
          </motion.div>

          {/* Decoração de Rodapé */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute bottom-12 left-16"
          >
            <div className="flex items-center gap-4 text-sm text-slate-400">
              <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-transparent"></div>
              <span className="uppercase tracking-widest font-bold text-xs">Seguro e Confiável</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* RIGHT SIDE - Formulário (40%) */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="flex-1 lg:w-2/5 flex items-center justify-center px-8 lg:px-12 bg-white lg:bg-slate-50"
      >
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="flex flex-col items-center mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-6"
              style={{ backgroundColor: primaryColor }}
            >
              {globalConfig.systemLogoUrl ? (
                <img src={globalConfig.systemLogoUrl} className="w-10 h-10 object-contain" alt="Logo" />
              ) : (
                <Zap className="text-white" size={32} strokeWidth={2.5} />
              )}
            </motion.div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
              {globalConfig.softwareName}
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.15em]">
              {mode === 'login' ? 'Acesso à Plataforma' : 
               mode === 'signup' ? 'Criar Nova Conta' : 
               mode === 'invite' ? '🎉 Configure Seu Acesso' : 
               'Recuperar Acesso'}
            </p>
          </div>

          {/* 🆕 Banner de Convite (modo invite) */}
          {mode === 'invite' && invitedUser && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-2xl p-5 mb-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                  <ShieldCheck className="text-white" size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-green-900 mb-1">Bem-vindo, {invitedUser.nome}!</h3>
                  <p className="text-xs text-green-700 leading-relaxed">
                    Você foi convidado para <strong>{invitedUser.role}</strong>. Configure uma senha segura para acessar o sistema.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome (signup ou invite - readonly) */}
            {(mode === 'signup' || mode === 'invite') && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-2"
              >
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Nome Completo</label>
                <div className="relative group">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="text" 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="João da Silva"
                    required
                    readOnly={mode === 'invite'}
                    className="w-full bg-white border border-slate-200 px-12 py-3 rounded-xl text-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 hover:border-slate-300 read-only:bg-slate-50 read-only:cursor-not-allowed"
                  />
                </div>
              </motion.div>
            )}

            {/* Email (todos os modos, readonly em invite) */}
            {(mode === 'login' || mode === 'signup' || mode === 'reset' || mode === 'invite') && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (mode === 'signup' || mode === 'invite') ? 0.1 : 0 }}
              className="space-y-2"
            >
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">E-mail</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                  readOnly={mode === 'invite'}
                  className="w-full bg-white border border-slate-200 px-12 py-3 rounded-xl text-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 hover:border-slate-300 read-only:bg-slate-50 read-only:cursor-not-allowed"
                />
              </div>
            </motion.div>
            )}

            {/* Senha (login, signup, invite) */}
            {(mode === 'login' || mode === 'signup' || mode === 'invite') && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: (mode === 'signup' || mode === 'invite') ? 0.2 : 0.1 }}
                className="space-y-2"
              >
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                  {mode === 'invite' ? 'Criar Senha' : 'Senha'}
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'invite' ? 'new-password' : 'current-password'}
                    required
                    className="w-full bg-white border border-slate-200 px-12 py-3 rounded-xl text-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 hover:border-slate-300"
                  />
                </div>
                {(mode === 'signup' || mode === 'invite') && (
                  <p className="text-xs text-slate-500 mt-2">Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número</p>
                )}
              </motion.div>
            )}

            {/* Confirmar Senha (signup e invite) */}
            {(mode === 'signup' || mode === 'invite') && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="space-y-2"
              >
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Confirmar Senha</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    className="w-full bg-white border border-slate-200 px-12 py-3 rounded-xl text-slate-900 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400 hover:border-slate-300"
                  />
                </div>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (mode === 'signup' || mode === 'invite') ? 0.4 : mode === 'reset' ? 0.2 : 0.2 }}
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm uppercase tracking-wide shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 hover:shadow-2xl hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 mt-6"
              style={{ backgroundColor: primaryColor }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processando...
                </>
              ) : mode === 'login' ? (
                <>Acessar Plataforma <ChevronRight size={16} /></>
              ) : mode === 'signup' ? (
                <>Criar Conta <UserPlus size={16} /></>
              ) : mode === 'invite' ? (
                <>Configurar Senha e Entrar <ShieldCheck size={16} /></>
              ) : (
                <>Enviar Email <Key size={16} /></>
              )}
            </motion.button>
          </form>

          {/* Mode Switch Links */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-8 space-y-3 text-center"
          >
            {mode === 'login' && (
              <>
                <button
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setSuccess('');
                  }}
                  className="block w-full text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                >
                  Não tem conta? <span className="font-bold">Criar nova conta</span>
                </button>
                <button
                  onClick={() => {
                    setMode('reset');
                    setError('');
                    setSuccess('');
                  }}
                  className="block w-full text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
                >
                  Esqueceu a senha? <span className="font-bold">Recuperar acesso</span>
                </button>
              </>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setNome('');
                }}
                className="block w-full text-sm text-slate-600 hover:text-blue-600 transition-colors font-medium"
              >
                Já tem conta? <span className="font-bold">Fazer login</span>
              </button>
            )}
          </motion.div>

          {/* Footer */}
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-xs text-slate-500 text-center mt-10 leading-relaxed"
          >
            Ao acessar, você concorda com nossos Termos de Serviço e Política de Privacidade.
          </motion.p>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LoginView;
