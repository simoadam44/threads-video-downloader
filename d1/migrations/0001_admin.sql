-- Dev-only local schema for Cloudflare D1 (SQLite). Mirrors supabase/migrations/0001_admin.sql.
-- TEMPORARY: used only for local testing without Docker. Production uses Supabase Postgres.

create table if not exists resolve_events (
  id integer primary key autoincrement,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  url_hash text not null,
  status text not null,
  media_count integer not null default 0,
  ip_hash text,
  ua text
);
create index if not exists resolve_events_created_at_idx on resolve_events (created_at desc);
create index if not exists resolve_events_status_idx on resolve_events (status);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

insert or ignore into app_settings (key, value) values
  ('resolver_provider', 'mock'),
  ('resolve_limit', '20'),
  ('ads_enabled', 'false'),
  ('analytics_enabled', 'false');
