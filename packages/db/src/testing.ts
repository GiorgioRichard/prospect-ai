/**
 * Utilitários para testes de integração com PostgreSQL descartável.
 * Nunca use em runtime: `resetTestDatabase` apaga dados.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

export interface TestDatabaseEnv {
  /** Role prospect_owner: seeds e limpeza. */
  readonly ownerUrl: string;
  /** Role app_user: o que a aplicação usa (sujeita a RLS). */
  readonly appUrl: string;
}

export function loadTestDatabaseEnv(): TestDatabaseEnv {
  const rootEnv = resolve(import.meta.dirname, "../../../.env");
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

  const ownerUrl = process.env["TEST_DATABASE_URL"];
  const appUrl = process.env["TEST_APP_DATABASE_URL"];
  if (!ownerUrl || !appUrl) {
    throw new Error(
      "TEST_DATABASE_URL e TEST_APP_DATABASE_URL são obrigatórios para testes de integração (ver README).",
    );
  }
  return { ownerUrl, appUrl };
}

export async function resetTestDatabase(ownerUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ db: string }>("SELECT current_database() AS db");
    const db = rows[0]?.db ?? "";
    if (!db.endsWith("_test")) {
      throw new Error(`Recusando limpar banco que não termina em _test: ${db}`);
    }
    await client.query('TRUNCATE "Organization", "Suppression" CASCADE');
  } finally {
    await client.end();
  }
}
