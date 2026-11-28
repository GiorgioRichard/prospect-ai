import { randomUUID } from "node:crypto";
import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
  type Response,
} from "express";
import type { ApiError, HealthResponse } from "@prospect-ai/contracts";
import type { PrismaClient } from "@prospect-ai/db";
import { requireAuth, type TokenVerifier } from "./auth.js";
import { HttpError } from "./http-error.js";
import { createWorkspacesRouter } from "./workspaces.js";

export interface AppDependencies {
  readonly verifyToken: TokenVerifier;
  readonly prisma: PrismaClient;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(assignRequestId);
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    const body: HealthResponse = { status: "ok" };
    res.json(body);
  });

  app.use("/v1/workspaces", requireAuth(deps.verifyToken), createWorkspacesRouter(deps.prisma));

  app.use((_req, _res, next) => {
    next(new HttpError("NOT_FOUND", "Rota não encontrada"));
  });
  app.use(handleError);

  return app;
}

/** Sempre gera um ID novo: não confiamos em cabeçalhos de request ID vindos do cliente. */
const assignRequestId: RequestHandler = (_req, res, next) => {
  const requestId = randomUUID();
  res.locals["requestId"] = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
};

function getRequestId(res: Response): string {
  const value: unknown = res.locals["requestId"];
  return typeof value === "string" ? value : randomUUID();
}

const handleError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const requestId = getRequestId(res);
  const httpError = toHttpError(err);

  if (httpError.code === "INTERNAL") {
    // Registra apenas tipo e requestId; payloads e tokens podem conter dados sensíveis.
    console.error(`[api] erro interno requestId=${requestId}`, err instanceof Error ? err.name : typeof err);
  }

  const body: ApiError = {
    code: httpError.code,
    message: httpError.message,
    requestId,
    ...(httpError.details === undefined ? {} : { details: httpError.details }),
  };
  res.status(httpError.status).json(body);
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (isBodyParserError(err, "entity.parse.failed")) {
    return new HttpError("INVALID_INPUT", "JSON inválido");
  }
  if (isBodyParserError(err, "entity.too.large")) {
    return new HttpError("INVALID_INPUT", "Corpo da requisição excede o limite");
  }
  return new HttpError("INTERNAL", "Erro interno");
}

function isBodyParserError(err: unknown, type: string): boolean {
  return typeof err === "object" && err !== null && "type" in err && err.type === type;
}
