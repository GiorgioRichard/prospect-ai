import { z } from "zod";
import { HttpError } from "./http-error.js";

const cursorKeySchema = z.uuid();

/** Cursor opaco: chave de ordenação (UUID) em base64url. */
export function encodeCursor(key: string): string {
  return Buffer.from(key, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined): string | undefined {
  if (cursor === undefined) return undefined;
  const parsed = cursorKeySchema.safeParse(Buffer.from(cursor, "base64url").toString("utf8"));
  if (!parsed.success) throw new HttpError("INVALID_INPUT", "Cursor inválido");
  return parsed.data;
}

/** Recebe `limit + 1` itens; devolve a página e o próximo cursor. */
export function toPage<T>(rows: T[], limit: number, keyOf: (row: T) => string) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rows.length > limit && last !== undefined ? encodeCursor(keyOf(last)) : null;
  return { items, nextCursor };
}
