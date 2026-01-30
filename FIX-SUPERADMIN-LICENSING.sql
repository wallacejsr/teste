-- FIX-SUPERADMIN-LICENSING.sql
-- Fix SUPERADMIN access to licenses and plan_templates tables
-- Date: 2026-01-30
-- Applied to restore SUPERADMIN visibility on licensing features

-- Fix licenses table RLS policies
DROP POLICY IF EXISTS "Licenses visible to tenant members" ON public.licenses;

CREATE POLICY "Licenses visible to tenant members" ON public.licenses
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (
      -- SUPERADMIN: unrestricted access via JWT extraction
      (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
      OR
      -- Regular users: only see licenses for their tenant
      tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "SUPERADMIN can manage licenses" ON public.licenses;

CREATE POLICY "SUPERADMIN can manage licenses" ON public.licenses
  FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
  );

-- Fix plan_templates table RLS policies
DROP POLICY IF EXISTS "Plan templates visible to tenant members" ON public.plan_templates;

CREATE POLICY "Plan templates visible to tenant members" ON public.plan_templates
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (
      -- SUPERADMIN: unrestricted access via JWT extraction
      (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
      OR
      -- Regular users: only see templates for their tenant
      tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "SUPERADMIN can manage plan templates" ON public.plan_templates;

CREATE POLICY "SUPERADMIN can manage plan templates" ON public.plan_templates
  FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
  );

-- Fix global_configs table for SUPERADMIN access
DROP POLICY IF EXISTS "SUPERADMIN can access global configs" ON public.global_configs;

CREATE POLICY "SUPERADMIN can access global configs" ON public.global_configs
  FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
  );

-- Verify all policies are applied
SELECT schemaname, tablename, policyname, permissive, roles, qual
FROM pg_policies
WHERE tablename IN ('licenses', 'plan_templates', 'global_configs')
ORDER BY tablename, policyname;
