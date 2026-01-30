import React from 'react';
import { Building, ArrowRight } from 'lucide-react';

interface Action {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyProjectStateProps {
  title?: string;
  message?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
  icon?: React.ComponentType<any>;
  onNavigateToDashboard?: () => void;
}

export const EmptyProjectState: React.FC<EmptyProjectStateProps> = ({
  title = 'Nenhuma Obra Selecionada',
  message = 'Selecione uma obra no menu Projetos para visualizar os dados.',
  primaryAction,
  secondaryAction,
  icon: Icon = Building,
  onNavigateToDashboard
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] bg-gradient-to-b from-slate-50 to-white rounded-[40px] border border-slate-100 shadow-lg p-8">
      {/* Ícone */}
      <div className="mb-6 p-6 bg-slate-100 rounded-full">
        <Icon size={48} className="text-slate-400" />
      </div>

      {/* Título */}
      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3 text-center">
        {title}
      </h2>

      {/* Mensagem */}
      <p className="text-sm text-slate-500 text-center max-w-md mb-8">
        {message}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {primaryAction && primaryAction.label === 'Ir para Projetos' ? (
          <button
            onClick={onNavigateToDashboard || primaryAction.onClick || (() => window.location.hash = '#dashboard')}
            className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 hover:brightness-110 text-white flex items-center gap-2"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {primaryAction.label}
            <ArrowRight size={14} />
          </button>
        ) : primaryAction ? (
          <button
            onClick={primaryAction.onClick}
            className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 hover:brightness-110 text-white flex items-center gap-2"
            style={{ backgroundColor: '#3b82f6' }}
          >
            {primaryAction.label}
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={onNavigateToDashboard || (() => window.location.hash = '#dashboard')}
            className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95 hover:brightness-110 text-white flex items-center gap-2"
            style={{ backgroundColor: '#3b82f6' }}
          >
            Ir para Projetos
            <ArrowRight size={14} />
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 border-slate-300 text-slate-700 transition-all active:scale-95 hover:bg-slate-50"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {/* Dica */}
      <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-8 text-center">
        💡 Dica: Selecione uma obra para começar a trabalhar
      </p>
    </div>
  );
};

export default EmptyProjectState;
