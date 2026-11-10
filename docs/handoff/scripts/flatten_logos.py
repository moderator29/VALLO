"""Put every logo that has transparency on a solid ground so it reads on any app theme.
usage: python3 -I flatten_logos.py dir
A logo of dark ink goes on white; a logo drawn in light ink (white lettering) goes on the brand navy.
Opaque files are left alone. Rewrites each WebP in place (still 160 x 160, quality 85, stepped down to stay small)."""
import io, sys, glob
from PIL import Image
# found by eye on the contact sheets: dark-grey and mid-blue lettering the contrast rule put on navy
WHITE = {"abubakar-tafawa-balewa-university-bauchi", "benue-state-polytechnic-ugbokolo", "gboko-polytechnic", "ibrahim-badamasi-babangida-university-lapai", "isa-mustapha-agwai-i-polytechnic-lafia", "crescent-university-abeokuta", "spiritan-university-nneochi", "stars-polytechnic-ota", "our-saviour-institute-of-science-and-technology-enugu", "the-oke-ogun-polytechnic-saki", "osun-state-college-of-technology-esa-oke", "kebbi-state-university-of-science-and-technology-aliero", "mustibrah-polytechnic-kano", "national-open-university-of-nigeria", "nation-builders-polytechnic-asaba", "maryam-abacha-american-university-of-nigeria-kano", "edo-state-polytechnic-usen", "federal-polytechnic-of-oil-and-gas-bonny", "the-polytechnic-iresi", "waziri-umaru-federal-polytechnic-birnin-kebbi", "federal-polytechnic-daura", "federal-university-of-technology-owerri"}
NAVY = {"havilla-university-nde-ikom", "chrisland-university-abeokuta"}
for f in sorted(glob.glob(sys.argv[1] + "/*.webp")):
    im = Image.open(f).convert("RGBA")
    px = list(im.getdata())
    clear = sum(1 for p in px if p[3] < 250) / len(px)
    if clear < 0.02:
        continue
    inked = [p for p in px if p[3] > 128]
    lum = lambda p: (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255
    light = sum(1 for p in inked if lum(p) > 0.75)
    dark = sum(1 for p in inked if lum(p) < 0.35)
    # an opaque white box sitting on transparent margins: its corners are opaque and near white
    xs = [i % im.width for i, p in enumerate(px) if p[3] > 128]
    ys = [i // im.width for i, p in enumerate(px) if p[3] > 128]
    corners = [im.getpixel((x, y)) for x in (min(xs), max(xs)) for y in (min(ys), max(ys))] if xs else []
    white_box = len(corners) == 4 and all(c[3] > 200 and min(c[:3]) > 225 for c in corners)
    # white unless the ink is mostly light (white or pale lettering): then the brand navy
    slug = f.rsplit('/', 1)[1][:-5]
    mostly_light = light >= 0.35 * max(1, len(inked))
    ground = (11, 28, 61, 255) if (slug in NAVY or (not white_box and mostly_light and slug not in WHITE)) else (255, 255, 255, 255)
    bg = Image.new("RGBA", im.size, ground)
    bg.alpha_composite(im)
    for q in (85, 78, 70, 60):
        b = io.BytesIO()
        bg.convert("RGB").save(b, "WEBP", quality=q, method=6)
        if b.tell() <= 12_500:
            break
    open(f, "wb").write(b.getvalue())
