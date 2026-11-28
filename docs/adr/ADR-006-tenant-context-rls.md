# ADR-006 — Contexto de tenant via RLS com role de runtime sem bypass

Status: aceito (aprovado pelo responsável do projeto em 2026-11-28, junto ao plano do E02).

## Contexto
DATABASE.md alerta que credenciais Prisma privilegiadas ignoram RLS. Filtros por `organizationId` no código são necessários, mas um único esquecimento vaza dados entre tenants. A API usa Prisma por conexão direta, não PostgREST, então `auth.uid()` do Supabase não está disponível.

## Decisão
- Duas roles: `prospect_owner` (dono do schema, apenas migrações) e `app_user` (runtime da API/worker, `NOBYPASSRLS`, só DML).
- Toda operação de runtime roda dentro de uma transação que executa `set_config('app.user_id', <sub do JWT>, true)` (local à transação, compatível com pooler em modo transaction).
- Policies leem `app.current_user_id()`. Funções `SECURITY DEFINER` (`app.is_member`, `app.has_role`) evitam recursão de policies sobre `Membership`.
- Criação de workspace via `app.create_workspace(name)` (`SECURITY DEFINER`), que insere organização e o OWNER atomicamente.
- RLS garante isolamento e papel mínimo (VIEWER só lê; DELETE exige ADMIN+). Regras finas (ADMIN não gerencia OWNER/ADMIN, último OWNER) ficam no domínio (`packages/domain/src/rbac.ts`).
- O código mantém filtros explícitos por `organizationId` como segunda camada.

## Consequências
- Cada request autenticado abre uma transação interativa (custo de latência a medir no piloto).
- A role `app_user` precisa existir antes das migrações em qualquer ambiente (inclusive Supabase).
- Sem `app.user_id` definido, `app_user` não enxerga nenhuma linha (falha fechada).
- A role `prospect_owner` nunca deve ser usada em runtime.
