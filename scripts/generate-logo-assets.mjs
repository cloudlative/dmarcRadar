/**
 * One-off asset generator: rasterizes the SVG logo sources in branding/ into PNGs at the
 * sizes commonly needed for favicons, app icons, and README/repo social images.
 * Usage: node scripts/generate-logo-assets.mjs
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const brandingDir = path.join(root, "branding");

const ICON_SIZES = [16, 32, 48, 64, 128, 192, 256, 512];

async function main() {
  const iconSvg = await fs.readFile(path.join(brandingDir, "logo-icon.svg"));

  for (const size of ICON_SIZES) {
    const outPath = path.join(brandingDir, `logo-icon-${size}.png`);
    await sharp(iconSvg, { density: 384 }).resize(size, size).png().toFile(outPath);
    console.log(`wrote ${outPath}`);
  }

  for (const variant of ["light", "dark"]) {
    const svg = await fs.readFile(path.join(brandingDir, `logo-wordmark-${variant}.svg`));
    for (const scale of [1, 2, 3]) {
      const outPath = path.join(brandingDir, `logo-wordmark-${variant}@${scale}x.png`);
      await sharp(svg, { density: 96 * scale }).png().toFile(outPath);
      console.log(`wrote ${outPath}`);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
