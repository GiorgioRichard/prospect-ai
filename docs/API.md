# Contratos REST v1
Prefixo `/v1/workspaces/{workspaceId}`; JWT Supabase, membership verificada no servidor. JSON, datas ISO 8601 UTC, IDs UUID, cursor opaco, limite padrão 25 máximo 100. Erro `{code,message,requestId,details?}`. 401 sem autenticação, 403 sem papel, 404 para objeto fora do tenant, 409 conflito, 422 entrada inválida, 429 quota, 503 provedor indisponível.
| Método e rota | Entrada | Saída |
|---|---|---|
| POST /search-jobs | provider, city, categories, limit | 202 jobId |
| GET /jobs/:id | — | status, progress, errors |
| POST /imports | arquivo CSV autorizado | 202 jobId |
| GET /leads | cursor, stage, service | items, nextCursor |
| POST /leads | name, source | 201 lead |
| POST /leads/:id/audits | url | 202 jobId |
| POST /evidences/:id/reviews | decision, note | evidence |
| POST /radar-runs | profileId | 202 jobId |
| PATCH /leads/:id/stage | stage, expectedVersion | lead |
| POST /leads/:id/messages | templateVersion | draft |
| POST /messages/:id/confirm | sentAt, channel | event |
| POST /suppression | channel, contact | 201 |
| POST /leads/:id/diagnostics | evidenceIds | 202 jobId |
| POST /diagnostics/:id/shares | expiresAt | shareUrl |
| DELETE /shares/:id | — | 204 |
Rotas públicas separadas GET /public/reports/:token e POST /webhooks/billing. Token não aparece em logs. Idempotency-Key obrigatório em criação de jobs e confirmações; mesma chave com payload diferente retorna 409. OpenAPI completo será produzido antes da implementação de cada épico.
