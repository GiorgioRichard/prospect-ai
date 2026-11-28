import { describe, expect, it } from "vitest";
import { apiErrorSchema } from "./errors.js";

describe("apiErrorSchema", () => {
  it("aceita envelope válido", () => {
    const result = apiErrorSchema.safeParse({
      code: "NOT_FOUND",
      message: "Rota não encontrada",
      requestId: "3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita código desconhecido e requestId inválido", () => {
    expect(
      apiErrorSchema.safeParse({ code: "TEAPOT", message: "x", requestId: "abc" }).success,
    ).toBe(false);
  });
});
