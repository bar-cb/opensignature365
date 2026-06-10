import { describe, it, expect } from "vitest";
import { validateForPublish, validateForDeploy } from "../src/core/validation.js";
import type { Signature } from "../src/core/types.js";

const base: Signature = {
  id: "test",
  name: "Test",
  description: "",
  status: "published",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  current_version: "v1",
  editor: { html: "<table><tr><td>Hi {{displayName}}</td></tr></table>", text: "Hi" },
  settings: {
    deployment_mode: "exchange_transport_rule",
    disclaimer_location: "append",
    fallback_action: "wrap",
    apply_to: { mode: "test_users", test_users_file: "data/users/test-users.csv" },
  },
  assets: [],
  dynamic_tags: ["displayName"],
};

describe("validation", () => {
  it("passes a clean signature", () => {
    const r = validateForPublish(base);
    expect(r.errors).toEqual([]);
  });
  it("rejects script tags", () => {
    const r = validateForPublish({ ...base, editor: { ...base.editor, html: "<script>alert(1)</script>" } });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("rejects local images on deploy", () => {
    const r = validateForDeploy({ ...base, editor: { ...base.editor, html: '<img src="data/assets/logos/x.png" alt="x"/>' } });
    expect(r.errors.some((e) => /not an absolute HTTPS/.test(e))).toBe(true);
  });
  it("requires publish before deploy", () => {
    const r = validateForDeploy({ ...base, status: "draft" });
    expect(r.errors.some((e) => /must be published/.test(e))).toBe(true);
  });
});
