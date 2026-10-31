// Compila src/ en main.js y junta css/ en styles.css (los dos archivos que carga Obsidian, junto con manifest.json).
// «node esbuild.config.mjs» vigila los cambios; «node esbuild.config.mjs production» compila una vez.
import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

const prod = process.argv[2] === "production";
const CSS = ["css/font.css", "css/cool-kit.css", "css/base.css", "css/ticket.css", "css/plan.css", "css/side.css", "css/forms.css", "css/place.css", "css/settings.css"];
/* Inter (la fuente de Cool Trip), incrustada: Obsidian solo descarga main.js, manifest.json y styles.css.
   fonts/Inter-latin.woff2 es la variable de @fontsource-variable/inter 5.1.0 (licencia OFL, fonts/OFL.txt), solo latín.
   La familia se llama «Cool Trip Inter» para no chocar con una Inter instalada en el sistema. */
const buildFont = () => writeFileSync("css/font.css", "/* generado por esbuild.config.mjs desde fonts/Inter-latin.woff2: no editar */\n" +
  "@font-face { font-family: \"Cool Trip Inter\"; font-style: normal; font-weight: 100 900; font-display: block;\n" +
  "  src: url(data:font/woff2;base64," + readFileSync("fonts/Inter-latin.woff2").toString("base64") + ") format(\"woff2\"); }\n");
const buildCss = () => {
  buildFont();
  writeFileSync("styles.css", "/* Cool Trip — generado desde css/ con «npm run build». */\n\n" +
    CSS.map(p => `/* ---------- ${p} ---------- */\n` + readFileSync(p, "utf8").trim()).join("\n\n") + "\n");
};

const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  outfile: "main.js",
  legalComments: "none",
  sourcemap: prod ? false : "inline",
  logLevel: "info",
  plugins: [{ name: "css", setup: b => b.onEnd(() => buildCss()) }],
});
if (prod) { await ctx.rebuild(); await ctx.dispose(); }
else await ctx.watch();
