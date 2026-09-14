import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from "@/lib/permissions";

describe("RBAC role/permission matrix", () => {
  it("grants the super admin every permission", () => {
    expect(new Set(ROLE_DEFINITIONS.SUPER_ADMIN.permissions)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it("never gives an internal role a client-scoped permission", () => {
    const internalRoles = Object.entries(ROLE_DEFINITIONS).filter(
      ([key]) => key !== "SUPER_ADMIN" && !ROLE_DEFINITIONS[key as keyof typeof ROLE_DEFINITIONS].isClientRole,
    );
    for (const [, definition] of internalRoles) {
      for (const permission of definition.permissions) {
        expect(permission.startsWith("client_")).toBe(false);
      }
    }
  });

  it("only gives client roles client-scoped permissions", () => {
    const clientRoles = Object.values(ROLE_DEFINITIONS).filter((r) => r.isClientRole);
    for (const definition of clientRoles) {
      for (const permission of definition.permissions) {
        expect(permission.startsWith("client_")).toBe(true);
      }
    }
  });

  it("has no duplicate permission keys", () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });
});
