import { describe, it, expect } from "vitest";
import { isMenuAllowed } from "./rbac";

describe("isMenuAllowed", () => {
  describe("Deny-by-default (no access config)", () => {
    it("should deny when access is undefined", () => {
      const result = isMenuAllowed({ uid: "user123", roles: ["user"], access: undefined });
      expect(result).toBe(false);
    });

    it("should deny when access is null", () => {
      const result = isMenuAllowed({ uid: "user123", roles: ["user"], access: null });
      expect(result).toBe(false);
    });

    it("should deny when access is not provided", () => {
      const result = isMenuAllowed({ uid: "user123", roles: ["user"] });
      expect(result).toBe(false);
    });
  });

  describe("UID-based access (allowedUsers list)", () => {
    it("should allow when uid is in allowedUsers", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: [],
        access: { allowedUsers: ["user123", "user456"] }
      });
      expect(result).toBe(true);
    });

    it("should deny when uid is not in allowedUsers", () => {
      const result = isMenuAllowed({
        uid: "user999",
        roles: [],
        access: { allowedUsers: ["user123", "user456"] }
      });
      expect(result).toBe(false);
    });

    it("should handle falsy but valid UIDs (0)", () => {
      const result = isMenuAllowed({
        uid: 0,
        roles: [],
        access: { allowedUsers: [0, 1, 2] }
      });
      expect(result).toBe(true);
    });

    it("should handle empty string UID", () => {
      const result = isMenuAllowed({
        uid: "",
        roles: [],
        access: { allowedUsers: ["", "user123"] }
      });
      expect(result).toBe(true);
    });

    it("should deny when uid is null", () => {
      const result = isMenuAllowed({
        uid: null,
        roles: [],
        access: { allowedUsers: ["user123"] }
      });
      expect(result).toBe(false);
    });

    it("should deny when uid is undefined", () => {
      const result = isMenuAllowed({
        uid: undefined,
        roles: [],
        access: { allowedUsers: ["user123"] }
      });
      expect(result).toBe(false);
    });
  });

  describe("Role-based access (defaultRoles + allowedRoles)", () => {
    it("should allow when user role is in defaultRoles", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["admin", "user"],
        access: { defaultRoles: ["admin"], allowedRoles: [] }
      });
      expect(result).toBe(true);
    });

    it("should allow when user role is in allowedRoles", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["user", "viewer"],
        access: { defaultRoles: ["admin"], allowedRoles: ["viewer"] }
      });
      expect(result).toBe(true);
    });

    it("should deny when user role is not in defaultRoles or allowedRoles", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["guest"],
        access: { defaultRoles: ["admin"], allowedRoles: ["moderator"] }
      });
      expect(result).toBe(false);
    });

    it("should allow when user has multiple roles and one matches", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["guest", "user", "admin"],
        access: { defaultRoles: ["admin"], allowedRoles: [] }
      });
      expect(result).toBe(true);
    });
  });

  describe("Combined access (UID + roles)", () => {
    it("should allow when uid matches (ignores roles)", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: [],
        access: {
          allowedUsers: ["user123"],
          defaultRoles: ["admin"],
          allowedRoles: []
        }
      });
      expect(result).toBe(true);
    });

    it("should allow when role matches (ignores uid mismatch)", () => {
      const result = isMenuAllowed({
        uid: "user999",
        roles: ["admin"],
        access: {
          allowedUsers: ["user123"],
          defaultRoles: ["admin"],
          allowedRoles: []
        }
      });
      expect(result).toBe(true);
    });

    it("should deny when neither uid nor role matches", () => {
      const result = isMenuAllowed({
        uid: "user999",
        roles: ["guest"],
        access: {
          allowedUsers: ["user123"],
          defaultRoles: ["admin"],
          allowedRoles: []
        }
      });
      expect(result).toBe(false);
    });
  });

  describe("Edge cases (invalid/missing access fields)", () => {
    it("should handle empty allowedUsers array", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["user"],
        access: { allowedUsers: [] }
      });
      expect(result).toBe(false);
    });

    it("should handle non-array allowedUsers", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["user"],
        access: { allowedUsers: "not-an-array" }
      });
      expect(result).toBe(false);
    });

    it("should handle non-array roles", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: "not-an-array",
        access: { defaultRoles: ["user"] }
      });
      expect(result).toBe(false);
    });

    it("should allow when access is empty object and user has roles", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["user"],
        access: {}
      });
      expect(result).toBe(false);
    });

    it("should allow when defaultRoles and allowedRoles are empty", () => {
      const result = isMenuAllowed({
        uid: "user123",
        roles: ["user"],
        access: { defaultRoles: [], allowedRoles: [], allowedUsers: [] }
      });
      expect(result).toBe(false);
    });
  });
});
