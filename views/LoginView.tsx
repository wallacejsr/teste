
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, Mail, ChevronRight, Info, UserPlus, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { GlobalConfig } from '../types';
import { authService } from '../services/authService';

interface LoginViewProps {
  onLogin: (email: string, password: string) => void;
  globalConfig: GlobalConfig;
}

type ViewMode = 'login' | 'signup' | 'reset';

const LoginView: React.FC<LoginViewProps> = ({ onLogin, globalConfig }) => {
  const [mode, setMode] = useState<ViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const primaryColor = globalConfig.primaryColor || '#3b82f6';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.login({ email, password });

      if (result.success && result.user) {
        setSuccess('Login realizado com sucesso!');
        setTimeout(() => {
          onLogin(email, password);
        }, 500);
      } else {
        setError(result.error || 'Falha no login');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password.trim() || !nome.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não correspondem');
      return;
    }

    const passwordCheck = authService.isStrongPassword(password);
    if (!passwordCheck.valid) {
      setError(passwordCheck.error || 'Senha fraca');
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
        setSuccess('Conta criada! Verifique seu email para confirmar.');
        setTimeout(() => {
          setMode('login');
        }, 2000);
      } else {
        setError(result.error || 'Falha ao criar conta');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Informe seu email');
      return;
    }

    if (!authService.isValidEmail(email)) {
      setError('Email inválido');
      return;
    }

    setLoading(true);

    try {
      const result = await authService.requestPasswordReset({ email });

      if (result.success) {
        setSuccess('Email de recuperação enviado! Verifique sua caixa de entrada.');
        setTimeout(() => {
          setMode('login');
        }, 3000);
      } else {
        setError(result.error || 'Falha ao enviar email');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao solicitar reset');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'login') {
      handleLogin(e);
    } else if (mode === 'signup') {
      handleSignup(e);
    } else {
      handlePasswordReset(e);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden font-['Inter']">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 blur-[150px] rounded-full"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[150px] rounded-full"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-md px-8 relative z-10"
      >
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[48px] shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div 
              className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl mb-6"
              style={{ backgroundColor: primaryColor }}
            >
              {globalConfig.systemLogoUrl ? (
                <img src={globalConfig.systemLogoUrl} className="w-12 h-12 object-contain" alt="Logo" />
              ) : (
                <Zap className="text-white" size={40} strokeWidth={2.5} />
              )}
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">
              {globalConfig.softwareName}
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">
              {mode === 'login' ? 'Autenticação' : mode === 'signup' ? 'Nova Conta' : 'Recuperar Senha'}
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3"
            >
              <AlertCircle className="text-red-400" size={18} />
              <p className="text-red-400 text-sm font-medium">{error}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3"
            >
              <CheckCircle className="text-green-400" size={18} />
              <p className="text-green-400 text-sm font-medium">{success}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome (apenas signup) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome Completo</label>
                <div className="relative group">
                  <UserPlus className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input 
                    type="text" 
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                    className="w-full bg-white/5 border border-white/10 px-12 py-4 rounded-2xl text-white text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">E-mail corporativo</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full bg-white/5 border border-white/10 px-12 py-4 rounded-2xl text-white text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Senha (login e signup) */}
            {mode !== 'reset' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Senha de acesso</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/5 border border-white/10 px-12 py-4 rounded-2xl text-white text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all placeholder:text-slate-600"
                  />
                </div>
                {mode === 'signup' && (
                  <p className="text-[10px] text-slate-500 px-1 mt-1">Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número</p>
                )}
              </div>
            )}

            {/* Confirmar Senha (apenas signup) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Confirmar Senha</label>
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={18} />
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-white/5 border border-white/10 px-12 py-4 rounded-2xl text-white text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? (
                <>Processando...</>
              ) : mode === 'login' ? (
                <>Acessar Plataforma <ChevronRight size={18} /></>
              ) : mode === 'signup' ? (
                <>Criar Conta <UserPlus size={18} /></>
              ) : (
                <>Enviar Email <Key size={18} /></>
              )}
            </button>
          </form>

          {/* Mode Switch Links */}
          <div className="mt-8 space-y-3">
            {mode === 'login' && (
              <>
                <button
                  onClick={() => setMode('signup')}
                  className="w-full text-center text-sm text-slate-400 hover:text-blue-400 transition-colors font-medium"
                >
                  Não tem conta? <span className="font-black">Criar nova conta</span>
                </button>
                <button
                  onClick={() => setMode('reset')}
                  className="w-full text-center text-sm text-slate-400 hover:text-blue-400 transition-colors font-medium"
                >
                  Esqueceu a senha? <span className="font-black">Recuperar acesso</span>
                </button>
              </>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <button
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className="w-full text-center text-sm text-slate-400 hover:text-blue-400 transition-colors font-medium"
              >
                Já tem conta? <span className="font-black">Fazer login</span>
              </button>
            )}
          </div>

          {/* Dev Mode Info */}
          {mode === 'login' && (
            <div className="mt-10 p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10">
              <div className="flex gap-4">
                <Info className="text-blue-400 shrink-0" size={18} />
                <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Modo Desenvolvimento</p>
                  <div className="space-y-1 text-[11px] text-slate-500 font-medium">
                    <p className="text-blue-300">Use email e senha configurados no Supabase</p>
                    <p className="text-slate-400">Ou crie uma nova conta</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginView;
