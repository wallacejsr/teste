
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { Tenant } from '../types';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTenant: Tenant;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, activeTenant }) => {
  const WHATSAPP_NUMBER = "5511999999999"; // Substituir pelo número real
  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=Olá, sou da empresa ${activeTenant.nome} e tenho interesse no upgrade para o Plano PRO na plataforma Projex.`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white/90 backdrop-blur-xl w-full max-w-lg rounded-[48px] shadow-2xl border border-white overflow-hidden flex flex-col"
          >
            <div className="p-10 relative">
              <button 
                onClick={onClose}
                className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full text-slate-300 transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col items-center text-center mb-10">
                <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-blue-200 mb-6">
                  <Zap className="text-white" size={40} fill="currentColor" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-3">Libere todo o potencial</h2>
                <p className="text-slate-500 font-medium text-sm leading-relaxed">Sua organização está no plano Basic. Faça o upgrade para o <span className="text-blue-600 font-black">Professional</span> e desbloqueie recursos avançados.</p>
              </div>

              <div className="space-y-4 mb-10">
                {[
                  "Curva S Realizada (Integração com RDO)",
                  "Gestão Financeira Completa (EVA / CPI)",
                  "Obras e Projetos Ilimitados",
                  "Suporte Prioritário via Engenharia"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-4 bg-white/50 p-4 rounded-2xl border border-slate-50">
                    <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{item}</span>
                  </div>
                ))}
              </div>

              <a 
                href={waUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-95 group"
              >
                Falar com Consultor <MessageSquare size={18} />
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </a>
              
              <p className="text-center mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Atendimento imediato via WhatsApp</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;
