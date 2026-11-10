"""Contact sheets of the finished logos for review: 6 x 6 grids of the 160px WebP files with slug captions.
usage: python3 -I contact_sheets.py dir manifest.json outprefix"""
import json, sys
from PIL import Image, ImageDraw
d, man, out = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
slugs = sorted(r["slug"] for r in man if r["decision"] == "kept")
cell_w, cell_h = 220, 215
for n in range(0, len(slugs), 36):
    chunk = slugs[n : n + 36]
    sheet = Image.new("RGB", (6 * cell_w, 6 * cell_h), (200, 200, 205))
    dr = ImageDraw.Draw(sheet)
    for i, s in enumerate(chunk):
        x, y = (i % 6) * cell_w, (i // 6) * cell_h
        dr.rectangle([x + 8, y + 4, x + 8 + 160 + 24, y + 4 + 160 + 8], fill=(128, 128, 135))
        im = Image.open(f"{d}/{s}.webp").convert("RGBA")
        sheet.paste(im, (x + 20, y + 8), im)
        dr.text((x + 6, y + 178), s[:36], fill=(0, 0, 0))
        dr.text((x + 6, y + 192), s[36:72], fill=(0, 0, 0))
    sheet.save(f"{out}_{n // 36 + 1:02d}.png")
print(len(slugs), "logos,", (len(slugs) + 35) // 36, "sheets")
