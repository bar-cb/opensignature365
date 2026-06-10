import type { Signature } from "./types.js";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

const FORBIDDEN_TAG_RE = /<\s*(script|iframe|form|object|embed|link|style)\b/i;
const EVENT_ATTR_RE = /\son\w+\s*=/i;
const LOCAL_IMG_RE = /<img[^>]+src=["'](?!https?:|data:|cid:)([^"']+)["']/i;
const EXTERNAL_CSS_RE = /<link[^>]+rel=["']stylesheet["']/i;
const REMOTE_FONT_RE = /@import\s+url\(/i;
const MAX_HTML_SIZE = 65_000;

export function validateForPublish(sig: Signature): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sig.name?.trim()) errors.push("Signature name is required.");
  if (!sig.editor.html?.trim()) errors.push("HTML content is empty.");
  if (!sig.editor.text?.trim()) warnings.push("Plain text fallback is empty.");
  if (FORBIDDEN_TAG_RE.test(sig.editor.html)) errors.push("HTML contains forbidden tags (script/iframe/form/...).");
  if (EVENT_ATTR_RE.test(sig.editor.html)) errors.push("HTML contains inline JavaScript event handlers.");
  if (EXTERNAL_CSS_RE.test(sig.editor.html)) errors.push("HTML loads an external CSS file.");
  if (REMOTE_FONT_RE.test(sig.editor.html)) warnings.push("HTML imports remote fonts; many email clients block this.");
  if (sig.editor.html.length > MAX_HTML_SIZE) warnings.push(`HTML is ${sig.editor.html.length} bytes; some clients clip large messages.`);
  // Image alt text
  const imgs = sig.editor.html.match(/<img[^>]*>/gi) || [];
  for (const img of imgs) {
    if (!/alt\s*=/.test(img)) warnings.push(`An <img> is missing alt text.`);
  }
  return { errors, warnings };
}

export function validateForDeploy(
  sig: Signature,
  options: { requirePublicUrls?: boolean } = {},
): ValidationResult {
  const base = validateForPublish(sig);
  const requirePublic = options.requirePublicUrls ?? true;
  if (sig.status !== "published") base.errors.push("Signature must be published before deployment.");
  if (requirePublic) {
    const local = sig.editor.html.match(LOCAL_IMG_RE);
    if (local) base.errors.push(`Image src "${local[1]}" is not an absolute HTTPS URL.`);
    for (const asset of sig.assets) {
      if (asset.type === "image" && !asset.public_url) {
        base.warnings.push(`Asset ${asset.id} has no public_url; will not be deployed.`);
      }
    }
  }
  if (!sig.settings?.apply_to?.mode) base.errors.push("Deployment target mode is missing.");
  return base;
}
