# Prospect AI — documentação de engenharia

Versão 1.0.0 · 26/11/2026 · baseline proposta para aprovação. E01 (monorepo/CI) e E02 (auth/workspace/RBAC) implementados; ver CHANGELOG.

## Desenvolvimento local
Requer Node.js 24+, npm 11+ e PostgreSQL 17.

1. Copie `.env.example` para `.env` e preencha as senhas locais (nunca versione valores reais).
2. Crie roles e bancos (uma vez), como superusuário:
   `psql -U postgres -v owner_pw=... -v app_pw=... -f packages/db/sql/bootstrap-local.sql`
3. Aplique migrações em dev e no banco de teste:
   `npm run db:migrate` (usa `DATABASE_URL`; para o teste, defina `DATABASE_URL` com o valor de `TEST_DATABASE_URL`).

```
npm install
npm run check   # lint, typecheck, test (inclui RLS em PostgreSQL real) e build
npm run dev -w @prospect-ai/api   # http://localhost:4000/health
npm run dev -w @prospect-ai/web   # http://localhost:3000
```

Contrato HTTP: [docs/openapi.yaml](docs/openapi.yaml). Isolamento de tenants: [ADR-006](docs/adr/ADR-006-tenant-context-rls.md).

- [PRD](docs/PRD.md)
- [SRS](docs/SRS.md)
- [ARCHITECTURE](docs/ARCHITECTURE.md)
- [DATABASE](docs/DATABASE.md)
- [API](docs/API.md)
- [SCORING](docs/SCORING.md)
- [EVIDENCE](docs/EVIDENCE.md)
- [AI-ENGINE](docs/AI-ENGINE.md)
- [DATA-SOURCES](docs/DATA-SOURCES.md)
- [SECURITY](docs/SECURITY.md)
- [DESIGN-SYSTEM](docs/DESIGN-SYSTEM.md)
- [ROADMAP](docs/ROADMAP.md)
- [BACKLOG](docs/BACKLOG.md)
- [TESTING](docs/TESTING.md)
- [BENCHMARK](docs/BENCHMARK.md)
- [Schema inicial](packages/db/prisma/schema.prisma)
- [Instruções de agentes](AGENTS.md)

Comece pelo PRD, SRS e ADRs em ARCHITECTURE; implemente E01 antes dos demais.
