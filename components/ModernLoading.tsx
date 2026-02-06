import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { GlobalConfig } from '../types';

interface ModernLoadingProps {
  globalConfig?: GlobalConfig;
  showError?: boolean; // Deprecated: não usado mais
}

export const ModernLoading: React.FC<ModernLoadingProps> = ({ globalConfig, showError = false }) => {
  const logoUrl = globalConfig?.systemLogoUrl;
  const primaryColor = globalConfig?.primaryColor || '#3b82f6';
  // 🎨 Usar nome do config OU "Carregando" se estiver vazio (primeira inicialização)
  const displayName = globalConfig?.softwareName && globalConfig.softwareName.trim() !== '' 
    ? globalConfig.softwareName 
    : 'Carregando';  
  const [showLoadingMessage, setShowLoadingMessage] = React.useState(false);
  
  // ⏱️ Mostrar mensagem de aguarde após 10 segundos (carregamento lento)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoadingMessage(true);
    }, 10000); // 10 segundos
    
    return () => clearTimeout(timer);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[9999]"
    >
      {/* Efeito de glow ao fundo */}
      <div 
        className="absolute inset-0 opacity-20 blur-[100px]"
        style={{ backgroundColor: primaryColor }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Container com spinner circular */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Spinner circular externo */}
          <svg 
            className="absolute inset-0 w-full h-full animate-spin" 
            style={{ animationDuration: '3s' }}
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={primaryColor}
              strokeWidth="2"
              strokeDasharray="141 283"
              strokeLinecap="round"
            />
          </svg>

          {/* Logo com pulso suave */}
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="relative w-24 h-24 bg-slate-950 rounded-full flex items-center justify-center shadow-xl"
            style={{ boxShadow: `0 0 40px ${primaryColor}40` }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Sistema Logo"
                className="w-20 h-20 object-contain"
              />
            ) : (
              <Zap
                size={40}
                style={{ color: primaryColor }}
                strokeWidth={2}
              />
            )}
          </motion.div>
        </div>

        {/* Texto de carregamento */}
        <div className="text-center space-y-3">
          <motion.h1
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="text-xl font-bold text-white tracking-wide"
          >
            {displayName}
          </motion.h1>
          <motion.p
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.2,
            }}
            className="text-sm text-slate-400 font-medium"
          >
            Preparando seu ambiente...
          </motion.p>
          
          {/* � Mensagem de aguarde após 10 segundos */}
          {showLoadingMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg max-w-md"
            >
              <p className="text-blue-400 text-sm font-medium text-center mb-2">
                ⏳ Aguarde um momento
              </p>
              <p className="text-slate-400 text-xs text-center">
                Estamos carregando todas as configurações do sistema. Isso pode levar alguns instantes...
              </p>
            </motion.div>
          )}
        </div>

        {/* Dots de progresso */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: index * 0.2,
              }}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: primaryColor }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ModernLoading;
