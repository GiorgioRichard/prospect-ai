import { createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiErrorSchema } from "@prospect-ai/contracts";
import { TEST_AUDIENCE, TEST_ISSUER, createTestHarness, type TestHarness } from "./testing/harness.js";

let h: TestHarness;
beforeAll(async () => {
  h = await createTestHarness();
});
afterAll(async () => {
  await h.close();
});

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const claims = () => ({
  sub: randomUUID(),
  iss: TEST_ISSUER,
  aud: TEST_AUDIENCE,
  exp: Math.floor(Date.now() / 1000) + 300,
});

async function expect401(authorization: string | undefined) {
  const req = request(h.app).get("/v1/workspaces");
  const res = await (authorization === undefined ? req : req.set("Authorization", authorization));
  expect(res.status).toBe(401);
  expect(apiErrorSchema.parse(res.body).code).toBe("UNAUTHENTICATED");
}

describe("autenticação JWT", () => {
  it("aceita token válido", async () => {
    const res = await request(h.app)
      .get("/v1/workspaces")
      .set("Authorization", `Bearer ${await h.token(randomUUID())}`);
    expect(res.status).toBe(200);
  });

  it("rejeita ausência de token e formato inválido", async () => {
    await expect401(undefined);
    await expect401("Basic abc");
    await expect401("Bearer nao-e-jwt");
  });

  it("rejeita token expirado", async () => {
    await expect401(`Bearer ${await h.token(randomUUID(), { expiresIn: Math.floor(Date.now() / 1000) - 60 })}`);
  });

  it("rejeita issuer e audience incorretos", async () => {
    await expect401(`Bearer ${await h.token(randomUUID(), { issuer: "https://evil.example/auth/v1" })}`);
    await expect401(`Bearer ${await h.token(randomUUID(), { audience: "anon" })}`);
  });

  it("rejeita assinatura de chave não confiável com o mesmo kid", async () => {
    await expect401(`Bearer ${await h.token(randomUUID(), { key: h.attackerKey })}`);
  });

  it("rejeita alg none e HS256", async () => {
    await expect401(`Bearer ${b64({ alg: "none", typ: "JWT" })}.${b64(claims())}.`);
    const unsigned = `${b64({ alg: "HS256", typ: "JWT", kid: "test-key" })}.${b64(claims())}`;
    const signature = createHmac("sha256", "qualquer-segredo").update(unsigned).digest("base64url");
    await expect401(`Bearer ${unsigned}.${signature}`);
  });

  it("rejeita sub que não é UUID", async () => {
    await expect401(`Bearer ${await h.token("usuario-123")}`);
  });
});
