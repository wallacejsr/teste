-- ================================================
-- MIGRATION: Adicionar Campos de Personalização da Tela de Login
-- Data: 2026-02-02
-- Descrição: Adiciona campos para customização da tela de login
--            via painel White-label (loginBackgroundUrl, loginHeading, loginDescription)
-- ================================================

-- Adicionar coluna para URL da imagem de fundo da tela de login
ALTER TABLE global_configs
ADD COLUMN IF NOT EXISTS login_background_url TEXT;

-- Adicionar coluna para título principal da tela de login
ALTER TABLE global_configs
ADD COLUMN IF NOT EXISTS login_heading VARCHAR(255);

-- Adicionar coluna para texto descritivo da tela de login
ALTER TABLE global_configs
ADD COLUMN IF NOT EXISTS login_description TEXT;

-- Adicionar coluna software_subtitle se não existir (pode já existir em alguns bancos)
ALTER TABLE global_configs
ADD COLUMN IF NOT EXISTS software_subtitle VARCHAR(255);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN global_configs.login_background_url IS 'URL da imagem de fundo da tela de login (White-label)';
COMMENT ON COLUMN global_configs.login_heading IS 'Título principal exibido na tela de login (White-label)';
COMMENT ON COLUMN global_configs.login_description IS 'Texto descritivo exibido abaixo do título na tela de login (White-label)';
COMMENT ON COLUMN global_configs.software_subtitle IS 'Subtítulo do software exibido no sistema (ex: Engineering Suite)';

-- ================================================
-- VALORES PADRÃO (OPCIONAL)
-- ================================================
-- Atualizar registro existente com valores padrão se campos estiverem vazios
UPDATE global_configs
SET 
  login_heading = 'Engenharia que conecta pessoas',
  login_description = 'Planeje, colabore e execute seus projetos com a precisão de uma obra bem coordenada. Tecnologia e engenharia em perfeita sinergia.',
  login_background_url = 'https://images.unsplash.com/photo-1589492477543-e4f4c8ee3a7d?w=1200&h=1600&fit=crop&q=80'
WHERE 
  (login_heading IS NULL OR login_heading = '')
  AND (login_description IS NULL OR login_description = '')
  AND (login_background_url IS NULL OR login_background_url = '');

-- ================================================
-- VERIFICAÇÃO
-- ================================================
-- Para verificar se as colunas foram adicionadas:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'global_configs';
