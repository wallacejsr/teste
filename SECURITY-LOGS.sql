-- SECURITY-LOGS.sql
-- Tabela e políticas RLS para logs de segurança
-- Data: 2026-01-30

-- Extensão necessária para gen_random_uuid (normalmente já habilitada no Supabase)
-- create extension if not exists "pgcrypto";

create table if not exists public.security_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null,
  context text,
  created_at timestamptz not null default now()
);

create index if not exists security_logs_tenant_id_idx on public.security_logs (tenant_id);
create index if not exists security_logs_user_id_idx on public.security_logs (user_id);
create index if not exists security_logs_created_at_idx on public.security_logs (created_at desc);

alter table public.security_logs enable row level security;

-- Inserção permitida para qualquer usuário autenticado
create policy "security_logs_insert_authenticated" on public.security_logs
  for insert
  with check (auth.uid() is not null);

-- Leitura restrita apenas a SUPERADMIN
create policy "security_logs_select_superadmin" on public.security_logs
  for select
  using ((auth.jwt() -> 'user_metadata' ->> 'role')::text = 'SUPERADMIN');
