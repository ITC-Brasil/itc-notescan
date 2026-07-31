// Gera os ícones PWA em public/icons/ a partir dos assets read-only de brand/.
// Idempotente: sobrescreve os mesmos arquivos a cada execução.
//   node scripts/generate-icons.mjs
//
// Regra: só downscale, nunca upscale. As fontes (512px) são maiores que os alvos.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = join(root, "brand");
const outDir = join(root, "public", "icons");

await mkdir(outDir, { recursive: true });

const appIcon512 = join(brand, "app-icon", "notescan-appicon-512.png");

// icon-192 e icon-512 — downscale do app icon 512.
await sharp(appIcon512).resize(192, 192).png().toFile(join(outDir, "icon-192.png"));
await sharp(appIcon512).resize(512, 512).png().toFile(join(outDir, "icon-512.png"));

// icon-maskable-512 — canvas 512 sólido #003C3F com o símbolo dark-bg centralizado
// ocupando 60% (~307px), a zona segura do recorte maskable.
const SAFE = Math.round(512 * 0.6); // 307
const symbol = await sharp(join(brand, "symbol", "notescan-symbol-dark-bg.svg"))
  .resize(SAFE, SAFE)
  .png()
  .toBuffer();

await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#003C3F" },
})
  .composite([{ input: symbol, gravity: "center" }])
  .png()
  .toFile(join(outDir, "icon-maskable-512.png"));

console.log("✓ public/icons/: icon-192.png, icon-512.png, icon-maskable-512.png");
