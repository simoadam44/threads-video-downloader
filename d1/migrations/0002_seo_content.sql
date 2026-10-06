-- SEO content engines: landing tool pages + long-tail guides.
-- TEMPORARY dev schema for D1 (SQLite). Mirror in supabase/migrations/0002_seo_content.sql.

create table if not exists tool_pages (
  id integer primary key autoincrement,
  slug text not null unique,
  badge text not null default '',
  lang text not null default 'en',
  target_keyword text not null default '',
  title text not null,
  description text not null,
  h1 text not null,
  intro text not null default '',
  faqs text not null default '[]',
  related_slugs text not null default '[]',
  status text not null default 'draft',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists tool_pages_slug_idx on tool_pages (slug);
create index if not exists tool_pages_status_idx on tool_pages (status);

create table if not exists guides (
  id integer primary key autoincrement,
  slug text not null unique,
  lang text not null default 'en',
  target_keyword text not null default '',
  title text not null,
  description text not null,
  h1 text not null,
  body text not null default '',
  faqs text not null default '[]',
  related_slugs text not null default '[]',
  status text not null default 'draft',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index if not exists guides_slug_idx on guides (slug);
create index if not exists guides_status_idx on guides (status);
