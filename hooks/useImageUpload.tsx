import { useState, useCallback } from 'react';
import { uploadImage, deleteImage, ImageUploadOptions } from '../services/imageService';

/**
 * PILAR 8: Hook para gerenciar upload de imagens
 * Wrapper React com loading, error handling e progress tracking
 */

interface UseImageUploadState {
  loading: boolean;
  error: string | null;
  progress: number;
  imageUrl: string | null;
}

export const useImageUpload = () => {
  const [state, setState] = useState<UseImageUploadState>({
    loading: false,
    error: null,
    progress: 0,
    imageUrl: null
  });

  /**
   * Faz upload de imagem
   */
  const upload = useCallback(
    async (
      file: File,
      entityId: string,
      options: ImageUploadOptions
    ): Promise<string> => {
      setState({ loading: true, error: null, progress: 0, imageUrl: null });

      try {
        // Simular progresso (real progress seria via XMLHttpRequest)
        let simulatedProgress = 0;
        const progressInterval = setInterval(() => {
          simulatedProgress = Math.min(simulatedProgress + Math.random() * 30, 90);
          setState(prev => ({ ...prev, progress: simulatedProgress }));
        }, 200);

        const url = await uploadImage(file, entityId, options);

        clearInterval(progressInterval);
        setState({ loading: false, error: null, progress: 100, imageUrl: url });

        return url;
      } catch (err: any) {
        setState({
          loading: false,
          error: err.message || 'Erro ao fazer upload',
          progress: 0,
          imageUrl: null
        });
        throw err;
      }
    },
    []
  );

  /**
   * Deleta imagem
   */
  const remove = useCallback(
    async (filePath: string, bucket: ImageUploadOptions['bucket']) => {
      try {
        await deleteImage(filePath, bucket);
        setState({ loading: false, error: null, progress: 0, imageUrl: null });
      } catch (err: any) {
        setState(prev => ({
          ...prev,
          error: err.message || 'Erro ao deletar'
        }));
        throw err;
      }
    },
    []
  );

  /**
   * Limpa estado
   */
  const reset = useCallback(() => {
    setState({ loading: false, error: null, progress: 0, imageUrl: null });
  }, []);

  return {
    ...state,
    upload,
    remove,
    reset
  };
};
