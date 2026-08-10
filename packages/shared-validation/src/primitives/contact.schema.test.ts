import { describe, it, expect } from "vitest";
import {
  emailSchema,
  gstinSchema,
  passwordSchema,
  phoneNumberSchema,
  PASSWORD_POLICY_RULES,
} from "./contact.schema";

describe("passwordSchema", () => {
  it("accepts a password meeting all rules", () => {
    expect(passwordSchema.safeParse("Passw0rd1").success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(passwordSchema.safeParse("Pass1").success).toBe(false);
  });

  it("rejects a password longer than 128 characters", () => {
    expect(passwordSchema.safeParse(`A1a${"a".repeat(126)}`).success).toBe(false);
  });

  it("rejects a password with no uppercase letter", () => {
    expect(passwordSchema.safeParse("password1").success).toBe(false);
  });

  it("rejects a password with no lowercase letter", () => {
    expect(passwordSchema.safeParse("PASSWORD1").success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    expect(passwordSchema.safeParse("Password").success).toBe(false);
  });

  it("does not require a special character", () => {
    expect(passwordSchema.safeParse("Passw0rd").success).toBe(true);
  });
});

describe("PASSWORD_POLICY_RULES", () => {
  it("has exactly 5 rules matching passwordSchema's constraints", () => {
    expect(PASSWORD_POLICY_RULES).toHaveLength(5);
  });

  it("every rule passes for a fully valid password", () => {
    expect(PASSWORD_POLICY_RULES.every((rule) => rule.test("Passw0rd1"))).toBe(true);
  });

  it("only the digit rule fails for a password missing a number", () => {
    const results = PASSWORD_POLICY_RULES.map((rule) => ({
      id: rule.id,
      passed: rule.test("Password"),
    }));
    const failed = results.filter((r) => !r.passed);
    expect(failed).toEqual([{ id: "digit", passed: false }]);
  });
});

describe("emailSchema/gstinSchema/phoneNumberSchema (pre-existing, sanity check only)", () => {
  it("emailSchema trims and lowercases", () => {
    expect(emailSchema.parse("  Test@Example.com  ")).toBe("test@example.com");
  });

  it("gstinSchema accepts empty string (optional)", () => {
    expect(gstinSchema.safeParse("").success).toBe(true);
  });

  it("phoneNumberSchema requires E.164 format", () => {
    expect(phoneNumberSchema.safeParse("9876543210").success).toBe(false);
    expect(phoneNumberSchema.safeParse("+919876543210").success).toBe(true);
  });
});
