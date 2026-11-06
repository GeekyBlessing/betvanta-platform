// Renders the hero stadium artwork (original, procedural) to public/images/hero/*.webp. Run: node scripts/artwork/render-stadium.cjs
(async () => {
const { chromium } = require("playwright");
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/stadium-draw.js", "utf8");
const b = await chromium.launch(); const p = await b.newPage();
await p.setContent(`<script>${src}</script>`);
const variants = { "stadium-wide": [2560, 1440, { horizon: 0.13, focal: 1.95, stand: 0.27, lights: 5, lightGap: 0.21, crowdScale: 1, seed: 11 }],
  "stadium-tall": [1200, 2000, { horizon: 0.07, focal: 1.55, stand: 0.24, lights: 3, lightGap: 0.36, crowdScale: 0.9, seed: 5 }] };
for (const [name, [w, h, o]] of Object.entries(variants)) {
  const url = await p.evaluate(([w, h, o]) => draw(w, h, o).toDataURL("image/webp", 0.8), [w, h, o]);
  fs.writeFileSync(require("path").join(__dirname, "../../public/images/hero", `${name}.webp`), Buffer.from(url.split(",")[1], "base64"));
}
await b.close();
})();
