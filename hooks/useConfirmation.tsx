import { useState, useCallback } from 'react';
import { ConfirmationType } from '../components/ConfirmationDialog';

export interface ConfirmationOptions {
  title: string;
  message: string;
  details?: string[];
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
}

export interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  isLoading: boolean;
}

export const useConfirmation = () => {
  const [state, setState] = useState<ConfirmationState>({
    isOpen: false,
    isLoading: false,
    title: '',
    message: '',
    details: [],
    type: 'danger',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar'
  });

  const [resolveCallback, setResolveCallback] = useState<((value: boolean) => void) | null>(null);

  /**
   * Abre o modal de confirmação e retorna uma Promise
   * que resolve quando o usuário confirma ou cancela
   */
  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        isLoading: false,
        title: options.title,
        message: options.message,
        details: options.details || [],
        type: options.type || 'danger',
        confirmText: options.confirmText || 'Confirmar',
        cancelText: options.cancelText || 'Cancelar'
      });
      setResolveCallback(() => resolve);
    });
  }, []);

  /**
   * Fecha o modal e resolve a Promise com false (cancelado)
   */
  const handleClose = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
    if (resolveCallback) {
      resolveCallback(false);
      setResolveCallback(null);
    }
  }, [resolveCallback]);

  /**
   * Confirma a ação e resolve a Promise com true
   */
  const handleConfirm = useCallback(() => {
    if (resolveCallback) {
      resolveCallback(true);
      setResolveCallback(null);
    }
    setState(prev => ({ ...prev, isOpen: false, isLoading: false }));
  }, [resolveCallback]);

  /**
   * Define o estado de loading (útil para operações assíncronas)
   */
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  return {
    state,
    confirm,
    handleClose,
    handleConfirm,
    setLoading
  };
};
