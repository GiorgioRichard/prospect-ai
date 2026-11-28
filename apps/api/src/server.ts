import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createPrismaClient } from "@prospect-ai/db";
import { createApp } from "./app.js";
import { createRemoteJwtVerifier } from "./auth.js";
import { loadConfig } from "./config.js";

const rootEnv = resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config = loadConfig(process.env);
const prisma = createPrismaClient(config.databaseUrl);
const verifyToken = createRemoteJwtVerifier(config.jwtIssuer, config.jwtAudience, config.jwksUrl);

const server = createApp({ verifyToken, prisma }).listen(config.port, () => {
  console.info(`[api] ouvindo na porta ${config.port}`);
});

function shutdown(signal: string): void {
  console.info(`[api] ${signal} recebido, encerrando`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
