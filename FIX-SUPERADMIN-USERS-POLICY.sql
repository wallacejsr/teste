-- FIX-SUPERADMIN-USERS-POLICY.sql
-- Fix recursive query issue in users RLS policy for SUPERADMIN role
-- Date: 2026-01-30
-- Applied to fix SUPERADMIN isolation after RLS policy changes

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Users can read users in their tenant" ON public.users;

-- Create new policy using auth.jwt() to avoid recursive queries
CREATE POLICY "Users can read users in their tenant" ON public.users
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    (
      -- SUPERADMIN: unrestricted access via JWT extraction (avoid recursive query)
      (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
      OR
      -- Regular users: only see users in their tenant
      tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Also update the INSERT/UPDATE policies to use same approach
DROP POLICY IF EXISTS "Users can update their own record" ON public.users;

CREATE POLICY "Users can update their own record" ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "SUPERADMIN can manage all users" ON public.users;

CREATE POLICY "SUPERADMIN can manage all users" ON public.users
  FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN'
  );

-- Verify policies are applied
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
