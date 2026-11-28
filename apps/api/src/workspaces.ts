import { Router } from "express";
import { z } from "zod";
import {
  addMemberBodySchema,
  createWorkspaceBodySchema,
  paginationQuerySchema,
  updateMemberBodySchema,
  type Member,
  type Page,
  type Workspace,
} from "@prospect-ai/contracts";
import {
  isUniqueViolation,
  withUserContext,
  type PrismaClient,
  type Role,
  type TenantTx,
} from "@prospect-ai/db";
import {
  canManageMembers,
  decideAddMember,
  decideChangeRole,
  decideRemoveMember,
  type MembershipDecision,
} from "@prospect-ai/domain";
import { getUserId } from "./auth.js";
import { HttpError } from "./http-error.js";
import { decodeCursor, toPage } from "./pagination.js";
import { parseInput } from "./validation.js";

const workspaceParamsSchema = z.object({ workspaceId: z.uuid() });
const memberParamsSchema = z.object({ workspaceId: z.uuid(), userId: z.uuid() });

interface MembershipRow {
  userId: string;
  role: Role;
  createdAt: Date;
}

function toMember(row: MembershipRow): Member {
  return { userId: row.userId, role: row.role, createdAt: row.createdAt.toISOString() };
}

/** Papel do usuário no workspace. Fora do tenant (ou inexistente) => 404, sem revelar existência. */
async function requireActorRole(tx: TenantTx, workspaceId: string, userId: string): Promise<Role> {
  const membership = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId: workspaceId, userId } },
    select: { role: true },
  });
  if (!membership) throw new HttpError("NOT_FOUND", "Workspace não encontrado");
  return membership.role;
}

async function requireMember(tx: TenantTx, workspaceId: string, userId: string): Promise<MembershipRow> {
  const member = await tx.membership.findUnique({
    where: { organizationId_userId: { organizationId: workspaceId, userId } },
    select: { userId: true, role: true, createdAt: true },
  });
  if (!member) throw new HttpError("NOT_FOUND", "Membro não encontrado");
  return member;
}

/** Conta OWNERs com lock de linha para evitar que dois rebaixamentos simultâneos zerem os OWNERs. */
async function countOwnersForUpdate(tx: TenantTx, workspaceId: string): Promise<number> {
  const rows = await tx.$queryRaw<{ userId: string }[]>`
    SELECT "userId" FROM "Membership"
    WHERE "organizationId" = ${workspaceId}::uuid AND "role" = 'OWNER'
    FOR UPDATE`;
  return rows.length;
}

function enforce(decision: MembershipDecision): void {
  if (decision.allowed) return;
  if (decision.reason === "LAST_OWNER") {
    throw new HttpError("CONFLICT", "O workspace precisa de pelo menos um OWNER");
  }
  throw new HttpError("FORBIDDEN", "Papel insuficiente para esta operação");
}

