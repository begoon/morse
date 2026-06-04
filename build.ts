// Bundle the app into a single self-contained docs/index.html.
//
// Bun's bundler emits index.html plus hashed .js/.css assets. For GitHub Pages
// we want one file, so we build in memory and inline the assets into the HTML.

import { $ } from "bun";

const result = await Bun.build({
  entrypoints: ["./index.html"],
  minify: true,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

let html = "";
const js = new Map<string, string>();
const css = new Map<string, string>();

for (const out of result.outputs) {
  const name = out.path.replace(/^\.?\//, "");
  if (name.endsWith(".html")) html = await out.text();
  else if (name.endsWith(".js")) js.set(name, await out.text());
  else if (name.endsWith(".css")) css.set(name, await out.text());
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Guard against a stray "</script>" in bundled code breaking the inline tag.
const safeJs = (s: string) => s.replace(/<\/script>/gi, "<\\/script>");

for (const [name, code] of css) {
  html = html.replace(
    new RegExp(`<link[^>]*href="\\.?/?${escapeRe(name)}"[^>]*>`),
    `<style>${code}</style>`,
  );
}
for (const [name, code] of js) {
  html = html.replace(
    new RegExp(`<script[^>]*src="\\.?/?${escapeRe(name)}"[^>]*></script>`),
    `<script type="module">${safeJs(code)}</script>`,
  );
}

await $`rm -rf docs`;
await Bun.write("docs/index.html", html);
console.log(`Wrote docs/index.html (${(html.length / 1024).toFixed(1)} KB, self-contained)`);
