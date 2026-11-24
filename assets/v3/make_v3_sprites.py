#!/usr/bin/env python3
"""v3 key-out, corrected (integration fix, 2026-11-25).

Why this exists: the original version used FLOOD-FILL from the border with a
corner-median background colour. That fails two ways, verified by compositing
every *-full.png on grass green and viewing it:
  1. Magenta pockets ENCLOSED by the subject (between a character's legs /
     arm and torso, under the feet) are never border-connected, so they stay
     opaque magenta in the sprite.
  2. When a crop's corners land on other objects (houses, trees, roofs),
     the corner-median "background" is grey/green, not magenta, so NO magenta
     is keyed at all (dog, cat, box, bush, car, lamp were all still on solid
     magenta, and the dog/cat/box crops also contained neighbouring houses).
Fix: GLOBAL magenta key (every pixel close to the sampled magenta becomes
transparent, not only border-connected ones) + TIGHT crops around the subject
only, re-derived by viewing each raw image. TOL=90 is chosen so the red apron
of Chị Lan (dist ~100 from magenta) and Bé Mai's pink backpack (dist ~162)
survive, while the dark-magenta cast shadows (dist ~80) are removed.
Feather only softens the 1px rim next to transparency.
"""
import math, os
from collections import Counter
from PIL import Image

RAW = "/home/hatch/workspace/do-thi-ao/assets/v3/raw"
OUT = "/home/hatch/workspace/do-thi-ao/assets/v3"
TOL, FEATHER = 90.0, 150.0


def dist(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def is_magenta(c):
    r, g, b = c
    return r > 170 and g < 150 and b > 90 and (r - g) > 70


def sample_bg(img):
    """Most common magenta-like border pixel; fallback = FLUX magenta."""
    w, h = img.size
    px = img.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] \
        + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    mg = [c for c in border if is_magenta(c)]
    if mg:
        return Counter(mg).most_common(1)[0][0]
    return (247, 10, 115)


def key_out_global(img):
    """Global magenta key (NOT flood-fill): every near-magenta pixel -> alpha 0."""
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    bg = sample_bg(img)
    alpha = bytearray([255]) * (w * h)
    for y in range(h):
        for x in range(w):
            if dist(px[x, y], bg) < TOL:
                alpha[y * w + x] = 0
    # cast-shadow pass: FLUX draws the subject's shadow as DARK magenta
    # (e.g. hero (181,7,105), dog (147,5,65)) — dist ~103-112 from the bg
    # magenta, just above TOL, so the global key misses it. Shadow pixels
    # are (R 95-230, G <= 40, B 40-150) — measured: hero (181,7,105), dog
    # blob (107-118,4-5,47-53) and dog shadow (R 100-120, G 0-20, B 40-60).
    # B was 50-150 until 2026-11-25; widened to 40 after the dog/cat still
    # showed ~3000 shadow pixels below B=50. No sprite colour matches
    # that: Chị Lan's red apron is (183,11,1) — B ~ 0; pink backpack/flowers
    # have G > 100; orange/blue/green are far away. Safe to key by hue.
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if 95 <= r <= 230 and g <= 40 and 40 <= b <= 150:
                alpha[y * w + x] = 0
    # feather: 1px rim next to transparency, near-magenta -> half alpha
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if alpha[i] != 255:
                continue
            near = any(0 <= nx < w and 0 <= ny < h and alpha[ny * w + nx] == 0
                       for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1),
                                      (x + 1, y + 1), (x - 1, y - 1)))
            if near and dist(px[x, y], bg) < FEATHER:
                alpha[i] = 110
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            opx[x, y] = (r, g, b, alpha[y * w + x])
    return out, bg


def keep_largest_component(img):
    """Keep only the largest 4-connected opaque component.

    FLUX props are whole neighbourhoods: the tight crop can still catch a
    stray roof corner / tree tip / shadow blob that is a SEPARATE blob from
    the subject (dog's top-left triangle, cat's grey box, tree-a's corner
    object). The subject is always the biggest blob. NOT used for bench /
    fence-segment: their slats are legitimately separate strips.
    """
    w, h = img.size
    px = img.load()
    opaque = bytearray([1 if px[x, y][3] > 200 else 0 for y in range(h) for x in range(w)])
    seen = bytearray(w * h)
    best = []
    for start in range(w * h):
        if not opaque[start] or seen[start]:
            continue
        comp = []
        stack = [start]
        seen[start] = 1
        while stack:
            i = stack.pop()
            comp.append(i)
            x, y = i % w, i // w
            for ni in ((i - 1) if x > 0 else -1, (i + 1) if x < w - 1 else -1,
                       (i - w) if y > 0 else -1, (i + w) if y < h - 1 else -1):
                if ni >= 0 and opaque[ni] and not seen[ni]:
                    seen[ni] = 1
                    stack.append(ni)
        if len(comp) > len(best):
            best = comp
    keep = bytearray(w * h)
    for i in best:
        keep[i] = 1
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x
            r, g, b, a = px[x, y]
            opx[x, y] = (r, g, b, a if keep[i] else 0)
    return out


