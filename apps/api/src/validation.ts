import type { z } from "zod";
import { HttpError } from "./http-error.js";

export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(
      "INVALID_INPUT",
      "Entrada inválida",
      parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  return parsed.data;
}
