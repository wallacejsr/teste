
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, Lock, Mail, ChevronRight, Info } from 'lucide-react';
import { GlobalConfig } from '../types';

interface LoginViewProps {
  onLogin: (email: string) => void;
  globalConfig: GlobalConfig;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, globalConfig }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const primaryColor = globalConfig.primaryColor || '#3b82f6';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email);
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
              {globalConfig.softwareSubtitle || 'SaaS Engineering Suite'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
            </div>

            <button 
              type="submit"
              className="w-full py-5 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 hover:brightness-110"
              style={{ backgroundColor: primaryColor }}
            >
              Acessar Plataforma <ChevronRight size={18} />
            </button>
          </form>

          <div className="mt-10 p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10">
            <div className="flex gap-4">
              <Info className="text-blue-400 shrink-0" size={18} />
              <div>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Credenciais de Teste</p>
                <div className="space-y-1 text-[11px] text-slate-500 font-medium">
                  <p><span className="text-blue-300 font-black">MASTER:</span> master@plataforma.com</p>
                  <p><span className="text-slate-400 font-black">ADMIN:</span> admin@empresa.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginView;
