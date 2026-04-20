create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_user_role') then
    create type public.platform_user_role as enum ('ceo', 'manager', 'supervisor', 'technician');
  end if;

  if not exists (select 1 from pg_type where typname = 'platform_user_onboarding_status') then
    create type public.platform_user_onboarding_status as enum ('pending_profile', 'active', 'blocked');
  end if;

  if not exists (select 1 from pg_type where typname = 'platform_signature_status') then
    create type public.platform_signature_status as enum ('missing', 'pending_review', 'approved', 'rejected');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.platform_users (
  id uuid primary key default gen_random_uuid(),
  entra_oid text not null unique,
  email text not null unique,
  name text not null,
  tenant_id text,
  phone text,
  avatar_url text,
  app_role public.platform_user_role not null default 'technician',
  onboarding_status public.platform_user_onboarding_status not null default 'pending_profile',
  is_active boolean not null default true,
  created_by uuid references public.platform_users(id) on delete set null,
  last_login_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.platform_user_profiles (
  user_id uuid primary key references public.platform_users(id) on delete cascade,
  professional_role text,
  registry_type text,
  registry_number text,
  can_sign_reports boolean not null default false,
  signature_name text,
  signature_data_url text,
  signature_mime_type text,
  signature_status public.platform_signature_status not null default 'missing',
  signature_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.report_signers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  user_id uuid references public.platform_users(id) on delete set null,
  name_snapshot text not null,
  role_snapshot text,
  registry_type_snapshot text,
  registry_number_snapshot text,
  signature_name_snapshot text,
  signature_data_url_snapshot text,
  signature_status_snapshot public.platform_signature_status not null default 'missing',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_platform_users_email on public.platform_users(email);
create index if not exists idx_platform_users_role on public.platform_users(app_role);
create index if not exists idx_platform_users_active on public.platform_users(is_active);
create index if not exists idx_platform_user_profiles_can_sign on public.platform_user_profiles(can_sign_reports);
create index if not exists idx_report_signers_report_id on public.report_signers(report_id);

drop trigger if exists set_platform_users_updated_at on public.platform_users;
create trigger set_platform_users_updated_at
before update on public.platform_users
for each row
execute function public.set_updated_at();

drop trigger if exists set_platform_user_profiles_updated_at on public.platform_user_profiles;
create trigger set_platform_user_profiles_updated_at
before update on public.platform_user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_report_signers_updated_at on public.report_signers;
create trigger set_report_signers_updated_at
before update on public.report_signers
for each row
execute function public.set_updated_at();

alter table public.platform_users enable row level security;
alter table public.platform_user_profiles enable row level security;
alter table public.report_signers enable row level security;
