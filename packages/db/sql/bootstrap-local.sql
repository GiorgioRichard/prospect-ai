-- Bootstrap de roles e bancos para desenvolvimento local e CI (ADR-006). Idempotente.
-- Executar como superusuário com psql:
--   psql -v owner_pw=... -v app_pw=... -f bootstrap-local.sql
-- prospect_owner: dono do schema, usado apenas em migrações.
-- app_user: usado pela API/worker em runtime; sem BYPASSRLS, sujeito às policies.

SELECT format('CREATE ROLE prospect_owner LOGIN CREATEDB PASSWORD %L', :'owner_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prospect_owner') \gexec

SELECT format('CREATE ROLE app_user LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L', :'app_pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') \gexec

SELECT 'CREATE DATABASE prospect_ai_dev OWNER prospect_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'prospect_ai_dev') \gexec

SELECT 'CREATE DATABASE prospect_ai_test OWNER prospect_owner'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'prospect_ai_test') \gexec
