import { describe, it, expect } from "vitest";
import { templates } from "../src/core/storage.js";
import { render } from "../src/core/template-engine.js";

const sampleUser = {
  displayName: "Jane Smith", jobTitle: "Head of Sales",
  department: "Sales", companyName: "Example Corp", mail: "jane@example.com",
  mobilePhone: "+41 79 000 00 00", officeLocation: "Zurich", country: "Switzerland",
  streetAddress: "Bahnhofstrasse 1", postalCode: "8001", city: "Zurich",
};

describe("built-in templates", () => {
  it("ships at least 15 templates", () => {
    expect(templates.list().length).toBeGreaterThanOrEqual(15);
  });
  it("renders every template without throwing", () => {
    for (const t of templates.list()) {
      const html = render(t.html, sampleUser as any);
      expect(html.length).toBeGreaterThan(0);
      expect(html).not.toMatch(/\{\{/); // no leftover tags
      expect(html).not.toMatch(/<script/i);
    }
  });
  it("every template html is email-safe", () => {
    for (const t of templates.list()) {
      expect(t.html).not.toMatch(/<script|<iframe|<form|onclick=|onload=/i);
    }
  });
});
