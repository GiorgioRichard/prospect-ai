# Modelagem de dados
O schema inicial em `../packages/db/prisma/schema.prisma` cobre o núcleo P0. Toda entidade de negócio tem organizationId; relações entre entidades devem usar chaves compostas tenant/id. Membership vincula usuário autenticado a organização. Dados externos têm proveniência e política de retenção. Não persistir campos proibidos por provedor.
## Entidades futuras
Contratos, eventos financeiros, assinaturas, planos, quotas, aceites de termos, versões de templates, feedback de radar, conflitos de evidência, auditorias e consumo de IA. Introduzir por migração quando o épico correspondente iniciar.
## RLS
Aplicar políticas SELECT/INSERT/UPDATE/DELETE por membership e papel; usar WITH CHECK. Credenciais Prisma/worker privilegiadas podem ignorar RLS: exigir autorização explícita e filtros tenant em todos os acessos, além de testes negativos. Não expor service role ao navegador. Usar constraints compostas, índices tenant/status/data e exclusão/retention por política. Storage privado com autorização por objeto.
## Migração
Gerar SQL em ambiente descartável, revisar constraints e políticas, testar dois tenants e rollback/restauração. Schema é proposta não validada pelo CLI.
