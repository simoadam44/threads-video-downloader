-- Dev-only local schema for Cloudflare D1 (SQLite).
-- Mirrors supabase/migrations/0003_contact.sql for local testing.

create table if not exists contact_messages (
  id integer primary key autoincrement,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  ip_hash text,
  user_agent text
);
create index if not exists contact_messages_created_at_idx on contact_messages (created_at desc);
