-- ================================================
-- SCHEMA DO BANCO DE DADOS - ENGENHARIAPRO SAAS
-- ================================================
-- Database: engenhariapro
-- Engine: PostgreSQL 15+
-- ================================================

-- ================================================
-- 1. TABELAS DE AUTENTICAÇÃO E TENANTS
-- ================================================

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL UNIQUE,
  cnpj VARCHAR(18) UNIQUE,
  status VARCHAR(50) DEFAULT 'ativo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'LEITURA',
  password_hash VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plano_id VARCHAR(50) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  limite_usuarios INTEGER DEFAULT 5,
  status VARCHAR(50) DEFAULT 'ATIVA',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ================================================
-- 2. TABELAS DE PROJETOS E CRONOGRAMAS
-- ================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'ATIVA',
  cliente_nome VARCHAR(255),
  local VARCHAR(255),
  orcamento_total DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  wbs VARCHAR(50) NOT NULL,
  inicio_planejado DATE NOT NULL,
  fim_planejado DATE NOT NULL,
  inicio_real DATE,
  fim_real DATE,
  duracao_dias INTEGER NOT NULL,
  qtd_planejada DECIMAL(12, 2) NOT NULL DEFAULT 0,
  qtd_realizada DECIMAL(12, 2) NOT NULL DEFAULT 0,
  unidade_medida VARCHAR(50),
  peso DECIMAL(5, 2) NOT NULL DEFAULT 0,
  is_auto_weight BOOLEAN DEFAULT true,
  dependencias TEXT DEFAULT '[]',
  alocacoes TEXT DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_obra_id ON tasks(obra_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id);

-- ================================================
-- 3. TABELAS DE RECURSOS
-- ================================================

CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  cargo_id VARCHAR(50),
  cargo_nome VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant_id ON resources(tenant_id);

-- ================================================
-- 4. TABELAS DE DIÁRIO DE OBRA
-- ================================================

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  usuario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  observacoes TEXT,
  avancos TEXT DEFAULT '[]',
  fotos TEXT DEFAULT '[]',
  impedimentos TEXT DEFAULT '[]',
  aplicou_cascata BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_obra_id ON daily_logs(obra_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_data ON daily_logs(data);
CREATE INDEX IF NOT EXISTS idx_daily_logs_tenant_id ON daily_logs(tenant_id);

-- ================================================
-- 5. TABELA DE CONFIGURAÇÃO GLOBAL
-- ================================================

CREATE TABLE IF NOT EXISTS global_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  software_name VARCHAR(255) DEFAULT 'PROJEX MASTER',
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  system_logo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id)
);

-- ================================================
-- 6. ÍNDICES PARA PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_usuario_id ON daily_logs(usuario_id);

-- ================================================
-- 7. DADOS INICIAIS (OPCIONAL)
-- ================================================

-- Inserir tenant de exemplo
INSERT INTO tenants (id, nome, cnpj, status) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'CONSTRUTORA ALFA', '12.345.678/0001-01', 'ativo')
ON CONFLICT DO NOTHING;

-- Inserir usuário admin
INSERT INTO users (id, tenant_id, email, nome, role, ativo) 
VALUES (
  '660e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'master@plataforma.com',
  'Admin Master',
  'ADMIN',
  true
)
ON CONFLICT DO NOTHING;

-- Inserir licença padrão
INSERT INTO licenses (id, tenant_id, plano_id, data_inicio, data_fim, limite_usuarios, status)
VALUES (
  '770e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'PRO',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '1 year',
  20,
  'ATIVA'
)
ON CONFLICT DO NOTHING;

-- ================================================
-- 8. VIEWS ÚTEIS PARA RELATÓRIOS
-- ================================================

CREATE OR REPLACE VIEW vw_project_summary AS
SELECT 
  p.id,
  p.nome,
  p.data_inicio,
  p.data_fim,
  COUNT(DISTINCT t.id) as total_tarefas,
  COUNT(DISTINCT dl.id) as total_rdos,
  p.status
FROM projects p
LEFT JOIN tasks t ON p.id = t.obra_id
LEFT JOIN daily_logs dl ON p.id = dl.obra_id
GROUP BY p.id, p.nome, p.data_inicio, p.data_fim, p.status;

-- ================================================
-- FIM DO SCHEMA
-- ================================================
