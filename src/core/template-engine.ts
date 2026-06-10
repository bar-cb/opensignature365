import Handlebars from "handlebars";
import type { RenderedSignature, SampleUser } from "./types.js";

// Register fallback helper: {{displayName | fallback:""}} is custom syntax → preprocess.
// We accept three forms:
//   {{tag}}
//   {{tag | fallback:"value"}}
//   {{#if tag}}...{{/if}}
//   {{businessPhones.0}}
const FALLBACK_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\|\s*fallback:\s*"([^"]*)"\s*\}\}/g;
// {{tag.0}} → {{lookup tag 0}}
const ARRAY_IDX_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\.(\d+)\s*\}\}/g;

Handlebars.registerHelper("fallback", function (value: unknown, alt: string) {
  if (value === undefined || value === null || value === "") return alt;
  return value as string;
});

function preprocess(tpl: string): string {
  return tpl
    .replace(ARRAY_IDX_RE, (_m, tag, idx) => `{{lookup ${tag} ${idx}}}`)
    .replace(FALLBACK_RE, (_m, tag, alt) => `{{fallback ${tag} "${alt}"}}`);
}

export interface RenderOptions {
  preserveUnknownTags?: boolean;
}

export function render(
  tpl: string,
  user: SampleUser,
  opts: RenderOptions = {},
): string {
  const compiled = Handlebars.compile(preprocess(tpl), {
    strict: false,
    noEscape: false,
  });
  const result = compiled(user);
  // If unknown tag remained because of data, optionally clean.
  if (!opts.preserveUnknownTags) {
    return result.replace(/\{\{[^}]+\}\}/g, "");
  }
  return result;
}

const TAG_RE = /\{\{[#/]?\s*([a-zA-Z0-9_.]+)(?:\s+([^}]*))?/g;
const HELPERS = new Set(["if", "else", "unless", "each", "with", "fallback", "lookup"]);
const IDENT_RE = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

export function extractTags(tpl: string): string[] {
  const tags = new Set<string>();
  let m: RegExpExecArray | null;
  const cleaned = preprocess(tpl);
  while ((m = TAG_RE.exec(cleaned)) !== null) {
    const first = m[1];
    const rest = m[2] || "";
    if (!HELPERS.has(first)) tags.add(first.split(".")[0]);
    // Helper arguments may include data fields, e.g. {{fallback jobTitle "x"}}
    let id: RegExpExecArray | null;
    IDENT_RE.lastIndex = 0;
    while ((id = IDENT_RE.exec(rest)) !== null) {
      const t = id[1];
      if (!HELPERS.has(t) && !/^\d+$/.test(t)) tags.add(t);
    }
  }
  return [...tags];
}

export function renderSignature(
  htmlTpl: string,
  textTpl: string,
  user: SampleUser,
): RenderedSignature {
  const warnings: string[] = [];
  const tags = extractTags(htmlTpl);
  for (const t of tags) {
    if ((user as Record<string, unknown>)[t] === undefined) {
      warnings.push(`Tag {{${t}}} has no value for user ${user.mail || user.displayName}.`);
    }
  }
  return {
    html: render(htmlTpl, user),
    text: render(textTpl, user),
    warnings,
  };
}
