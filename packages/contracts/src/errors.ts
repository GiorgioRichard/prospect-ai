import { z } from "zod";

/** Códigos de erro do envelope `{code,message,requestId,details?}` (docs/API.md). */
export const apiErrorCodeSchema = z.enum([
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "INVALID_INPUT",
  "QUOTA_EXCEEDED",
  "PROVIDER_UNAVAILABLE",
  "INTERNAL",
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const API_ERROR_HTTP_STATUS: Readonly<Record<ApiErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_INPUT: 422,
  QUOTA_EXCEEDED: 429,
  PROVIDER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  requestId: z.uuid(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