export function createWorkspacesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const userId = getUserId(res);
    const query = parseInput(paginationQuerySchema, req.query);
    const after = decodeCursor(query.cursor);

    const rows = await withUserContext(prisma, userId, (tx) =>
      tx.membership.findMany({
        where: { userId, ...(after ? { organizationId: { gt: after } } : {}) },
        orderBy: { organizationId: "asc" },
        take: query.limit + 1,
        select: { role: true, organization: { select: { id: true, name: true, createdAt: true } } },
      }),
    );

    const page = toPage(rows, query.limit, (row) => row.organization.id);
    const body: Page<Workspace> = {
      items: page.items.map((row) => ({
        id: row.organization.id,
        name: row.organization.name,
        role: row.role,
        createdAt: row.organization.createdAt.toISOString(),
      })),
      nextCursor: page.nextCursor,
    };
    res.json(body);
  });

  router.post("/", async (req, res) => {
    const userId = getUserId(res);
    const { name } = parseInput(createWorkspaceBodySchema, req.body);

    const org = await withUserContext(prisma, userId, async (tx) => {
      const created = await tx.$queryRaw<{ id: string }[]>`SELECT app.create_workspace(${name}) AS id`;
      const id = created[0]?.id;
      if (!id) throw new HttpError("INTERNAL", "Erro interno");
      return tx.organization.findUniqueOrThrow({ where: { id } });
    });

    const body: Workspace = {
      id: org.id,
      name: org.name,
      role: "OWNER",
      createdAt: org.createdAt.toISOString(),
    };
    res.status(201).json(body);
  });

  router.get("/:workspaceId", async (req, res) => {
    const userId = getUserId(res);
    const { workspaceId } = parseInput(workspaceParamsSchema, req.params);

    const body = await withUserContext(prisma, userId, async (tx): Promise<Workspace> => {
      const role = await requireActorRole(tx, workspaceId, userId);
      const org = await tx.organization.findUniqueOrThrow({ where: { id: workspaceId } });
      return { id: org.id, name: org.name, role, createdAt: org.createdAt.toISOString() };
    });
    res.json(body);
  });

  router.get("/:workspaceId/members", async (req, res) => {
    const userId = getUserId(res);
    const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
    const query = parseInput(paginationQuerySchema, req.query);
    const after = decodeCursor(query.cursor);

    const rows = await withUserContext(prisma, userId, async (tx) => {
      await requireActorRole(tx, workspaceId, userId);
      return tx.membership.findMany({
        where: { organizationId: workspaceId, ...(after ? { userId: { gt: after } } : {}) },
        orderBy: { userId: "asc" },
        take: query.limit + 1,
        select: { userId: true, role: true, createdAt: true },
      });
    });

    const page = toPage(rows, query.limit, (row) => row.userId);
    const body: Page<Member> = { items: page.items.map(toMember), nextCursor: page.nextCursor };
    res.json(body);
  });

  router.post("/:workspaceId/members", async (req, res) => {
    const userId = getUserId(res);
    const { workspaceId } = parseInput(workspaceParamsSchema, req.params);
    const input = parseInput(addMemberBodySchema, req.body);

    const created = await withUserContext(prisma, userId, async (tx) => {
      const actor = await requireActorRole(tx, workspaceId, userId);
      enforce(decideAddMember(actor, input.role));
      try {
        return await tx.membership.create({
          data: { organizationId: workspaceId, userId: input.userId, role: input.role },
          select: { userId: true, role: true, createdAt: true },
        });
      } catch (err) {
        if (isUniqueViolation(err)) throw new HttpError("CONFLICT", "Usuário já é membro");
        throw err;
      }
    });
    res.status(201).json(toMember(created));
  });

  router.patch("/:workspaceId/members/:userId", async (req, res) => {
    const userId = getUserId(res);
    const params = parseInput(memberParamsSchema, req.params);
    const { role: newRole } = parseInput(updateMemberBodySchema, req.body);

    const updated = await withUserContext(prisma, userId, async (tx) => {
      const actor = await requireActorRole(tx, params.workspaceId, userId);
      if (!canManageMembers(actor)) enforce({ allowed: false, reason: "FORBIDDEN" });
      const target = await requireMember(tx, params.workspaceId, params.userId);
      const ownerCount = target.role === "OWNER" ? await countOwnersForUpdate(tx, params.workspaceId) : 0;
      enforce(decideChangeRole({ actor, currentRole: target.role, newRole, ownerCount }));
      return tx.membership.update({
        where: { organizationId_userId: { organizationId: params.workspaceId, userId: params.userId } },
        data: { role: newRole },
        select: { userId: true, role: true, createdAt: true },
      });
    });
    res.json(toMember(updated));
  });

  router.delete("/:workspaceId/members/:userId", async (req, res) => {
    const userId = getUserId(res);
    const params = parseInput(memberParamsSchema, req.params);
    const isSelf = params.userId === userId;

    await withUserContext(prisma, userId, async (tx) => {
      const actor = await requireActorRole(tx, params.workspaceId, userId);
      if (!isSelf && !canManageMembers(actor)) enforce({ allowed: false, reason: "FORBIDDEN" });
      const target = await requireMember(tx, params.workspaceId, params.userId);
      const ownerCount = target.role === "OWNER" ? await countOwnersForUpdate(tx, params.workspaceId) : 0;
      enforce(decideRemoveMember({ actor, isSelf, targetRole: target.role, ownerCount }));
      await tx.membership.delete({
        where: { organizationId_userId: { organizationId: params.workspaceId, userId: params.userId } },
      });
    });
    res.status(204).end();
  });

  return router;
}
