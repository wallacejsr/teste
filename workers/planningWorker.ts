/**
 * PILAR 6: Web Worker para Cálculos Pesados
 * Executa planningEngine em thread separada para não travar UI
 * Performance: 5000 tarefas não bloqueiam rendering
 */

import { Task, Resource, Project, DailyLog } from '../types';
import { calculateSCurve, calculateFinancialEVA } from '../services/planningEngine';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

interface WorkerMessage {
  operation: 'calculateSCurve' | 'calculateFinancialEVA';
  data: {
    tasks?: Task[];
    resources?: Resource[];
    project?: Project;
    dailyLogs?: DailyLog[];
    isSimulationMode?: boolean;
  };
}

ctx.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { operation, data } = event.data;

  try {
    let result: any;

    switch (operation) {
      case 'calculateSCurve':
        if (!data.tasks) throw new Error('Tasks required for calculateSCurve');
        result = calculateSCurve(data.tasks);
        break;

      case 'calculateFinancialEVA':
        if (!data.tasks || !data.resources || !data.project || !data.dailyLogs) {
          throw new Error('All parameters required for calculateFinancialEVA');
        }
        result = calculateFinancialEVA(
          data.tasks,
          data.resources,
          data.project,
          data.dailyLogs,
          data.isSimulationMode
        );
        break;

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    ctx.postMessage({ success: true, result });
  } catch (error: any) {
    ctx.postMessage({ success: false, error: error.message });
  }
};

export {};
