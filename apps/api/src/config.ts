import { z } from "zod";

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Role app_user (sujeita a RLS). Nunca a URL do prospect_owner. */
  APP_DATABASE_URL: z.string().startsWith("postgresql://"),
  /** Ex.: https://<ref>.supabase.co/auth/v1 */
  SUPABASE_JWT_ISSUER: z.url(),
  /** Ex.: https://<ref>.supabase.co/auth/v1/.well-known/jwks.json */
  SUPABASE_JWKS_URL: z.url(),
  JWT_AUDIENCE: z.string().min(1).default("authenticated"),
});

export interface ApiConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly jwtIssuer: string;
  readonly jwksUrl: string;
  readonly jwtAudience: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): ApiConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    // prettifyError lista apenas caminhos e mensagens, não valores.
    throw new Error(`Configuração inválida: ${z.prettifyError(parsed.error)}`);
  }
  const c = parsed.data;
  return {
    port: c.PORT,
    databaseUrl: c.APP_DATABASE_URL,
    jwtIssuer: c.SUPABASE_JWT_ISSUER,
    jwksUrl: c.SUPABASE_JWKS_URL,
    jwtAudience: c.JWT_AUDIENCE,
  };
}
