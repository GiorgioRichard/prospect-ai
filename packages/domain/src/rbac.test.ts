import { describe, expect, it } from "vitest";
import {
  canManageMembers,
  canWrite,
  decideAddMember,
  decideChangeRole,
  decideRemoveMember,
  type WorkspaceRole,
} from "./rbac.js";

const ok = { allowed: true };
const forbidden = { allowed: false, reason: "FORBIDDEN" };
const lastOwner = { allowed: false, reason: "LAST_OWNER" };

describe("permissões básicas", () => {
  it("VIEWER não escreve; só OWNER/ADMIN gerenciam membros", () => {
    expect(canWrite("VIEWER")).toBe(false);
    expect(canWrite("MEMBER")).toBe(true);
    expect((["OWNER", "ADMIN", "MEMBER", "VIEWER"] as WorkspaceRole[]).map(canManageMembers)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});

describe("decideAddMember", () => {
  it.each([
    ["OWNER", "OWNER", ok],
    ["OWNER", "ADMIN", ok],
    ["ADMIN", "MEMBER", ok],
    ["ADMIN", "VIEWER", ok],
    ["ADMIN", "ADMIN", forbidden],
    ["ADMIN", "OWNER", forbidden],
    ["MEMBER", "VIEWER", forbidden],
    ["VIEWER", "VIEWER", forbidden],
  ] as const)("%s adicionando %s", (actor, role, expected) => {
    expect(decideAddMember(actor, role)).toEqual(expected);
  });
});

describe("decideChangeRole", () => {
  it("impede rebaixar o último OWNER", () => {
    expect(
      decideChangeRole({ actor: "OWNER", currentRole: "OWNER", newRole: "ADMIN", ownerCount: 1 }),
    ).toEqual(lastOwner);
  });

  it("permite rebaixar OWNER quando há outro", () => {
    expect(
      decideChangeRole({ actor: "OWNER", currentRole: "OWNER", newRole: "ADMIN", ownerCount: 2 }),
    ).toEqual(ok);
  });

  it("ADMIN não promove a ADMIN nem altera ADMIN", () => {
    expect(
      decideChangeRole({ actor: "ADMIN", currentRole: "MEMBER", newRole: "ADMIN", ownerCount: 1 }),
    ).toEqual(forbidden);
    expect(
      decideChangeRole({ actor: "ADMIN", currentRole: "ADMIN", newRole: "MEMBER", ownerCount: 1 }),
    ).toEqual(forbidden);
  });

  it("ADMIN alterna MEMBER e VIEWER", () => {
    expect(
      decideChangeRole({ actor: "ADMIN", currentRole: "MEMBER", newRole: "VIEWER", ownerCount: 1 }),
    ).toEqual(ok);
  });
});

describe("decideRemoveMember", () => {
  it("qualquer membro pode sair, exceto o último OWNER", () => {
    expect(
      decideRemoveMember({ actor: "VIEWER", isSelf: true, targetRole: "VIEWER", ownerCount: 1 }),
    ).toEqual(ok);
    expect(
      decideRemoveMember({ actor: "OWNER", isSelf: true, targetRole: "OWNER", ownerCount: 1 }),
    ).toEqual(lastOwner);
  });

  it("MEMBER não remove outros; ADMIN não remove OWNER", () => {
    expect(
      decideRemoveMember({ actor: "MEMBER", isSelf: false, targetRole: "VIEWER", ownerCount: 1 }),
    ).toEqual(forbidden);
    expect(
      decideRemoveMember({ actor: "ADMIN", isSelf: false, targetRole: "OWNER", ownerCount: 2 }),
    ).toEqual(forbidden);
  });
});
