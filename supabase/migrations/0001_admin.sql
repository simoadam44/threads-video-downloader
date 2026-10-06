-- Admin analytics + settings. Postgres (works on Supabase Local and Supabase Cloud).

create table if not exists public.resolve_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  url_hash text not null,
  status text not null,
  media_count int not null default 0,
  ip_hash text,
  ua text
);
create index if not exists resolve_events_created_at_idx on public.resolve_events (created_at desc);
create index if not exists resolve_events_status_idx on public.resolve_events (status);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('resolver_provider', 'mock'),
  ('resolve_limit', '20'),
  ('ads_enabled', 'false'),
  ('analytics_enabled', 'false')
on conflict (key) do nothing;

-- Lock everything: the Worker uses the service-role key server-side only.
-- Browsers never touch the DB directly; all access goes through /api/admin/*.
alter table public.resolve_events enable row level security;
alter table public.app_settings enable row level security;
-- No permissive policies for anon/authenticated: only service_role bypasses RLS.
