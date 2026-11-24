#!/usr/bin/env python3
"""Crop FLUX magenta-background characters to tight full-body sprites and
key out the magenta background -> transparent RGBA PNGs (*-full.png).

Method: flood-fill from the image border. Only pixels CONNECTED to the
border and close to the sampled background colour become transparent.
Interior colours (red apron, pink skin, orange uniform) are never touched
even if they are somewhat close to magenta in RGB distance.
"""
import math
from collections import deque
from PIL import Image

# (src file, crop box in 1024px coords, output name)
JOBS = [
    ("/tmp/hero-magenta-test.png", (278, 180, 490, 895), "hero-citizen-full.png"),
    ("/tmp/npc-shipper-mag2.png",  (400, 230, 640, 920), "npc-shipper-full.png"),
    ("/tmp/npc-bread-mag.png",     (270, 110, 720, 905), "npc-bread-full.png"),
    ("/tmp/npc-taxi-mag.png",      (250, 180, 700, 920), "npc-taxi-full.png"),
    ("/tmp/npc-police-mag.png",    (300, 100, 720, 930), "npc-police-full.png"),
    ("/tmp/npc-thug-mag.png",      (260, 110, 700, 920), "npc-thug-full.png"),
    ("/tmp/npc-student-mag2.png",  (310, 180, 700, 920), "npc-student-full.png"),
]

OUT = "/home/hatch/workspace/do-thi-ao/assets/"
TOL = 70.0      # colour distance from bg considered "background"
FEATHER = 130.0 # edge pixels within this distance get half alpha


def dist(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def key_out(img):
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    # background colour = median of the 4 corners
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    alpha = bytearray([255]) * (w * h)
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0))
        q.append((x, h - 1))
    for y in range(h):
        q.append((0, y))
        q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if dist(px[x, y], bg) > TOL:
            continue
        alpha[i] = 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    # feather: semi-transparent halo for near-bg pixels next to transparency
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if alpha[i] != 255:
                continue
            near = False
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1),
                           (x + 1, y + 1), (x - 1, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and alpha[ny * w + nx] == 0:
                    near = True
                    break
            if near and dist(px[x, y], bg) < FEATHER:
                alpha[i] = 110
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            opx[x, y] = (r, g, b, alpha[y * w + x])
    # trim to non-transparent bbox + 4px padding, then normalise height to 720
    bbox = out.getbbox()
    if bbox:
        l, t, r, b = bbox
        l = max(0, l - 4)
        t = max(0, t - 4)
        r = min(w, r + 4)
        b = min(h, b + 4)
        out = out.crop((l, t, r, b))
    nw = round(out.width * 720 / out.height)
    out = out.resize((nw, 720), Image.LANCZOS)
    return out


for src, box, name in JOBS:
    img = Image.open(src).crop(box)
    out = key_out(img)
    out.save(OUT + name)
    # count opaque pixels as a sanity check (character must survive)
    alpha = out.split()[3]
    opaque = sum(1 for v in alpha.getdata() if v > 200)
    print(f"{name}: {out.size} opaque={opaque} ({100 * opaque / (out.width * out.height):.0f}%)")
print("done")
