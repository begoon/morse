// Bundle the apps into self-contained HTML files under docs/.
//
// Bun's bundler emits index.html plus hashed .js/.css assets. For GitHub Pages
// we want one file per page, so we build in memory and inline the assets into
// the HTML. Pages: landing (docs/index.html), play, keying, settings, and the
// Foundation mock exam runner (docs/test/index.html).

import { $ } from "bun";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Guard against a stray "</script>" in bundled code breaking the inline tag.
const safeJs = (s: string) => s.replace(/<\/script>/gi, "<\\/script>");

async function buildPage(entrypoint: string, outPath: string): Promise<void> {
    const result = await Bun.build({
        entrypoints: [entrypoint],
        minify: true,
        // Inline images as data URIs so the page stays a single file.
        plugins: [
            {
                name: "png-dataurl",
                setup(build) {
                    build.onLoad({ filter: /\.png$/ }, async (args) => {
                        const base64 = Buffer.from(await Bun.file(args.path).arrayBuffer()).toString("base64");
                        return {
                            contents: `export default "data:image/png;base64,${base64}"`,
                            loader: "js",
                        };
                    });
                },
            },
        ],
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

    for (const [name, code] of css) {
        html = html.replace(new RegExp(`<link[^>]*href="\\.?/?${escapeRe(name)}"[^>]*>`), `<style>${code}</style>`);
    }
    for (const [name, code] of js) {
        html = html.replace(
            new RegExp(`<script[^>]*src="\\.?/?${escapeRe(name)}"[^>]*></script>`),
            `<script type="module">${safeJs(code)}</script>`,
        );
    }

    await Bun.write(outPath, html);
    console.log(`wrote ${outPath} (${(html.length / 1024).toFixed(1)} KB, self-contained)`);
}

await $`rm -rf docs`;
await buildPage("./index.html", "docs/index.html");
await buildPage("./src/play/index.html", "docs/play/index.html");
await buildPage("./src/keying/index.html", "docs/keying/index.html");
await buildPage("./src/chat/index.html", "docs/chat/index.html");
await buildPage("./src/paddle/index.html", "docs/paddle/index.html");
await buildPage("./src/settings-page/index.html", "docs/settings/index.html");
await buildPage("./src/test/index.html", "docs/test/index.html");
