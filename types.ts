
export enum Role {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  PLANEJADOR = 'PLANEJADOR',
  ENGENHEIRO = 'ENGENHEIRO',
  FINANCEIRO = 'FINANCEIRO',
  LEITURA = 'LEITURA'
}

export enum LicenseStatus {
  ATIVA = 'ATIVA',
  EXPIRADA = 'EXPIRADA',
  SUSPENSA = 'SUSPENSA'
}

export enum ProjectStatus {
  PLANEJAMENTO = 'PLANEJAMENTO',
  EXECUCAO = 'EXECUCAO',
  CONCLUIDA = 'CONCLUIDA',
  PARALISADA = 'PARALISADA'
}

export interface PlanTemplate {
  id: 'BASIC' | 'PRO' | 'ENTERPRISE';
  nome: string;
  precoMensal: number;
  limiteUsuarios: number;
  limiteObras: number;
  limiteMaoDeObra: number; 
  limiteMaquinario: number; 
  limiteCargos: number; 
  recursos: string[];
  cor: string;
}

export interface GlobalConfig {
  softwareName: string;
  softwareSubtitle?: string;
  systemLogoUrl?: string;
  primaryColor: string;
  gatewayType?: 'STRIPE' | 'ASAAS' | 'MERCADO_PAGO';
  publicKey?: string;
  secretKey?: string;
}

/* ===========================
   NOVO — Company (ADICIONADO)
   =========================== */
export interface Company {
  id: string;
  nome: string;
  cnpj: string;
}

/* ===========================
   NOVO — License (ADICIONADO)
   =========================== */
export interface License {
  id: string;
  tenantId: string;
  planoId: 'BASIC' | 'PRO' | 'ENTERPRISE';
  dataInicio: string;
  dataFim: string;
  limiteUsuarios: number;
  status: LicenseStatus;
}

export interface Tenant {
  id: string;
  nome: string;
  cnpj: string;
  logoUrl?: string;
  limiteUsuarios: number;
  limiteObras: number;
  limiteMaoDeObra: number; 
  limiteMaquinario: number; 
  limiteCargos: number; 
  planoId: 'BASIC' | 'PRO' | 'ENTERPRISE';
  dataFimLicenca: string;
  status: LicenseStatus;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  tenantId: string;
  role: Role;
  ativo: boolean;
  cargo?: string;
  signatureUrl?: string;
  avatarUrl?: string;
  password?: string;
  lastPasswordChange?: string;
}

export interface Unit {
  id: string;
  nome: string;
  tipo: 'fisica' | 'tempo' | 'custo';
}

export interface Resource {
  id: string;
  nome: string;
  tipo: 'HUMANO' | 'EQUIPAMENTO';
  tenantId: string;
  custoHora?: number;
  custoHoraFormatted?: string;
  especialidade?: string;
  placaId?: string;
  categoria?: string;
  userId?: string;
  cargoId?: string;
  cargoNome?: string;
  ativo?: boolean;
}

export interface RoleDefinition {
  id: string;
  tenantId?: string;
  nome: string;
  hhPadrao: number;
  categoria: string;
}

export interface Task {
  id: string;
  tenantId: string;
  obraId: string;
  nome: string;
  descricao?: string;
  wbs: string;
  duracaoDias: number;
  inicioPlanejado: string;
  fimPlanejado: string;
  inicioReal?: string;
  fimReal?: string;
  dependencias: string[];
  unidadeId: string;
  unidadeMedida?: string;
  qtdPlanejada: number;
  qtdRealizada: number;
  peso: number;
  isAutoWeight?: boolean;
  custoPlanejado: number;
  custoRealizado: number;
  alocacoes: {
    recursoId: string;
    quantidade: number;
  }[];
}

export interface Project {
  id: string;
  tenantId: string;
  nome: string;
  descricao?: string;
  clienteNome?: string;
  local: string;
  status: ProjectStatus;
  dataInicio: string;
  dataFim: string;
  orcamento: number;
  logoUrl?: string;
  baselineSet: boolean;
}

export interface DailyLog {
  id: string;
  tenantId: string;
  obraId: string;
  data: string;
  usuarioId: string;
  observacoes: string;
  avancos: {
    tarefaId: string;
    quantidade: number;
    custoExtra?: number;
    observacaoTarefa?: string;
  }[];
  fotos: string[];
  impedimentos?: Impedimento[];
  aplicouCascata?: boolean;
}

export interface Impedimento {
  motivo: string;
  horasPerdidas: number;
  detalhamento: string;
}
