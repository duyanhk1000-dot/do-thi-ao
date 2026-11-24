# Crop square head+torso portraits from FLUX character images.
# FLUX ignored "plain white background" and added city scenery around every
# character, so we crop tight squares centred on the head/torso; the game
# displays them inside a circular badge (Pixi mask), which hides the corners.
from PIL import Image
import os
BASE = os.path.dirname(os.path.abspath(__file__))
CROPS = {
    # (left, top, right, bottom) in 1024x1024 coords
    'hero-citizen.png':  (315, 260, 695, 640),
    'npc-shipper.png':   (240, 120, 660, 540),
    'npc-bread.png':     (295, 120, 715, 540),
    'npc-taxi.png':      (300, 120, 720, 540),
    'npc-police.png':    (295, 170, 715, 590),
    'npc-thug.png':      (295, 120, 715, 540),
    'npc-student.png':   (315, 240, 695, 620),
}
for name, box in CROPS.items():
    src = os.path.join(BASE, name)
    out = os.path.join(BASE, name.replace('.png', '-crop.png'))
    im = Image.open(src).crop(box)
    im.save(out)
    print(out, im.size)
