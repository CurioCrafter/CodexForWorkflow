import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "./redaction";

describe("redactSensitiveText", () => {
  it("redacts API keys and emails", () => {
    const output = redactSensitiveText("token=sk-abcdefghijklmnop and user test@example.com");
    expect(output).not.toContain("sk-abcdefghijklmnop");
    expect(output).not.toContain("test@example.com");
    expect(output).toContain("[redacted-email]");
  });
});
