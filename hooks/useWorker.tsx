import { useCallback, useRef } from 'react';
import { Task, Resource, Project, DailyLog } from '../types';

/**
 * PILAR 6: Hook para usar Web Worker de forma fácil
 * Automaticamente cria/termina worker para evitar memory leaks
 */

interface WorkerResponse {
  success: boolean;
  result?: any;
  error?: string;
}

export const useWorker = () => {
  const workerRef = useRef<Worker | null>(null);

  const calculateSCurveAsync = useCallback(async (tasks: Task[]) => {
    return new Promise((resolve, reject) => {
      // Cria worker dinamicamente
      workerRef.current = new Worker(
        new URL('../workers/planningWorker.ts', import.meta.url),
        { type: 'module' }
      );

      workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.success) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error || 'Worker failed'));
        }
        // Termina worker após uso para liberar memória
        workerRef.current?.terminate();
        workerRef.current = null;
      };

      workerRef.current.onerror = (error) => {
        reject(error);
        workerRef.current?.terminate();
        workerRef.current = null;
      };

      // Envia dados para worker
      workerRef.current.postMessage({
        operation: 'calculateSCurve',
        data: { tasks }
      });
    });
  }, []);

  const calculateFinancialEVAAsync = useCallback(
    async (
      tasks: Task[],
      resources: Resource[],
      project: Project,
      dailyLogs: DailyLog[],
      isSimulationMode: boolean = false
    ) => {
      return new Promise((resolve, reject) => {
        workerRef.current = new Worker(
          new URL('../workers/planningWorker.ts', import.meta.url),
          { type: 'module' }
        );

        workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
          if (event.data.success) {
            resolve(event.data.result);
          } else {
            reject(new Error(event.data.error || 'Worker failed'));
          }
          workerRef.current?.terminate();
          workerRef.current = null;
        };

        workerRef.current.onerror = (error) => {
          reject(error);
          workerRef.current?.terminate();
          workerRef.current = null;
        };

        workerRef.current.postMessage({
          operation: 'calculateFinancialEVA',
          data: { tasks, resources, project, dailyLogs, isSimulationMode }
        });
      });
    },
    []
  );

  // Cleanup ao desmontar componente
  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  return {
    calculateSCurveAsync,
    calculateFinancialEVAAsync,
    cleanup
  };
};