def circular_mask(img, cx, cy, rx, ry):
    """prop-bin: the green lid is a circle on a big beige platform. Keep
    only the ellipse around the lid; the platform corners go transparent."""
    w, h = img.size
    px = img.load()
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0
            opx[x, y] = (r, g, b, a if inside else 0)
    return out


def auto_bbox(img):
    """bbox of pixels far from the sampled magenta (characters only)."""
    bg = sample_bg(img)
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    xs, ys = [], []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if dist(px[x, y], bg) > TOL:
                xs.append(x)
                ys.append(y)
    if not xs:
        return None
    return (max(0, min(xs) - 6), max(0, min(ys) - 6),
            min(w, max(xs) + 6), min(h, max(ys) + 6))


def save_full(img, name, height=720):
    bbox = img.getbbox()
    if bbox:
        l, t, r, b = bbox
        img = img.crop((max(0, l - 4), max(0, t - 4),
                        min(img.width, r + 4), min(img.height, b + 4)))
    nw = round(img.width * height / img.height)
    img = img.resize((nw, height), Image.LANCZOS)
    img.save(f"{OUT}/{name}")
    a = img.split()[3]
    op = sum(1 for v in a.getdata() if v > 200)
    # remaining opaque magenta = key-out failure; must be ~0
    rgb = img.convert("RGB")
    px = rgb.load()
    mag = 0
    tot = 0
    for y in range(0, img.height, 2):
        for x in range(0, img.width, 2):
            tot += 1
            if a.getpixel((x, y)) > 200 and is_magenta(px[x, y]):
                mag += 1
    print(f"{name}: {img.size} opaque={100 * op / (img.width * img.height):.0f}% "
          f"magenta-left={100 * mag / tot:.1f}%")
    return mag / tot


os.makedirs(OUT, exist_ok=True)
worst = 0.0

# --- characters: auto bbox + global key (npc-student: manual crop, trees in corners) ---
CHARACTERS = ["hero-citizen", "npc-shipper", "npc-bread", "npc-taxi",
              "npc-police", "npc-thug"]
for n in CHARACTERS:
    src = Image.open(f"{RAW}/{n}.png")
    box = auto_bbox(src)
    print(n, "auto bbox", box)
    out, bg = key_out_global(src.crop(box))
    print("  bg =", bg)
    out = keep_largest_component(out)
    worst = max(worst, save_full(out, f"{n}-full.png", 720))

src = Image.open(f"{RAW}/npc-student.png").crop((350, 150, 680, 970))
out, bg = key_out_global(src)
print("npc-student bg =", bg)
out = keep_largest_component(out)
worst = max(worst, save_full(out, "npc-student-full.png", 720))

# --- props: tight manual crops (1024px coords, from viewing each raw) ---
PROPS = {
    "prop-tree-a": (320, 320, 710, 680),
    "prop-tree-b": (290, 320, 730, 730),
    "prop-bush-flower": (290, 300, 770, 770),
    "prop-lamp": (420, 320, 670, 790),
    "prop-bench": (390, 480, 650, 600),
    "prop-dog": (410, 360, 640, 620),
    "prop-cat": (480, 380, 700, 780),
    "prop-car": (280, 380, 740, 610),
    "prop-box": (340, 340, 710, 640),
    "prop-bin": (400, 380, 650, 660),
    "prop-fence-corner": (250, 370, 840, 690),
    "prop-fence-segment": (240, 395, 850, 615),
    "prop-motorbike": (380, 290, 660, 810),
    # 2026-11-25 (vehicles fix): bicycle was missing entirely — FLUX v1
    # drew a side view, v2 (high angle, diagonal, front wheel bottom-right)
    # matches the motorbike prop's high-angle look. Crop from viewing v2.
    "prop-bicycle": (180, 220, 850, 740),
}
for n, box in PROPS.items():
    src = Image.open(f"{RAW}/{n}.png").crop(box)
    out, bg = key_out_global(src)
    print(n, "bg =", bg)
    if n == "prop-bin":
        out = circular_mask(out, 125, 140, 118, 128)
    if n not in ("prop-bench", "prop-fence-segment"):
        out = keep_largest_component(out)
    worst = max(worst, save_full(out, f"{n}-full.png", 360))

print("worst magenta-left: %.2f%%" % (100 * worst))
print("done")
