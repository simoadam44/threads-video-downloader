-- SEO content engines: landing tool pages + long-tail guides (Supabase Postgres).

create table if not exists public.tool_pages (
  id bigint generated always as identity primary key,
  slug text not null unique,
  badge text not null default '',
  lang text not null default 'en',
  target_keyword text not null default '',
  title text not null,
  description text not null,
  h1 text not null,
  intro text not null default '',
  faqs jsonb not null default '[]',
  related_slugs jsonb not null default '[]',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tool_pages_slug_idx on public.tool_pages (slug);
create index if not exists tool_pages_status_idx on public.tool_pages (status);

create table if not exists public.guides (
  id bigint generated always as identity primary key,
  slug text not null unique,
  lang text not null default 'en',
  target_keyword text not null default '',
  title text not null,
  description text not null,
  h1 text not null,
  body text not null default '',
  faqs jsonb not null default '[]',
  related_slugs jsonb not null default '[]',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists guides_slug_idx on public.guides (slug);
create index if not exists guides_status_idx on public.guides (status);

alter table public.tool_pages enable row level security;
alter table public.guides enable row level security;
-- No permissive policies: Worker service-role only, browsers via /api/*.
