/**
 * Regras de papéis por workspace (docs/SECURITY.md; ADR-006).
 * O RLS garante isolamento e papel mínimo; estas regras finas rodam na API.
 */
export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type WorkspaceRole = (typeof ROLES)[number];

export type MembershipDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: "FORBIDDEN" | "LAST_OWNER" };

const ALLOWED: MembershipDecision = { allowed: true };
const FORBIDDEN: MembershipDecision = { allowed: false, reason: "FORBIDDEN" };
const LAST_OWNER: MembershipDecision = { allowed: false, reason: "LAST_OWNER" };

/** Papéis que um ADMIN pode atribuir, alterar ou remover. */
const ADMIN_MANAGEABLE: ReadonlySet<WorkspaceRole> = new Set(["MEMBER", "VIEWER"]);

export function canWrite(role: WorkspaceRole): boolean {
  return role !== "VIEWER";
}

export function canManageMembers(role: WorkspaceRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function canActOn(actor: WorkspaceRole, targetRole: WorkspaceRole): boolean {
  if (actor === "OWNER") return true;
  return actor === "ADMIN" && ADMIN_MANAGEABLE.has(targetRole);
}

export function decideAddMember(actor: WorkspaceRole, newRole: WorkspaceRole): MembershipDecision {
  return canActOn(actor, newRole) ? ALLOWED : FORBIDDEN;
}

export interface RoleChange {
  readonly actor: WorkspaceRole;
  readonly currentRole: WorkspaceRole;
  readonly newRole: WorkspaceRole;
  readonly ownerCount: number;
}

export function decideChangeRole(change: RoleChange): MembershipDecision {
  const { actor, currentRole, newRole, ownerCount } = change;
  if (!canActOn(actor, currentRole) || !canActOn(actor, newRole)) return FORBIDDEN;
  if (currentRole === "OWNER" && newRole !== "OWNER" && ownerCount <= 1) return LAST_OWNER;
  return ALLOWED;
}

export interface MemberRemoval {
  readonly actor: WorkspaceRole;
  readonly isSelf: boolean;
  readonly targetRole: WorkspaceRole;
  readonly ownerCount: number;
}

/** Qualquer membro pode sair do workspace; remover outros segue a hierarquia. */
export function decideRemoveMember(removal: MemberRemoval): MembershipDecision {
  const { actor, isSelf, targetRole, ownerCount } = removal;
  if (!isSelf && !canActOn(actor, targetRole)) return FORBIDDEN;
  if (targetRole === "OWNER" && ownerCount <= 1) return LAST_OWNER;
  return ALLOWED;
}
