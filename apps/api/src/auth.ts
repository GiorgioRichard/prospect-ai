import type { RequestHandler, Response } from "express";
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { HttpError } from "./http-error.js";

export interface AuthenticatedUser {
  readonly userId: string;
}

export type TokenVerifier = (token: string) => Promise<AuthenticatedUser>;

export interface JwtVerifierOptions {
  readonly issuer: string;
  readonly audience: string;
  readonly getKey: JWTVerifyGetKey;
}

/** Apenas chaves assimétricas do Supabase; HS256 legado e `none` são rejeitados. */
const ALLOWED_ALGORITHMS = ["ES256", "RS256"];
const subjectSchema = z.uuid();

export function createJwtVerifier(options: JwtVerifierOptions): TokenVerifier {
  return async (token) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, options.getKey, {
        issuer: options.issuer,
        audience: options.audience,
        algorithms: ALLOWED_ALGORITHMS,
        requiredClaims: ["sub", "exp"],
        clockTolerance: 5,
      }));
    } catch (err) {
      if (err instanceof joseErrors.JWKSTimeout) {
        throw new HttpError("PROVIDER_UNAVAILABLE", "Provedor de autenticação indisponível");
      }
      throw new HttpError("UNAUTHENTICATED", "Token inválido ou expirado");
    }
    const sub = subjectSchema.safeParse(payload.sub);
    if (!sub.success) throw new HttpError("UNAUTHENTICATED", "Token inválido ou expirado");
    return { userId: sub.data };
  };
}

export function createRemoteJwtVerifier(issuer: string, audience: string, jwksUrl: string): TokenVerifier {
  const getKey = createRemoteJWKSet(new URL(jwksUrl), {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
  });
  return createJwtVerifier({ issuer, audience, getKey });
}

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)$/;

export function requireAuth(verifyToken: TokenVerifier): RequestHandler {
  return async (req, res, next) => {
    const match = BEARER_PATTERN.exec(req.headers.authorization ?? "");
    if (!match?.[1]) {
      next(new HttpError("UNAUTHENTICATED", "Autenticação obrigatória"));
      return;
    }
    const user = await verifyToken(match[1]);
    res.locals["userId"] = user.userId;
    next();
  };
}

export function getUserId(res: Response): string {
  const value: unknown = res.locals["userId"];
  if (typeof value !== "string") throw new HttpError("UNAUTHENTICATED", "Autenticação obrigatória");
  return value;
}
