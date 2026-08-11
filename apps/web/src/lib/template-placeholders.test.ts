import { describe, it, expect } from "vitest";
import { countBodyPlaceholders } from "./template-placeholders";

describe("countBodyPlaceholders", () => {
  it("returns 0 for undefined or plain text with no placeholders", () => {
    expect(countBodyPlaceholders(undefined)).toBe(0);
    expect(countBodyPlaceholders("Hello, thanks for your order.")).toBe(0);
  });

  it("counts distinct placeholders", () => {
    expect(countBodyPlaceholders("Hello {{1}}, your order {{2}} has shipped.")).toBe(2);
  });

  it("does not double-count a repeated placeholder", () => {
    expect(countBodyPlaceholders("{{1}} is your OTP. Do not share {{1}} with anyone.")).toBe(1);
  });
});
