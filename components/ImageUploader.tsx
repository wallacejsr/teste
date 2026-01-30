import React, { useRef, useState } from 'react';
import { Upload, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { useImageUpload } from '../hooks/useImageUpload';

/**
 * PILAR 8: Componente reutilizável para upload de imagens
 * Features: Preview, progress bar, erro handling, otimização
 */

interface ImageUploaderProps {
  entityId: string;
  tenantId: string;
  bucket: 'fotos-obra' | 'fotos-recurso' | 'fotos-usuario';
  onUploadSuccess?: (url: string) => void;
  onUploadError?: (error: string) => void;
  maxSizeMB?: number;
  className?: string;
  label?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  entityId,
  tenantId,
  bucket,
  onUploadSuccess,
  onUploadError,
  maxSizeMB = 10,
  className = '',
  label = 'Enviar Imagem'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const { loading, error, progress, imageUrl, upload, reset } = useImageUpload();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    try {
      const url = await upload(file, entityId, { bucket, tenantId, maxSizeMB });
      onUploadSuccess?.(url);
    } catch (err: any) {
      onUploadError?.(err.message);
    }
  };

  const handleReset = () => {
    reset();
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
          id={`image-input-${entityId}`}
        />

        <label
          htmlFor={`image-input-${entityId}`}
          className={`
            flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg
            cursor-pointer transition-colors
            ${loading ? 'border-blue-300 bg-blue-50 cursor-wait' : 'border-slate-300 hover:border-blue-400'}
            ${error ? 'border-red-300 bg-red-50' : ''}
            ${imageUrl ? 'border-green-300 bg-green-50' : ''}
          `}
        >
          {loading ? (
            <>
              <Loader size={18} className="animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-600">{progress}%</span>
            </>
          ) : error ? (
            <>
              <AlertCircle size={18} className="text-red-600" />
              <span className="text-sm font-medium text-red-600">Erro</span>
            </>
          ) : imageUrl ? (
            <>
              <CheckCircle size={18} className="text-green-600" />
              <span className="text-sm font-medium text-green-600">Enviado!</span>
            </>
          ) : (
            <>
              <Upload size={18} className="text-slate-600" />
              <span className="text-sm font-medium text-slate-600">{label}</span>
            </>
          )}
        </label>
      </div>

      {/* Preview */}
      {preview && (
        <div className="relative w-full h-40 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          {imageUrl && (
            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
              ✓ Enviado
            </div>
          )}
        </div>
      )}

      {/* Informações */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {imageUrl && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
          ✓ Imagem enviada com sucesso (WebP otimizado)
        </div>
      )}

      {/* Reset */}
      {(preview || imageUrl) && (
        <button
          onClick={handleReset}
          type="button"
          className="w-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          Limpar
        </button>
      )}

      {/* Dicas */}
      <div className="text-xs text-slate-500 space-y-1">
        <p>• Formatos: JPEG, PNG, WebP</p>
        <p>• Tamanho máximo: {maxSizeMB}MB</p>
        <p>• A imagem será otimizada automaticamente</p>
      </div>
    </div>
  );
};

export default ImageUploader;
