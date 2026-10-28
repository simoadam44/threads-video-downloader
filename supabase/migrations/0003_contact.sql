-- Contact inbox for the public contact form (supabase/migrations/0003_contact.sql).
--
-- Why the database and not email: the project has no mail provider
-- (no RESEND/SMTP secret is configured), so a form that "sends an email" would
-- be fake. Messages are stored here and read in the admin area
-- (/admin/messages), which is the real delivery channel.
--
-- Only the four visitor-provided fields plus hashed request metadata are kept.
-- RLS is locked: the Worker uses the service-role key server-side, browsers
-- never touch this table directly.

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  ip_hash text,
  user_agent text
);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
-- No anon/authenticated policies on purpose: service_role bypasses RLS only.
