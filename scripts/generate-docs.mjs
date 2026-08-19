import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { marked } from "marked";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readmePath = path.join(rootDir, "README.md");
const outPath = path.join(rootDir, "docs", "guide.html");

const readme = readFileSync(readmePath, "utf8");

const REPO_URL = "https://github.com/cloudlative/dmarcRadar";

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

// The README uses repo-relative links (docs/CNAME, .github/workflows/x.yml, branding/) that
// only resolve on GitHub's own file browser, not on the standalone Pages site — send anything
// that isn't an http(s)/mailto/anchor/local-page link back to GitHub's blob/tree view instead.
function rewriteHref(href) {
  if (/^(https?:|mailto:)/.test(href) || href.startsWith("#") || href.endsWith(".html")) return href;
  const isDir = href.endsWith("/");
  const cleanPath = href.replace(/\/$/, "");
  return `${REPO_URL}/${isDir ? "tree" : "blob"}/main/${cleanPath}`;
}

// Screenshots live under docs/assets/... so they resolve on GitHub (repo-root-relative) — on
// the docs page itself (served with docs/ as the web root) that leading "docs/" has to go.
function rewriteImageSrc(src) {
  if (/^(https?:)/.test(src)) return src;
  return src.startsWith("docs/") ? src.slice("docs/".length) : src;
}

marked.use({
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slugify(text.replace(/<[^>]+>/g, ""));
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const resolvedHref = rewriteHref(href);
      const titleAttr = title ? ` title="${title}"` : "";
      return `<a href="${resolvedHref}"${titleAttr}>${text}</a>`;
    },
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${rewriteImageSrc(href)}" alt="${text}"${titleAttr} loading="lazy" />`;
    },
  },
});

// The README opens with a centered logo/title/tagline block meant for GitHub's rendering —
// the docs page has its own docheader for that, so drop everything through the first "##".
const firstSectionStart = readme.indexOf("\n## ");
const body = readme.slice(firstSectionStart + 1);

const html = marked.parse(body, { gfm: true });

const page = `<!doctype html>
<html lang="en">
<head>
<script>
  try {
    var storedPalette = localStorage.getItem("palette");
    if (storedPalette) document.documentElement.dataset.palette = storedPalette;
  } catch (e) {}
</script>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Documentation — dmarcRadar</title>
<meta name="description" content="dmarcRadar documentation — quick start, stack, container images, and data model, generated from the project README." />
<link rel="canonical" href="https://dmarcradar.cloudlative.com/guide.html" />
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="assets/site.css" />
</head>
<body>
  <header class="docheader">
    <a class="brand" href="index.html">
      <img src="assets/logo-icon-animated.svg" alt="" />
      dmarcRadar
    </a>
    <nav>
      <div class="theme-picker" role="group" aria-label="Color theme" style="margin-top: 0;">
        <button class="swatch" data-palette-choice="signal">
          <span class="dot" style="background-image:linear-gradient(135deg,#2a86e0,#17a878)"></span>Signal
        </button>
        <button class="swatch" data-palette-choice="ember">
          <span class="dot" style="background-image:linear-gradient(135deg,#d9622b,#d9a12b)"></span>Ember
        </button>
        <button class="swatch" data-palette-choice="slate">
          <span class="dot" style="background-image:linear-gradient(135deg,#4f46e5,#6d28d9)"></span>Slate
        </button>
      </div>
      <a href="https://github.com/cloudlative/dmarcRadar">GitHub</a>
    </nav>
  </header>

  <div class="wrap">
    <div class="prose">
${html}
    </div>
  </div>

  <footer>
    <p>
      <a href="https://github.com/cloudlative/dmarcRadar">github.com/cloudlative/dmarcRadar</a>
      · <a href="index.html">dmarcRadar</a>
    </p>
    <p><em>Generated from the project README — run \`npm run docs:generate\` to refresh after editing it.</em></p>
  </footer>

  <script>
    (function () {
      var swatches = document.querySelectorAll("[data-palette-choice]");
      var current = document.documentElement.dataset.palette || "signal";

      function markActive() {
        swatches.forEach(function (btn) {
          btn.dataset.active = String(btn.dataset.paletteChoice === current);
        });
      }

      swatches.forEach(function (btn) {
        btn.addEventListener("click", function () {
          current = btn.dataset.paletteChoice;
          if (current === "signal") {
            delete document.documentElement.dataset.palette;
            try { localStorage.removeItem("palette"); } catch (e) {}
          } else {
            document.documentElement.dataset.palette = current;
            try { localStorage.setItem("palette", current); } catch (e) {}
          }
          markActive();
        });
      });

      markActive();
    })();
  </script>
</body>
</html>
`;

writeFileSync(outPath, page);
console.log(`Wrote ${path.relative(rootDir, outPath)} from README.md`);
