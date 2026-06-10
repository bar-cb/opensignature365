import { describe, it, expect } from "vitest";
import { sanitizeEmailHtml } from "../src/core/sanitize.js";

describe("sanitize", () => {
  it("strips scripts", () => {
    const out = sanitizeEmailHtml('<div>ok</div><script>alert(1)</script>');
    expect(out).not.toContain("script");
  });
  it("strips inline event handlers", () => {
    const out = sanitizeEmailHtml('<a href="#" onclick="alert(1)">x</a>');
    expect(out).not.toContain("onclick");
  });
  it("keeps inline styles and tables", () => {
    const out = sanitizeEmailHtml('<table><tr><td style="color:red">x</td></tr></table>');
    expect(out).toContain("<table");
    expect(out).toContain("color:red");
  });
});
