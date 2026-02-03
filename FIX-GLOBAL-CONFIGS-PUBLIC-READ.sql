-- =====================================================
-- FIX: Permitir leitura pública de global_configs
-- =====================================================
-- Problema: Tela de login precisa carregar branding ANTES da autenticação
-- Solução: Permitir SELECT anônimo (leitura pública) em global_configs
-- Segurança: Apenas SELECT permitido. INSERT/UPDATE/DELETE exigem autenticação.
-- =====================================================

-- 1. Remover política antiga que bloqueia acesso anônimo
DROP POLICY IF EXISTS "SUPERADMIN can access global configs" ON public.global_configs;

-- 2. Criar política para LEITURA PÚBLICA (SELECT anônimo permitido)
CREATE POLICY "Public can read global configs" 
ON public.global_configs
FOR SELECT
USING (true);  -- Qualquer um pode ler (incluindo não autenticados)

-- 3. Criar política para SUPERADMIN escrever (INSERT/UPDATE/DELETE)
CREATE POLICY "SUPERADMIN can modify global configs" 
ON public.global_configs
FOR ALL
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
);

-- 4. Verificar se RLS está habilitado (deve estar)
ALTER TABLE public.global_configs ENABLE ROW LEVEL SECURITY;

-- 5. Verificar políticas aplicadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'global_configs'
ORDER BY policyname;

-- =====================================================
-- RESULTADO ESPERADO:
-- =====================================================
-- Política 1: "Public can read global configs"
--   - cmd: SELECT
--   - qual: true (qualquer um pode ler)
--
-- Política 2: "SUPERADMIN can modify global configs"  
--   - cmd: ALL (INSERT, UPDATE, DELETE)
--   - qual: role = 'SUPERADMIN'
--   - with_check: role = 'SUPERADMIN'
-- =====================================================
