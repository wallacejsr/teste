import React from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PILAR 8: Modal de Preview de Imagens
 * Exibe fotos em galeria modal com navegação
 */

interface ImagePreviewModalProps {
  isOpen: boolean;
  images: string[];
  title?: string;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  images,
  title = 'Galeria de Fotos',
  onClose
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `foto-${currentIndex + 1}.jpg`;
    link.click();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 rounded-[24px] overflow-hidden shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-white font-bold">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              {/* Imagem */}
              <div className="flex-1 flex items-center justify-center bg-black p-6 relative overflow-hidden">
                <motion.img
                  key={currentIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  src={currentImage}
                  alt={`Foto ${currentIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />

                {/* Navegação */}
                {images.length > 1 && (
                  <>
                    {/* Botão Anterior */}
                    <button
                      onClick={goToPrevious}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                      <ChevronLeft size={24} className="text-white" />
                    </button>

                    {/* Botão Próximo */}
                    <button
                      onClick={goToNext}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                      <ChevronRight size={24} className="text-white" />
                    </button>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-700 flex items-center justify-between bg-slate-800">
                <div className="text-slate-400 text-sm">
                  {currentIndex + 1} de {images.length}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadImage}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-white"
                    title="Download"
                  >
                    <Download size={20} />
                  </button>
                </div>
              </div>

              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="p-4 bg-slate-800 flex gap-2 overflow-x-auto">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        idx === currentIndex ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ImagePreviewModal;
