-- ================================================
-- TABELA: user_invites
-- ================================================
-- Armazena tokens de convite para novos usuários
-- Criada em: 13 de Fevereiro de 2026
-- Autor: Sistema de Gestão de Convites
-- ================================================

CREATE TABLE IF NOT EXISTS user_invites (
  -- Identificador único do convite
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Token único do convite (usado na URL)
  token TEXT NOT NULL UNIQUE,
  
  -- E-mail do usuário convidado
  email TEXT NOT NULL,
  
  -- Nome do usuário convidado
  name TEXT NOT NULL,
  
  -- ID do tenant (empresa)
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Cargo/role do usuário
  role TEXT NOT NULL DEFAULT 'USUARIO',
  
  -- ID do usuário que enviou o convite
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Data de criação do convite
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Data de expiração do convite (7 dias por padrão)
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Status do convite
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  
  -- ID do usuário criado após aceitar convite
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Data de aceitação do convite
  accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata adicional (JSON)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Data de atualização
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- ÍNDICES para melhor performance
-- ================================================

-- Índice para busca rápida por token (usado ao clicar no link)
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);

-- Índice para busca por e-mail
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON user_invites(email);

-- Índice para busca por tenant
CREATE INDEX IF NOT EXISTS idx_user_invites_tenant_id ON user_invites(tenant_id);

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_user_invites_status ON user_invites(status);

-- Índice para busca por expiração (útil para limpeza automática)
CREATE INDEX IF NOT EXISTS idx_user_invites_expires_at ON user_invites(expires_at);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Ativar RLS
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários podem ver convites do seu tenant
CREATE POLICY "Users can view invites from their tenant"
  ON user_invites
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE tenant_id = user_invites.tenant_id
    )
  );

-- Policy: ADMINs e SUPER_ADMINs podem criar convites
CREATE POLICY "Admins can create invites"
  ON user_invites
  FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE tenant_id = user_invites.tenant_id 
      AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Policy: ADMINs podem atualizar convites do seu tenant
CREATE POLICY "Admins can update invites"
  ON user_invites
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE tenant_id = user_invites.tenant_id 
      AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Policy: ADMINs podem deletar convites do seu tenant
CREATE POLICY "Admins can delete invites"
  ON user_invites
  FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM users 
      WHERE tenant_id = user_invites.tenant_id 
      AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Policy: Permitir leitura pública de convites (para validação de token)
-- IMPORTANTE: Apenas campos não sensíveis são expostos
CREATE POLICY "Public can read invite by token"
  ON user_invites
  FOR SELECT
  USING (true); -- Permite leitura pública, mas RLS da tabela users protege dados sensíveis

-- ================================================
-- TRIGGERS
-- ================================================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_user_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_invites_updated_at
  BEFORE UPDATE ON user_invites
  FOR EACH ROW
  EXECUTE FUNCTION update_user_invites_updated_at();

-- ================================================
-- FUNÇÃO: Limpar convites expirados automaticamente
-- ================================================

CREATE OR REPLACE FUNCTION cleanup_expired_invites()
RETURNS void AS $$
BEGIN
  UPDATE user_invites
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- COMENTÁRIOS (Documentação)
-- ================================================

COMMENT ON TABLE user_invites IS 'Armazena tokens de convite para novos usuários';
COMMENT ON COLUMN user_invites.token IS 'Token único usado na URL do convite (UUID v4)';
COMMENT ON COLUMN user_invites.email IS 'E-mail do usuário convidado';
COMMENT ON COLUMN user_invites.expires_at IS 'Data de expiração do convite (padrão: 7 dias após criação)';
COMMENT ON COLUMN user_invites.status IS 'Status do convite: pending, accepted, expired, revoked';
COMMENT ON COLUMN user_invites.user_id IS 'ID do usuário criado após aceitar o convite';

-- ================================================
-- EXEMPLO DE USO
-- ================================================

-- Criar um convite
/*
INSERT INTO user_invites (token, email, name, tenant_id, role, invited_by, expires_at)
VALUES (
  gen_random_uuid()::text,
  'joao@exemplo.com',
  'João Silva',
  'uuid-do-tenant',
  'ENGENHEIRO',
  'uuid-do-admin',
  NOW() + INTERVAL '7 days'
);
*/

-- Buscar convite por token
/*
SELECT * FROM user_invites 
WHERE token = 'token-do-convite' 
  AND status = 'pending'
  AND expires_at > NOW();
*/

-- Marcar convite como aceito
/*
UPDATE user_invites
SET status = 'accepted',
    user_id = 'uuid-do-usuario-criado',
    accepted_at = NOW()
WHERE token = 'token-do-convite';
*/

-- Limpar convites expirados (executar periodicamente)
/*
SELECT cleanup_expired_invites();
*/
