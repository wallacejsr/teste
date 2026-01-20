
import { Role, LicenseStatus, ProjectStatus, User, Company, License, Unit, Resource, Project, Task } from '../types';

export const MOCK_COMPANIES: Company[] = [
  { id: 'c1', nome: 'Construtora Alfa', cnpj: '12.345.678/0001-01' },
  { id: 'c2', nome: 'Edificações Beta', cnpj: '98.765.432/0001-99' },
];

export const MOCK_LICENSES: License[] = [
  { 
    id: 'l1', 
    // Fix: Changed empresaId to tenantId to match License interface
    tenantId: 'c1', 
    // Fix: Changed 'gold' to 'PRO' to match allowed types in License interface
    planoId: 'PRO', 
    dataInicio: '2024-01-01', 
    dataFim: '2025-01-01', 
    limiteUsuarios: 10, 
    status: LicenseStatus.ATIVA 
  }
];

export const MOCK_USERS: User[] = [
  // Fixed empresaId to tenantId to match User type definition
  { id: 'u1', nome: 'Admin Engenheiro', email: 'admin@alfa.com', tenantId: 'c1', role: Role.ADMIN, ativo: true },
  { id: 'u2', nome: 'Planejador Junior', email: 'planejador@alfa.com', tenantId: 'c1', role: Role.PLANEJADOR, ativo: true },
];

export const MOCK_UNITS: Unit[] = [
  { id: 'un1', nome: '%', tipo: 'fisica' },
  { id: 'un2', nome: 'm²', tipo: 'fisica' },
  { id: 'un3', nome: 'HH', tipo: 'tempo' },
];

export const MOCK_RESOURCES: Resource[] = [
  // Fix: Changed empresaId to tenantId to match Resource interface
  { id: 'r1', nome: 'Pedreiro', tipo: 'HUMANO', tenantId: 'c1', custoHora: 25 },
  // Fix: Changed empresaId to tenantId to match Resource interface
  { id: 'r2', nome: 'Escavadeira', tipo: 'EQUIPAMENTO', tenantId: 'c1', custoHora: 150 },
];

export const MOCK_PROJECTS: Project[] = [
  { 
    id: 'p1', 
    // Fix: Changed empresaId to tenantId to match Project interface
    tenantId: 'c1', 
    nome: 'Residencial Aurora', 
    local: 'SÃO PAULO, SP',
    status: ProjectStatus.EXECUCAO, 
    dataInicio: '2024-05-01', 
    dataFim: '2024-12-15',
    orcamento: 1500000,
    baselineSet: true 
  },
];

export const MOCK_TASKS: Task[] = [
  // EAP 1: MONTAGEM DA ESTRUTURA
  {
    id: 'p-1',
    // Fix: Added missing tenantId to match Task interface
    tenantId: 'c1',
    obraId: 'p1',
    nome: 'MONTAGEM DA ESTRUTURA',
    wbs: '1',
    duracaoDias: 30,
    inicioPlanejado: '2024-05-01',
    fimPlanejado: '2024-06-01',
    dependencias: [],
    unidadeId: 'un1',
    qtdPlanejada: 100,
    qtdRealizada: 30, // Representando a média dos filhos
    peso: 40,
    custoPlanejado: 500000,
    custoRealizado: 150000,
    alocacoes: []
  },
  {
    id: 't1',
    // Fix: Added missing tenantId to match Task interface
    tenantId: 'c1',
    obraId: 'p1',
    nome: 'REFORÇOS DOS PILARES EM VIGA U 12"',
    wbs: '1.1',
    duracaoDias: 1,
    inicioPlanejado: '2024-05-01',
    fimPlanejado: '2024-05-02',
    inicioReal: '2024-05-01',
    dependencias: [],
    unidadeId: 'un2',
    qtdPlanejada: 100,
    qtdRealizada: 100,
    peso: 5,
    custoPlanejado: 5000,
    custoRealizado: 4800,
    alocacoes: [{ recursoId: 'r1', quantidade: 2 }]
  },
  {
    id: 't2',
    // Fix: Added missing tenantId to match Task interface
    tenantId: 'c1',
    obraId: 'p1',
    nome: 'NOVOS TRILHOS DA PONTE ROLANTE',
    wbs: '1.2',
    duracaoDias: 10,
    inicioPlanejado: '2024-05-02',
    fimPlanejado: '2024-05-12',
    dependencias: ['t1'],
    unidadeId: 'un2',
    qtdPlanejada: 500,
    qtdRealizada: 250,
    peso: 15,
    custoPlanejado: 25000,
    custoRealizado: 12000,
    alocacoes: [{ recursoId: 'r2', quantidade: 1 }]
  },
  // EAP 2: PINTURA DA ESTRUTURA
  {
    id: 'p-2',
    // Fix: Added missing tenantId to match Task interface
    tenantId: 'c1',
    obraId: 'p1',
    nome: 'PINTURA DA ESTRUTURA',
    wbs: '2',
    duracaoDias: 20,
    inicioPlanejado: '2024-06-01',
    fimPlanejado: '2024-06-20',
    dependencias: ['p-1'],
    unidadeId: 'un1',
    qtdPlanejada: 100,
    qtdRealizada: 0,
    peso: 20,
    custoPlanejado: 80000,
    custoRealizado: 0,
    alocacoes: []
  },
  {
    id: 't3',
    // Fix: Added missing tenantId to match Task interface
    tenantId: 'c1',
    obraId: 'p1',
    nome: 'PINTURA DA ESTRUTURA DA COBERTURA',
    wbs: '2.1',
    duracaoDias: 0.5,
    inicioPlanejado: '2024-06-01',
    fimPlanejado: '2024-06-01',
    dependencias: [],
    unidadeId: 'un1',
    qtdPlanejada: 100,
    qtdRealizada: 0,
    peso: 10,
    custoPlanejado: 40000,
    custoRealizado: 0,
    alocacoes: [{ recursoId: 'r1', quantidade: 5 }]
  }
];
