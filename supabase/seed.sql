-- Dev seed: default settings are inserted by the migration.
-- Admin user is created via Studio (http://127.0.0.1:54323) > Authentication > Add user,
-- then set app_metadata to {"role": "admin"} via SQL below (replace the email):
--
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'::jsonb
--   where email = 'admin@example.com';
--
-- Never commit real credentials. See .env.example (ADMIN_EMAIL only, no password).
select 1;
