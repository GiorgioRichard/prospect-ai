# Especificação de requisitos
| ID | Requisito | Aceitação |
|---|---|---|
| RF01 | Workspace e membros | usuário A não acessa registros de B |
| RF02 | Perfil comercial | salvar serviços, nichos e cidades |
| RF03 | Busca/importação | retornar job, origem e erros; repetir sem duplicar |
| RF04 | Auditoria | bloquear destinos privados; registrar método e data |
| RF05 | Evidências | revisão, rejeição, expiração e histórico |
| RF06 | Score | mostrar fatores, versão e confiança separada |
| RF07 | Radar | execução semanal idempotente, filtros e feedback |
| RF08 | CRM | mudança de etapa registra autor e data |
| RF09 | Mensagens | omitir campos ausentes; confirmação manual de envio |
| RF10 | Supressão | impedir novas sugestões e preparação de contato |
| RF11 | Diagnóstico | somente evidências válidas aprovadas; versão imutável |
| RF12 | Compartilhamento | token revogável, expiração padrão 30 dias |
| RF13 | IA opcional | falha não impede operações P0 |
| RF14 | Contratos | valores contratados separados dos recebidos |
| RF15 | Billing | webhook autenticado e idempotente |
## Não funcionais
Metas propostas: p95 listagem <500 ms em ambiente piloto; disponibilidade mensal 99,5%; RPO 24h/RTO 4h. Paginação obrigatória, acessibilidade WCAG 2.2 AA, logs sem PII desnecessária, UTC no armazenamento, moeda BRL em centavos. Validar metas com carga representativa antes de lançamento.
