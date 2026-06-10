import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("").window;
// jsdom's Window is structurally compatible with DOMPurify's WindowLike at runtime.
const DOMPurify = createDOMPurify(window as unknown as Parameters<typeof createDOMPurify>[0]);

const ALLOWED_TAGS = [
  "table", "tbody", "thead", "tfoot", "tr", "td", "th",
  "span", "div", "p", "br", "a", "img",
  "strong", "b", "em", "i", "u", "small", "hr",
  "ul", "ol", "li", "font", "h1", "h2", "h3", "h4", "h5", "h6",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "target", "rel",
  "style", "width", "height", "align", "valign", "border",
  "cellpadding", "cellspacing", "bgcolor", "color", "size", "face",
  "colspan", "rowspan",
];

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["script", "iframe", "form", "video", "audio", "canvas", "link", "style", "object", "embed"],
    FORBID_ATTR: ["onclick", "onload", "onerror", "onmouseover", "onfocus", "onblur"],
    ALLOW_DATA_ATTR: false,
  });
}

export function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}
