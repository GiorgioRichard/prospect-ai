import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiErrorSchema, healthResponseSchema } from "@prospect-ai/contracts";
import { loadConfig } from "./config.js";
import { createTestHarness, type TestHarness } from "./testing/harness.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let h: TestHarness;
beforeAll(async () => {
  h = await createTestHarness();
});
afterAll(async () => {
  await h.close();
});

describe("API base", () => {
  it("GET /health responde ok com X-Request-Id", async () => {
    const res = await request(h.app).get("/health");
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toEqual({ status: "ok" });
    expect(res.headers["x-request-id"]).toMatch(UUID_PATTERN);
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("ignora X-Request-Id enviado pelo cliente", async () => {
    const res = await request(h.app).get("/health").set("X-Request-Id", "forjado");
    expect(res.headers["x-request-id"]).not.toBe("forjado");
  });

  it("rota inexistente retorna envelope 404", async () => {
    const res = await request(h.app).get("/nao-existe");
    expect(res.status).toBe(404);
    const body = apiErrorSchema.parse(res.body);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.requestId).toBe(res.headers["x-request-id"]);
  });

  it("JSON malformado retorna 422 INVALID_INPUT", async () => {
    const res = await request(h.app)
      .post("/v1/workspaces")
      .set("Authorization", `Bearer ${await h.token(randomUUID())}`)
      .set("Content-Type", "application/json")
      .send("{invalido");
    expect(res.status).toBe(422);
    expect(apiErrorSchema.parse(res.body).code).toBe("INVALID_INPUT");
  });
});

describe("loadConfig", () => {
  const valid = {
    APP_DATABASE_URL: "postgresql://app_user:x@localhost:5432/db",
    SUPABASE_JWT_ISSUER: "https://ref.supabase.co/auth/v1",
    SUPABASE_JWKS_URL: "https://ref.supabase.co/auth/v1/.well-known/jwks.json",
  };

  it("aplica padrões de porta e audience", () => {
    const config = loadConfig(valid);
    expect(config.port).toBe(4000);
    expect(config.jwtAudience).toBe("authenticated");
  });

  it("rejeita porta inválida e variáveis ausentes sem expor valores", () => {
    expect(() => loadConfig({ ...valid, PORT: "abc" })).toThrow(/Configuração inválida/);
    expect(() => loadConfig({})).toThrow(/APP_DATABASE_URL/);
    try {
      loadConfig({ ...valid, SUPABASE_JWKS_URL: "segredo-nao-url" });
    } catch (err) {
      expect(String(err)).not.toContain("segredo-nao-url");
    }
  });
});
