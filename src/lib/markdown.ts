import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const KB_IMAGE_SRC_PATTERN =
  /^\/api\/kb\/images\/\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpe?g|webp)$/i;
const DEEP_QUOTE_PATTERN = /^\s*>{20,}/m;
const SAFE_LINK_TARGETS = new Set(["_blank", "_self"]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function markdownFallback(md: string): string {
  return `<pre>${escapeHtml(md)}</pre>`;
}

function normalizeImageExtension(src: string): string {
  return src.replace(/\.(?:png|jpe?g|webp)$/i, (extension) =>
    extension.toLowerCase(),
  );
}

export function renderMarkdown(
  md: string,
  opts?: { imageBase?: string },
): string {
  if (!md) {
    return "";
  }

  if (DEEP_QUOTE_PATTERN.test(md)) {
    return markdownFallback(md);
  }

  let html: string;
  try {
    html = marked.parse(md, { async: false });
  } catch {
    return markdownFallback(md);
  }

  return sanitizeHtml(html, {
    allowedTags: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "ul",
      "ol",
      "li",
      "strong",
      "em",
      "del",
      "code",
      "pre",
      "blockquote",
      "a",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
      "br",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      th: ["colspan", "rowspan", "align"],
      td: ["colspan", "rowspan", "align"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => {
        const nextAttribs: Record<string, string> = {
          rel: "noopener noreferrer",
        };

        if (attribs.href) {
          nextAttribs.href = attribs.href;
        }
        if (attribs.title) {
          nextAttribs.title = attribs.title;
        }
        if (attribs.target && SAFE_LINK_TARGETS.has(attribs.target)) {
          nextAttribs.target = attribs.target;
        }

        return { tagName: "a", attribs: nextAttribs };
      },
      img: (_tagName, attribs) => {
        const src = attribs.src?.trim();
        if (!src) {
          return { tagName: "span", attribs: {}, text: attribs.alt ?? "" };
        }

        let nextSrc: string;
        if (KB_IMAGE_SRC_PATTERN.test(src)) {
          nextSrc = `${(opts?.imageBase ?? "").replace(/\/+$/, "")}${normalizeImageExtension(src)}`;
        } else {
          return {
            tagName: "span",
            attribs: {},
            text: attribs.alt ?? "",
          };
        }

        const nextAttribs: Record<string, string> = { src: nextSrc };

        for (const attribute of ["alt", "title", "width", "height"]) {
          if (attribs[attribute] !== undefined) {
            nextAttribs[attribute] = attribs[attribute];
          }
        }

        return { tagName: "img", attribs: nextAttribs };
      },
    },
  });
}
