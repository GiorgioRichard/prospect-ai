import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  memberSchema,
  pageSchema,
  workspaceSchema,
  type Role,
  type Workspace,
} from "@prospect-ai/contracts";
import { createTestHarness, type TestHarness } from "./testing/harness.js";

let h: TestHarness;
const ownerA = randomUUID();
const ownerB = randomUUID();
const viewerA = randomUUID();
const adminA = randomUUID();
let wsA: Workspace;
let wsB: Workspace;

const auth = async (userId: string) => `Bearer ${await h.token(userId)}`;

async function call(method: "get" | "post" | "patch" | "delete", path: string, userId: string, body?: object) {
  const req = request(h.app)[method](path).set("Authorization", await auth(userId));
  return body === undefined ? req : req.send(body);
}

async function addMember(ws: string, actor: string, userId: string, role: Role) {
  return call("post", `/v1/workspaces/${ws}/members`, actor, { userId, role });
}

function errorCode(res: request.Response) {
  return apiErrorSchema.parse(res.body).code;
}

beforeAll(async () => {
  h = await createTestHarness();
  const resA = await call("post", "/v1/workspaces", ownerA, { name: "Agência A" });
  const resB = await call("post", "/v1/workspaces", ownerB, { name: "Agência B" });
  expect(resA.status).toBe(201);
  expect(resB.status).toBe(201);
  wsA = workspaceSchema.parse(resA.body);
  wsB = workspaceSchema.parse(resB.body);
  expect((await addMember(wsA.id, ownerA, viewerA, "VIEWER")).status).toBe(201);
  expect((await addMember(wsA.id, ownerA, adminA, "ADMIN")).status).toBe(201);
});

afterAll(async () => {
  await h.close();
});

describe("workspaces", () => {
  it("criador vira OWNER e nome é normalizado", async () => {
    const res = await call("post", "/v1/workspaces", ownerA, { name: "  Estúdio  " });
    expect(res.status).toBe(201);
    expect(workspaceSchema.parse(res.body)).toMatchObject({ name: "Estúdio", role: "OWNER" });
  });

  it("valida corpo de criação", async () => {
    expect(errorCode(await call("post", "/v1/workspaces", ownerA, { name: "" }))).toBe("INVALID_INPUT");
    expect(errorCode(await call("post", "/v1/workspaces", ownerA, { name: "x", extra: 1 }))).toBe(
      "INVALID_INPUT",
    );
  });

  it("lista apenas workspaces do usuário, com papel", async () => {
    const res = await call("get", "/v1/workspaces", viewerA);
    const page = pageSchema(workspaceSchema).parse(res.body);
    expect(page.items).toEqual([{ ...wsA, role: "VIEWER" }]);
    expect(page.nextCursor).toBeNull();
  });

  it("pagina por cursor e rejeita cursor inválido", async () => {
    const first = pageSchema(workspaceSchema).parse((await call("get", "/v1/workspaces?limit=1", ownerA)).body);
    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).not.toBeNull();
    const second = pageSchema(workspaceSchema).parse(
      (await call("get", `/v1/workspaces?limit=1&cursor=${first.nextCursor}`, ownerA)).body,
    );
    expect(second.items).toHaveLength(1);
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);

    expect(errorCode(await call("get", "/v1/workspaces?cursor=lixo", ownerA))).toBe("INVALID_INPUT");
    expect(errorCode(await call("get", "/v1/workspaces?limit=101", ownerA))).toBe("INVALID_INPUT");
  });
});

