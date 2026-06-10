import { describe, it, expect } from "vitest";
import { render, renderSignature, extractTags } from "../src/core/template-engine.js";

describe("template-engine", () => {
  const user = {
    displayName: "Jane Smith",
    jobTitle: "Head of Sales",
    mail: "jane@example.com",
    mobilePhone: "+41 79 000 00 00",
    businessPhones: ["+41 44 000 00 00"],
  };

  it("renders simple tags", () => {
    expect(render("Hi {{displayName}}!", user)).toBe("Hi Jane Smith!");
  });

  it("supports {{#if}}", () => {
    const t = "{{#if mobilePhone}}M: {{mobilePhone}}{{/if}}";
    expect(render(t, user)).toContain("+41 79");
    expect(render(t, { ...user, mobilePhone: undefined } as any)).toBe("");
  });

  it("supports fallback helper", () => {
    expect(render('{{jobTitle | fallback:"Team Member"}}', user)).toBe("Head of Sales");
    expect(render('{{notThere | fallback:"x"}}', user)).toBe("x");
  });

  it("supports array access", () => {
    expect(render("{{businessPhones.0}}", user)).toBe("+41 44 000 00 00");
  });

  it("strips unknown tags by default", () => {
    expect(render("[{{unknown}}]", user)).toBe("[]");
  });

  it("extracts tags", () => {
    const tags = extractTags("{{displayName}} {{jobTitle | fallback:\"x\"}} {{#if mobilePhone}}{{mobilePhone}}{{/if}}");
    expect(tags).toEqual(expect.arrayContaining(["displayName", "jobTitle", "mobilePhone"]));
  });

  it("renderSignature returns html, text, warnings", () => {
    const r = renderSignature("<b>{{displayName}}</b>", "{{displayName}}", user);
    expect(r.html).toBe("<b>Jane Smith</b>");
    expect(r.text).toBe("Jane Smith");
    expect(r.warnings).toEqual([]);
  });
});
