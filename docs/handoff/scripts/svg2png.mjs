// Rasterise an SVG read from stdin to a PNG on stdout at up to 320px (sharp, as the brand build does).
import sharp from "sharp";
const chunks = [];
for await (const c of process.stdin) chunks.push(c);
try {
  const png = await sharp(Buffer.concat(chunks), { density: 144 }).resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: false }).png().toBuffer();
  process.stdout.write(png);
} catch (e) {
  process.exit(2);
}