describe("isolamento entre tenants (negativos)", () => {
  it("A não vê workspace B: 404 em todas as rotas", async () => {
    const base = `/v1/workspaces/${wsB.id}`;
    const responses = [
      await call("get", base, ownerA),
      await call("get", `${base}/members`, ownerA),
      await addMember(wsB.id, ownerA, randomUUID(), "MEMBER"),
      await addMember(wsB.id, ownerA, ownerA, "OWNER"),
      await call("patch", `${base}/members/${ownerB}`, ownerA, { role: "VIEWER" }),
      await call("delete", `${base}/members/${ownerB}`, ownerA),
    ];
    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(errorCode(res)).toBe("NOT_FOUND");
    }
  });

  it("workspace inexistente também é 404 e ID inválido é 422", async () => {
    expect((await call("get", `/v1/workspaces/${randomUUID()}`, ownerA)).status).toBe(404);
    expect((await call("get", "/v1/workspaces/nao-uuid", ownerA)).status).toBe(422);
  });

  it("dados de B permanecem intactos", async () => {
    const res = await call("get", `/v1/workspaces/${wsB.id}/members`, ownerB);
    const page = pageSchema(memberSchema).parse(res.body);
    expect(page.items.map((m) => [m.userId, m.role])).toEqual([[ownerB, "OWNER"]]);
  });
});

describe("RBAC de membros", () => {
  it("VIEWER lê membros mas não gerencia", async () => {
    expect((await call("get", `/v1/workspaces/${wsA.id}/members`, viewerA)).status).toBe(200);
    expect(errorCode(await addMember(wsA.id, viewerA, randomUUID(), "VIEWER"))).toBe("FORBIDDEN");
    expect(errorCode(await call("patch", `/v1/workspaces/${wsA.id}/members/${adminA}`, viewerA, { role: "VIEWER" }))).toBe(
      "FORBIDDEN",
    );
  });

  it("ADMIN gerencia MEMBER/VIEWER, mas não ADMIN/OWNER", async () => {
    const newcomer = randomUUID();
    expect((await addMember(wsA.id, adminA, newcomer, "MEMBER")).status).toBe(201);
    expect(errorCode(await addMember(wsA.id, adminA, randomUUID(), "ADMIN"))).toBe("FORBIDDEN");
    expect(errorCode(await call("patch", `/v1/workspaces/${wsA.id}/members/${ownerA}`, adminA, { role: "VIEWER" }))).toBe(
      "FORBIDDEN",
    );
    expect(errorCode(await call("delete", `/v1/workspaces/${wsA.id}/members/${ownerA}`, adminA))).toBe("FORBIDDEN");

    const patched = await call("patch", `/v1/workspaces/${wsA.id}/members/${newcomer}`, adminA, { role: "VIEWER" });
    expect(memberSchema.parse(patched.body).role).toBe("VIEWER");
    expect((await call("delete", `/v1/workspaces/${wsA.id}/members/${newcomer}`, adminA)).status).toBe(204);
  });

  it("membro duplicado retorna 409", async () => {
    expect(errorCode(await addMember(wsA.id, ownerA, viewerA, "MEMBER"))).toBe("CONFLICT");
  });

  it("último OWNER não pode ser rebaixado nem sair", async () => {
    expect(errorCode(await call("patch", `/v1/workspaces/${wsA.id}/members/${ownerA}`, ownerA, { role: "ADMIN" }))).toBe(
      "CONFLICT",
    );
    expect(errorCode(await call("delete", `/v1/workspaces/${wsA.id}/members/${ownerA}`, ownerA))).toBe("CONFLICT");
  });

  it("com dois OWNERs, um pode rebaixar o outro", async () => {
    const secondOwner = randomUUID();
    expect((await addMember(wsA.id, ownerA, secondOwner, "OWNER")).status).toBe(201);
    const res = await call("patch", `/v1/workspaces/${wsA.id}/members/${secondOwner}`, ownerA, { role: "ADMIN" });
    expect(memberSchema.parse(res.body).role).toBe("ADMIN");
  });

  it("qualquer membro pode sair; depois perde o acesso", async () => {
    const leaver = randomUUID();
    await addMember(wsA.id, ownerA, leaver, "VIEWER");
    expect((await call("delete", `/v1/workspaces/${wsA.id}/members/${leaver}`, leaver)).status).toBe(204);
    expect((await call("get", `/v1/workspaces/${wsA.id}`, leaver)).status).toBe(404);
  });
});
