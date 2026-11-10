#!/usr/bin/env python3
"""
WHERE A COMPONENT BEGINS AND ENDS.

A part held up by `lift` (or by the store set's `magnify`) must be cropped on
the component's OWN edges. Crop it anywhere else and the heavy rule round it
cuts through a heading, which is the founder's standing complaint and was
visible the moment the rule got thick.

This reads a capture and prints the bands of the screen that are components,
by finding the rows that are nothing but the page's own background. Those
rows are the gaps; everything between two gaps is one component.

    python3 films/blocks.py sc-filters              # every block
    python3 films/blocks.py sc-filters 1700         # the block holding y=1700
    python3 films/blocks.py d-n-listing --desktop   # a desktop page capture

Use the printed y0/y1 (and x0/x1) as the crop, with the few pixels of air it
already includes.
"""
import sys
from collections import Counter
from PIL import Image

REPO = "/home/user/read-it-well"
SCREENS = f"{REPO}/docs/marketing/screens"
SOURCE = f"{REPO}/docs/marketing/source"


def load(name, desktop=False, full=False):
    if desktop or full:
        return Image.open(f"{SOURCE}/{name}.webp").convert("RGB")
    return Image.open(f"{SCREENS}/{name}-ios.png").convert("RGB")


def blocks(im, tol=10, gap_min=14, pad=6):
    w, h = im.size
    px = im.load()
    step = max(1, w // 220)
    xs = list(range(0, w, step))
    # the page's own background: the commonest colour down the left margin,
    # below the status bar
    margin = Counter()
    for y in range(int(h * 0.12), h, 3):
        for x in range(4, min(18, w), 3):
            margin[px[x, y]] += 1
    bg = margin.most_common(1)[0][0]

    def is_gap(y):
        same = 0
        for x in xs:
            p = px[x, y]
            if abs(p[0] - bg[0]) <= tol and abs(p[1] - bg[1]) <= tol and abs(p[2] - bg[2]) <= tol:
                same += 1
        return same >= len(xs) * 0.985

    gap = [is_gap(y) for y in range(h)]
    out = []
    y = 0
    while y < h:
        if gap[y]:
            y += 1
            continue
        y0 = y
        while y < h and (not gap[y] or any(not gap[k] for k in range(y, min(h, y + gap_min)))):
            y += 1
        y1 = y
        if y1 - y0 < 18:
            continue
        # the block's own left and right edges
        x0, x1 = w, 0
        for yy in range(y0, y1, max(1, (y1 - y0) // 60 or 1)):
            for x in range(0, w):
                p = px[x, yy]
                if abs(p[0] - bg[0]) > tol or abs(p[1] - bg[1]) > tol or abs(p[2] - bg[2]) > tol:
                    x0 = min(x0, x)
                    break
            for x in range(w - 1, -1, -1):
                p = px[x, yy]
                if abs(p[0] - bg[0]) > tol or abs(p[1] - bg[1]) > tol or abs(p[2] - bg[2]) > tol:
                    x1 = max(x1, x + 1)
                    break
        out.append((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    return bg, out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    desktop = "--desktop" in sys.argv
    full = "--full" in sys.argv
    name = args[0]
    want = int(args[1]) if len(args) > 1 else None
    im = load(name, desktop, full)
    bg, bs = blocks(im)
    print(f"{name}  {im.size[0]}x{im.size[1]}  page background {bg}")
    for (x0, y0, x1, y1) in bs:
        if want is not None and not (y0 <= want <= y1):
            continue
        print(f"  crop: {{ x: {x0}, y: {y0}, w: {x1 - x0}, h: {y1 - y0} }}   (y {y0}..{y1}, {y1 - y0} tall)")


main()
