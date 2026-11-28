-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSource" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "signalCode" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "observedValue" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verifiedBy" UUID,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "actorId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "organizationId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "contactHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("organizationId","channel","contactHash")
);

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE INDEX "Lead_organizationId_stage_createdAt_idx" ON "Lead"("organizationId", "stage", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_organizationId_id_key" ON "Lead"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSource_organizationId_provider_externalId_key" ON "LeadSource"("organizationId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "Evidence_organizationId_leadId_status_idx" ON "Evidence"("organizationId", "leadId", "status");

-- CreateIndex
CREATE INDEX "LeadEvent_organizationId_leadId_createdAt_idx" ON "LeadEvent"("organizationId", "leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadSource" ADD CONSTRAINT "LeadSource_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "Lead"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "Lead"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_organizationId_leadId_fkey" FOREIGN KEY ("organizationId", "leadId") REFERENCES "Lead"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =====================================================================
-- ADR-006: contexto de tenant e RLS (escrito à mão, revisar com cuidado)
-- Requer a role app_user existente (packages/db/sql/bootstrap-local.sql).
-- =====================================================================

CREATE SCHEMA app;

-- Usuário autenticado da transação corrente; NULL se não definido (falha fechada).
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = ''
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- SECURITY DEFINER: lê Membership como dono, evitando recursão de policies.
CREATE FUNCTION app.is_member(org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."Membership" m
      WHERE m."organizationId" = org AND m."userId" = app.current_user_id()
    )
  $$;

CREATE FUNCTION app.has_role(org uuid, roles public."Role"[]) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public."Membership" m
      WHERE m."organizationId" = org
        AND m."userId" = app.current_user_id()
        AND m."role" = ANY (roles)
    )
  $$;

-- Cria organização e OWNER atomicamente para o usuário corrente.
CREATE FUNCTION app.create_workspace(p_name text) RETURNS uuid
  LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
  AS $$
  DECLARE
    v_user uuid := app.current_user_id();
    v_org uuid := gen_random_uuid();
  BEGIN
    IF v_user IS NULL THEN
      RAISE EXCEPTION 'app.user_id não definido' USING ERRCODE = '42501';
    END IF;
    IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(btrim(p_name)) > 100 THEN
      RAISE EXCEPTION 'nome de workspace inválido' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public."Organization" ("id", "name") VALUES (v_org, btrim(p_name));
    INSERT INTO public."Membership" ("organizationId", "userId", "role")
      VALUES (v_org, v_user, 'OWNER'::public."Role");
    RETURN v_org;
  END
  $$;

REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO app_user;

-- Grants explícitos por tabela (nunca ALL TABLES: _prisma_migrations fica fora do alcance).
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, UPDATE, DELETE ON "Organization" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Membership", "Lead", "LeadSource", "Evidence", "LeadEvent", "Suppression" TO app_user;

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Suppression" ENABLE ROW LEVEL SECURITY;

-- Organization: INSERT apenas via app.create_workspace.
CREATE POLICY organization_select ON "Organization" FOR SELECT TO app_user
  USING (app.is_member("id"));
CREATE POLICY organization_update ON "Organization" FOR UPDATE TO app_user
  USING (app.has_role("id", '{OWNER,ADMIN}'))
  WITH CHECK (app.has_role("id", '{OWNER,ADMIN}'));
CREATE POLICY organization_delete ON "Organization" FOR DELETE TO app_user
  USING (app.has_role("id", '{OWNER}'));

-- Membership: regras finas (ADMIN x OWNER, último OWNER) no domínio; aqui o papel mínimo.
CREATE POLICY membership_select ON "Membership" FOR SELECT TO app_user
  USING (app.is_member("organizationId"));
CREATE POLICY membership_insert ON "Membership" FOR INSERT TO app_user
  WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN}'));
CREATE POLICY membership_update ON "Membership" FOR UPDATE TO app_user
  USING (app.has_role("organizationId", '{OWNER,ADMIN}'))
  WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN}'));
CREATE POLICY membership_delete ON "Membership" FOR DELETE TO app_user
  USING (app.has_role("organizationId", '{OWNER,ADMIN}') OR "userId" = app.current_user_id());

-- Entidades de negócio: membros leem; VIEWER não escreve; DELETE exige ADMIN+.
CREATE POLICY lead_select ON "Lead" FOR SELECT TO app_user USING (app.is_member("organizationId"));
CREATE POLICY lead_insert ON "Lead" FOR INSERT TO app_user WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY lead_update ON "Lead" FOR UPDATE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}')) WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY lead_delete ON "Lead" FOR DELETE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN}'));

CREATE POLICY lead_source_select ON "LeadSource" FOR SELECT TO app_user USING (app.is_member("organizationId"));
CREATE POLICY lead_source_insert ON "LeadSource" FOR INSERT TO app_user WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY lead_source_update ON "LeadSource" FOR UPDATE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}')) WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY lead_source_delete ON "LeadSource" FOR DELETE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN}'));

CREATE POLICY evidence_select ON "Evidence" FOR SELECT TO app_user USING (app.is_member("organizationId"));
CREATE POLICY evidence_insert ON "Evidence" FOR INSERT TO app_user WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY evidence_update ON "Evidence" FOR UPDATE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}')) WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY evidence_delete ON "Evidence" FOR DELETE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN}'));

CREATE POLICY lead_event_select ON "LeadEvent" FOR SELECT TO app_user USING (app.is_member("organizationId"));
CREATE POLICY lead_event_insert ON "LeadEvent" FOR INSERT TO app_user WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
-- LeadEvent é histórico: sem UPDATE/DELETE para app_user.

CREATE POLICY suppression_select ON "Suppression" FOR SELECT TO app_user USING (app.is_member("organizationId"));
CREATE POLICY suppression_insert ON "Suppression" FOR INSERT TO app_user WITH CHECK (app.has_role("organizationId", '{OWNER,ADMIN,MEMBER}'));
CREATE POLICY suppression_delete ON "Suppression" FOR DELETE TO app_user USING (app.has_role("organizationId", '{OWNER,ADMIN}'));
