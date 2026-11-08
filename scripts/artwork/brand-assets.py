# Builds every BETVANTA logo asset from the client's original artwork (public/brand/source/betvanta-logo-original.png).
# Only crops, downscales and black-to-transparent conversion: the design, proportions and colours are never changed.
#   python3 scripts/artwork/brand-assets.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "public/brand/source/betvanta-logo-original.png")
OUT = os.path.join(ROOT, "public/brand")
APP = os.path.join(ROOT, "src/app")
src = Image.open(SRC).convert("RGB")
W, H = src.size
assert (W, H) == (1536, 1024), "expected the 1536x1024 original"

# Regions measured on the original (content bounding boxes plus a margin).
MARK = (543, 197, 1003, 578)        # the B with the ball
WORD = (265, 586, 1288, 733)        # BETVANTA wordmark
LOCKUP = (265, 197, 1288, 826)   # stops before the background swoosh at x 1293, y 828      # mark, wordmark, tagline and underline

def black_to_alpha(im):
    """Colour-to-alpha against black: on a black background the result looks exactly like the original."""
    # Values below 20 are the background's faint red glow, not the logo, and become fully transparent.
    im = im.convert("RGB"); px = im.load(); out = Image.new("RGBA", im.size); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]; a = max(r, g, b)
            po[x, y] = (0, 0, 0, 0) if a < 20 else  (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), a)
    return out

def fit_height(im, h):
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)

def save(im, name, **kw):
    path = os.path.join(OUT, name); im.save(path, optimize=True, **kw); print(name, im.size, os.path.getsize(path))

mark = src.crop(MARK); word = src.crop(WORD); lockup = src.crop(LOCKUP)
mark_a = black_to_alpha(mark); word_a = black_to_alpha(word); lockup_a = black_to_alpha(lockup)

# Header and footer (transparent; drawn on black). 2x and 1x for sharp mobile and desktop rendering.
for h in (96, 48): save(fit_height(mark_a, h), f"betvanta-mark-{h}.png")
for h in (64, 32): save(fit_height(word_a, h), f"betvanta-wordmark-{h}.png")
for h in (400, 200): save(fit_height(lockup_a, h), f"betvanta-lockup-{h}.png")

# Square icon: the mark centred on black, never upscaled.
def square_icon(size, pad=0.08):
    side = round(max(mark.width, mark.height) * (1 + 2 * pad))
    canvas = Image.new("RGB", (side, side), (0, 0, 0))
    canvas.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    return canvas.resize((size, size), Image.LANCZOS) if size < side else canvas
icon512 = square_icon(512); save(icon512, "betvanta-icon-512.png")
save(square_icon(192), "betvanta-icon-192.png")

# Profile picture (DP): a 1024x1024 square straight from the original, centred on the lockup, plus the mark on its own.
dp = src.crop((256, 0, 1280, 1024)); save(dp, "betvanta-dp-1024.png"); save(dp.resize((400, 400), Image.LANCZOS), "betvanta-dp-400.png")
save(square_icon(10_000, pad=0.25), "betvanta-dp-mark.png")  # native size (about 690px), not upscaled

# Social sharing card (1200x630) cropped from the original.
save(src.crop((0, 109, 1536, 915)).resize((1200, 630), Image.LANCZOS), "betvanta-og-1200x630.png")

# Next.js app icons: favicon, browser tab, home-screen icons.
square_icon(512).save(os.path.join(APP, "icon.png"), optimize=True)
square_icon(180).save(os.path.join(APP, "apple-icon.png"), optimize=True)
fav = square_icon(256); fav.save(os.path.join(APP, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
src.crop((0, 109, 1536, 915)).resize((1200, 630), Image.LANCZOS).save(os.path.join(APP, "opengraph-image.png"), optimize=True)
print("app icons written")
