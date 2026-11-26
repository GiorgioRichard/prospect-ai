# Backlog executável
| ID | Prioridade | Entrega | Dependência | Aceitação |
|---|---|---|---|---|
| E01 | P0 | monorepo/CI | — | build e testes verdes |
| E02 | P0 | Auth/workspace/RBAC | E01 | testes cross-tenant negativos |
| E03 | P0 | perfil comercial | E02 | serviços e regiões persistidos |
| E04 | P0 | OSM/CSV/jobs | E03 | erros parciais e dedup |
| E05 | P0 | auditoria isolada | E04 | SSRF bloqueado |
| E06 | P0 | revisão evidências | E05 | expiração e histórico |
| E07 | P0 | score/radar semanal | E06 | score reproduzível |
| E08 | P0 | pipeline | E04 | histórico e concorrência |
| E09 | P0 | supressão/mensagens/followups | E08 | opt-out bloqueia contato |
| E10 | P0 | PDF/share | E06 | versão e revogação |
| E11 | P0 | piloto | E07–E10 | métricas e decisão go/no-go |
| E12 | P1 | IA opcional | E11 | fallback e budget |
| E13 | P1 | white label/analytics | E10 | valores e origem corretos |
| E14 | P2 | billing | E02 | webhook duplicado seguro |
| E15 | P2 | propostas/agentes | E12 | aprovação humana |
Definition of done: requisitos rastreados, testes, revisão, migração segura, documentação, acessibilidade e observabilidade; nenhum segredo ou dado real em fixtures.
