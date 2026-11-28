import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 não carrega .env automaticamente; usamos o .env da raiz do monorepo se existir.
const rootEnv = resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// `validate` e `generate` não acessam o banco. Migrações usam DATABASE_URL (role prospect_owner)
// e só devem rodar em banco descartável ou com autorização explícita.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env["DATABASE_URL"] ?? "",
  },
});
