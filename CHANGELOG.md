# Changelog

## Não lançado — E02 auth/workspace/RBAC
- ADR-006 (aceito): role de runtime `app_user` sem bypass de RLS; `app.user_id` por transação; funções `SECURITY DEFINER` para membership.
- Migração inicial `init_workspaces_rbac`: enum `Role`, timestamps, índices, FKs com cascade, RLS em todas as tabelas e grants explícitos por tabela.
- API: validação de JWT do Supabase (ES256/RS256 via JWKS; issuer, audience, exp; `sub` UUID); rotas `/v1/workspaces` e membros com paginação por cursor.
- Domínio: regras de RBAC (ADMIN só gerencia MEMBER/VIEWER; último OWNER protegido; qualquer membro pode sair).
- Testes: RLS direto em SQL (9), auth/API/RBAC/isolamento via Supertest (26), RBAC unitário; CI com PostgreSQL 17.
- `docs/openapi.yaml` com as rotas do E02.
- Fora do escopo: convites por e-mail, login na web (E02b), verificação de existência do `userId` no Supabase ao adicionar membro.

## Não lançado — E01 monorepo/CI
- Monorepo npm workspaces + Turborepo: `apps/api` (Express 5), `apps/worker`, `apps/web` (Next.js 16), `packages/domain`, `packages/contracts`, `packages/db`.
- TypeScript 6 strict, ESLint 10 + typescript-eslint, Prettier, Vitest e Supertest.
- API: `GET /health`, request ID gerado no servidor, envelope de erro `{code,message,requestId,details?}`, config validada com Zod.
- Domínio: `computeServiceScore` conforme SCORING.md (pesos propostos, não calibrados).
- Schema Prisma movido para `packages/db/prisma/schema.prisma`; validado com `prisma validate`, sem migração.
- CI GitHub Actions: audit, lint, typecheck, test, build.
- `packages/providers` e `packages/ui` ainda não criados (entram nos épicos que os usam).

## 1.0.0 — 2026-11-26
Baseline documental proposta; schema parcial; sem aplicação ou testes executados.
