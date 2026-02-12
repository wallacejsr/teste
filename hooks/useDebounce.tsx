import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook de debounce otimizado para evitar re-cálculos desnecessários
 * Útil para inputs, buscas e cálculos pesados
 * 
 * @param callback - Função a ser executada após o delay
 * @param delay - Tempo em ms para esperar (padrão: 300ms)
 * @returns Função debounced
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Atualizar callback ref quando callback mudar
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * Hook para debounce de valores (retorna valor debounced ao invés de função)
 * Útil para estados que disparam cálculos pesados
 * 
 * @param value - Valor a ser debounced
 * @param delay - Tempo em ms para esperar (padrão: 500ms)
 * @returns Valor debounced
 */
export function useDebouncedValue<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
