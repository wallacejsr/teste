/**
 * PILAR 8: IMAGE SERVICE - SUPABASE STORAGE
 * Gerencia upload, otimização e presigned URLs para fotos
 * 
 * Features:
 * - Upload para Supabase Storage
 * - Presigned URLs (acesso seguro)
 * - Otimização: WebP + resizing
 * - Cache de URLs por 1 hora
 * - Error handling robusto
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { dataSyncService } from './dataService';

export interface ImageUploadOptions {
  bucket: 'fotos-obra' | 'fotos-recurso' | 'fotos-usuario';
  tenantId: string;
  maxSizeMB?: number;
  onProgress?: (progress: number) => void;
}

interface PresignedUrlCache {
  url: string;
  expiresAt: number;
}

// Cache local de URLs presigned (1 hora TTL)
const presignedUrlCache = new Map<string, PresignedUrlCache>();

/**
 * Valida arquivo de imagem
 */
function validateImage(file: File, maxSizeMB: number = 10): string | null {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return `Tipo de arquivo inválido. Use: JPEG, PNG ou WebP`;
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Arquivo muito grande (máx ${maxSizeMB}MB, você enviou ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }

  return null;
}

/**
 * Converte imagem para WebP com compressão
 * Reduz tamanho em ~60% mantendo qualidade
 */
async function compressToWebP(file: File, quality: number = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context não disponível'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao converter para WebP'));
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona imagem mantendo aspecto
 * Cria 3 versões: original, md (600px), sm (300px)
 */
async function resizeImage(
  file: File,
  sizes: 'original' | 'original+md+sm' = 'original+md+sm'
): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        // Original
        const canvasOrig = document.createElement('canvas');
        canvasOrig.width = img.width;
        canvasOrig.height = img.height;
        const ctxOrig = canvasOrig.getContext('2d');
        if (ctxOrig) {
          ctxOrig.drawImage(img, 0, 0);
          canvasOrig.toBlob((blob) => {
            if (blob) result.set('original', blob);
          }, 'image/webp', 0.8);
        }

        // Medium (600px)
        if (sizes.includes('md')) {
          const maxWidth = 600;
          const ratio = maxWidth / img.width;
          const canvasMd = document.createElement('canvas');
          canvasMd.width = maxWidth;
          canvasMd.height = img.height * ratio;
          const ctxMd = canvasMd.getContext('2d');
          if (ctxMd) {
            ctxMd.drawImage(img, 0, 0, canvasMd.width, canvasMd.height);
            canvasMd.toBlob((blob) => {
              if (blob) result.set('md', blob);
            }, 'image/webp', 0.75);
          }
        }

        // Small (300px)
        if (sizes.includes('sm')) {
          const maxWidth = 300;
          const ratio = maxWidth / img.width;
          const canvasSm = document.createElement('canvas');
          canvasSm.width = maxWidth;
          canvasSm.height = img.height * ratio;
          const ctxSm = canvasSm.getContext('2d');
          if (ctxSm) {
            ctxSm.drawImage(img, 0, 0, canvasSm.width, canvasSm.height);
            canvasSm.toBlob((blob) => {
              if (blob) result.set('sm', blob);
            }, 'image/webp', 0.7);
          }
        }

        // Aguarda ~500ms para todos os blobs serem criados
        setTimeout(() => resolve(result), 500);
      };

      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImage(
  file: File,
  entityId: string,
  options: ImageUploadOptions
): Promise<string> {
  // 1. Validar arquivo
  const error = validateImage(file, options.maxSizeMB);
  if (error) throw new Error(error);

  try {
    const supabase = dataSyncService.getSupabaseClient();

    // 2. Comprimir para WebP
    const compressedBlob = await compressToWebP(file, 0.8);
    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^.]+$/, '.webp'),
      { type: 'image/webp' }
    );

    // 3. Determinar subfolder baseado no bucket
    let subfolder = 'outros';
    if (options.bucket === 'fotos-obra') subfolder = 'obras';
    else if (options.bucket === 'fotos-recurso') subfolder = 'recursos';
    else if (options.bucket === 'fotos-usuario') subfolder = 'usuarios';

    // 4. Gerar path com isolamento por tenant: {tenantId}/{subfolder}/{entityId}/{fileName}
    const timestamp = Date.now();
    const fileName = `${entityId}-${timestamp}.webp`;
    const filePath = `${options.tenantId}/${subfolder}/${entityId}/${fileName}`;

    // 5. Upload para Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from(options.bucket)
      .upload(filePath, compressedFile, {
        cacheControl: '3600', // Cache 1 hora
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 6. Retornar URL pública
    const { data: publicUrl } = supabase.storage
      .from(options.bucket)
      .getPublicUrl(data.path);

    return publicUrl.publicUrl;
  } catch (err: any) {
    throw new Error(`Upload falhou: ${err.message}`);
  }
}

/**
 * Gera URL presigned (acesso restrito com expiração)
 * Útil para imagens privadas ou em período de testes
 * 
 * @param filePath - Caminho completo do arquivo (ex: tenant-uuid/obras/obra-uuid/123.webp)
 * @param bucket - Nome do bucket
 * @param expirationSeconds - Segundos até expiração (padrão 3600 = 1h)
 */
export async function getPresignedUrl(
  filePath: string,
  bucket: ImageUploadOptions['bucket'],
  expirationSeconds: number = 3600
): Promise<string> {
  // 1. Verificar cache
  const cacheKey = `${bucket}/${filePath}`;
  const cached = presignedUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const supabase = dataSyncService.getSupabaseClient();

    // 2. Gerar presigned URL
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expirationSeconds);

    if (error) throw error;

    // 3. Atualizar cache
    presignedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: Date.now() + expirationSeconds * 1000 - 60000 // Refresh 1min antes
    });

    return data.signedUrl;
  } catch (err: any) {
    throw new Error(`Presigned URL falhou: ${err.message}`);
  }
}

/**
 * Deleta imagem do Supabase Storage
 */
export async function deleteImage(
  filePath: string,
  bucket: ImageUploadOptions['bucket']
): Promise<void> {
  try {
    const supabase = dataSyncService.getSupabaseClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;

    // Limpar cache
    const cacheKey = `${bucket}/${filePath}`;
    presignedUrlCache.delete(cacheKey);
  } catch (err: any) {
    throw new Error(`Delete falhou: ${err.message}`);
  }
}

/**
 * Lista todas as imagens de um bucket
 */
export async function listImages(
  bucket: ImageUploadOptions['bucket']
): Promise<string[]> {
  try {
    const supabase = dataSyncService.getSupabaseClient();

    const { data, error } = await supabase.storage
      .from(bucket)
      .list('', { limit: 100 });

    if (error) throw error;

    return data.map(file => file.name);
  } catch (err: any) {
    throw new Error(`List falhou: ${err.message}`);
  }
}

/**
 * Hook para limpeza de cache (chamar ao desmontar componente)
 */
export function clearImageCache(): void {
  presignedUrlCache.clear();
}

export default {
  uploadImage,
  getPresignedUrl,
  deleteImage,
  listImages,
  clearImageCache,
  validateImage,
  compressToWebP,
  resizeImage
};
