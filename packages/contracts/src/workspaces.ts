import { z } from "zod";

export const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
export type Role = z.infer<typeof roleSchema>;

export const paginationQuerySchema = z.object({
  cursor: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const workspaceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** Papel do usuário autenticado neste workspace. */
  role: roleSchema,
  createdAt: z.iso.datetime(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const createWorkspaceBodySchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
});
export type CreateWorkspaceBody = z.infer<typeof createWorkspaceBodySchema>;

export const memberSchema = z.object({
  userId: z.uuid(),
  role: roleSchema,
  createdAt: z.iso.datetime(),
});
export type Member = z.infer<typeof memberSchema>;

export const addMemberBodySchema = z.strictObject({
  userId: z.uuid(),
  role: roleSchema,
});
export type AddMemberBody = z.infer<typeof addMemberBodySchema>;

export const updateMemberBodySchema = z.strictObject({
  role: roleSchema,
});
export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
