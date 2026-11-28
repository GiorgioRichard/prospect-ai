/**
 * Infra de teste da API: chaves JWT geradas no próprio teste (nenhum segredo real)
 * e banco descartável prospect_ai_test acessado pela role app_user.
 */
import { createPrismaClient, type PrismaClient } from "@prospect-ai/db";
import { loadTestDatabaseEnv, resetTestDatabase } from "@prospect-ai/db/testing";
import type { Express } from "express";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { createApp } from "../app.js";
import { createJwtVerifier } from "../auth.js";

export const TEST_ISSUER = "https://test-project.supabase.example/auth/v1";
export const TEST_AUDIENCE = "authenticated";
const KID = "test-key";

export interface TokenOptions {
  readonly issuer?: string;
  readonly audience?: string;
  readonly expiresIn?: string | number;
  readonly key?: CryptoKey;
}

export interface TestHarness {
  readonly app: Express;
  readonly prisma: PrismaClient;
  token(sub: string, options?: TokenOptions): Promise<string>;
  /** Par de chaves alheio ao JWKS confiável, com o mesmo kid. */
  readonly attackerKey: CryptoKey;
  close(): Promise<void>;
}

export async function createTestHarness(): Promise<TestHarness> {
  const env = loadTestDatabaseEnv();
  await resetTestDatabase(env.ownerUrl);

  const trusted = await generateKeyPair("ES256");
  const attacker = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(trusted.publicKey)), kid: KID, alg: "ES256", use: "sig" };
  const verifyToken = createJwtVerifier({
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    getKey: createLocalJWKSet({ keys: [jwk] }),
  });

  const prisma = createPrismaClient(env.appUrl);
  const app = createApp({ verifyToken, prisma });

  return {
    app,
    prisma,
    attackerKey: attacker.privateKey,
    token: (sub, options = {}) =>
      new SignJWT({ role: "authenticated" })
        .setProtectedHeader({ alg: "ES256", kid: KID })
        .setSubject(sub)
        .setIssuer(options.issuer ?? TEST_ISSUER)
        .setAudience(options.audience ?? TEST_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(options.expiresIn ?? "5m")
        .sign(options.key ?? trusted.privateKey),
    close: () => prisma.$disconnect(),
  };
}
