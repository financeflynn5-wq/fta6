# Draws the Mouse Bear Trucking artwork (Pillow, Inter fonts):
#   assets/vehicles/atlas_mousebear.png   the vehicle atlas with the box truck's livery, rear door and grille badge repainted
#   assets/mousebear/banner.png           the same livery at its true shape, for the depot's boards and trailers
#   assets/mousebear/logo.png             the mascot in its roundel (see-through corners)
# Run from the repo root:  python3 dev/mousebear-art.py
from PIL import Image, ImageDraw, ImageFont

FONT = '/usr/share/fonts/opentype/inter/'
font = lambda name, px: ImageFont.truetype(FONT + name, int(px))
TEAL, TEAL_D, CREAM, CORAL, CORAL_D, GOLD = '#0f9692', '#0a6c6e', '#fff3dc', '#ff5d62', '#e2444e', '#ffc145'
FUR, FUR_D, PINK, MUZZLE, INK, WHITE = '#9c6540', '#7b4a2d', '#f8a9b9', '#f6e4c6', '#2b1b17', '#ffffff'

def text(d, xy, s, f, fill, track=0, anchor='mm'):
    """Text with letter spacing; anchor is Pillow's (first letter: l, m or r)."""
    if not track: d.text(xy, s, font=f, fill=fill, anchor=anchor); return
    widths = [d.textlength(ch, font=f) for ch in s]; total = sum(widths) + track * (len(s) - 1)
    x = xy[0] - (total / 2 if anchor[0] == 'm' else total if anchor[0] == 'r' else 0)
    for ch, w in zip(s, widths): d.text((x, xy[1]), ch, font=f, fill=fill, anchor='l' + anchor[1]); x += w + track
def text_width(d, s, f, track=0): return sum(d.textlength(ch, font=f) for ch in s) + track * (len(s) - 1)

def mascot(d, cx, cy, s):
    """The Mouse Bear: a bear's face, a mouse's ears, whiskers and teeth, and a trucker's cap. s = head radius."""
    E = lambda x, y, rx, ry, fill: d.ellipse([cx + (x - rx) * s, cy + (y - ry) * s, cx + (x + rx) * s, cy + (y + ry) * s], fill=fill)
    P = lambda pts, fill: d.polygon([(cx + x * s, cy + y * s) for x, y in pts], fill=fill)
    L = lambda pts, fill, w: d.line([(cx + x * s, cy + y * s) for x, y in pts], fill=fill, width=max(1, int(w * s)), joint='curve')
    for sx in (-1, 1):                                             # ears
        E(sx * .84, -.70, .53, .53, FUR_D); E(sx * .84, -.69, .34, .34, PINK)
    E(0, .06, 1.0, .93, FUR)                                       # head
    for sx in (-1, 1): E(sx * .63, .34, .13, .1, '#e98b84')        # cheeks
    # cap: crown, white front panel, brim, button
    d.pieslice([cx - .80 * s, cy - 1.08 * s, cx + .80 * s, cy + .20 * s], 180, 360, fill=CORAL)
    d.rounded_rectangle([cx - .40 * s, cy - 1.0 * s, cx + .40 * s, cy - .30 * s], radius=.16 * s, fill=WHITE)
    text(d, (cx, cy - .775 * s), 'MB', font('InterDisplay-Black.otf', .31 * s), TEAL_D, track=.02 * s)
    E(0, -1.07, .07, .05, CORAL_D)
    E(0, -.40, .90, .17, CORAL_D); E(0, -.45, .86, .13, CORAL)
    for sx in (-1, 1):                                             # eyes
        E(sx * .36, .02, .1, .13, INK); E(sx * .36 - .035, -.03, .036, .036, WHITE)
    for sx in (-1, 1):                                             # whiskers
        for k, (y0, y1) in enumerate(((.36, .22), (.44, .42), (.52, .62))): L([(sx * .42, y0), (sx * 1.08, y1)], INK, .022)
    E(0, .44, .47, .36, MUZZLE)                                    # muzzle
    E(0, .25, .16, .105, INK); E(-.05, .22, .045, .025, '#6a4a40') # nose
    L([(0, .34), (0, .47)], INK, .03)
    d.arc([cx - .21 * s, cy + .32 * s, cx + .0 * s, cy + .56 * s], 20, 160, fill=INK, width=max(1, int(.03 * s)))
    d.arc([cx - .0 * s, cy + .32 * s, cx + .21 * s, cy + .56 * s], 20, 160, fill=INK, width=max(1, int(.03 * s)))
    for sx in (-1, 1): d.rounded_rectangle([cx + (sx * .052 - .045) * s, cy + .535 * s, cx + (sx * .052 + .045) * s, cy + .68 * s], radius=.02 * s, fill=WHITE, outline=INK, width=max(1, int(.012 * s)))

def roundel(d, cx, cy, r, ring=CORAL):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=CREAM)
    d.ellipse([cx - r * .93, cy - r * .93, cx + r * .93, cy + r * .93], outline=ring, width=max(2, int(r * .035)))
    mascot(d, cx, cy + r * .1, r * .64)

def livery(W, H):
    """The side of a truck: W x H in true proportions."""
    im = Image.new('RGB', (W, H), TEAL); d = ImageDraw.Draw(im)
    # sunset stripes along the bottom, and a darker skirt under them
    y = H * .80
    for col, h in ((CREAM, .022), (CORAL, .05), (GOLD, .05), (TEAL_D, .2)): d.rectangle([0, y, W, y + H * h + 1], fill=col); y += H * h
    r = H * .34; cx = H * .52; roundel(d, cx, H * .41, r)
    tx = cx + r + (W - cx - r) / 2 - H * .01
    big = font('InterDisplay-Black.otf', H * .30); w = text_width(d, 'MOUSE BEAR', big, H * .012)
    if w > (W - cx - r) * .9: big = font('InterDisplay-Black.otf', H * .30 * (W - cx - r) * .9 / w)
    text(d, (tx + H * .012, H * .30 + H * .014), 'MOUSE BEAR', big, TEAL_D, track=H * .012)      # drop shadow
    text(d, (tx, H * .30), 'MOUSE BEAR', big, CREAM, track=H * .012)
    text(d, (tx, H * .535), 'TRUCKING CO.', font('InterDisplay-Black.otf', H * .145), GOLD, track=H * .05)
    text(d, (tx, H * .695), 'WE HAUL IT ALL  ·  555-BEAR', font('Inter-Bold.otf', H * .066), CREAM, track=H * .016)
    return im

def main():
    # ---- the vehicle atlas, repainted for the Mouse Bear truck ----
    atlas = Image.open('assets/vehicles/atlas_color.png').convert('RGB')
    side = livery(2608 * 2, 1024 * 2).resize((1024, 256), Image.LANCZOS)          # the box side is 5.54 x 2.18 m, drawn on a 4:1 strip
    atlas.paste(side, (0, 512))
    S = 4; door = atlas.crop((0, 768, 256, 1024)).resize((256 * S, 256 * S), Image.LANCZOS); d = ImageDraw.Draw(door)
    # the rear door is 2.5 m wide and 2.18 m tall on a square patch: drawn 1.15x too tall there, so squash the logo to match
    logo = Image.new('RGBA', (600, 600), (0, 0, 0, 0)); roundel(ImageDraw.Draw(logo), 300, 300, 290, ring=TEAL)
    logo = logo.resize((int(100 * S), int(115 * S)), Image.LANCZOS); door.paste(logo, (int(84 * S), int(28 * S)), logo)
    d.rounded_rectangle([40 * S, 158 * S, 228 * S, 196 * S], radius=6 * S, fill=TEAL)
    text(d, (134 * S, 170 * S), "HOW'S MY DRIVING?", font('Inter-Black.otf', 13.5 * S), CREAM, track=.6 * S)
    text(d, (134 * S, 186 * S), 'CALL 555-BEAR', font('Inter-Bold.otf', 11 * S), GOLD, track=1.5 * S)
    atlas.paste(door.resize((256, 256), Image.LANCZOS), (0, 768))
    g = atlas.crop((336, 812, 432, 852)).resize((96 * S, 40 * S), Image.LANCZOS); d = ImageDraw.Draw(g)
    d.rounded_rectangle([8 * S, 7 * S, 88 * S, 32 * S], radius=5 * S, fill=CREAM)
    text(d, (48 * S, 19.5 * S), 'M·BEAR', font('Inter-Black.otf', 15 * S), TEAL_D, track=.4 * S)
    atlas.paste(g.resize((96, 40), Image.LANCZOS), (336, 812))
    atlas.save('assets/vehicles/atlas_mousebear.png', optimize=True)
    # ---- the banner (true shape) and the roundel ----
    livery(2608 * 2, 1024 * 2).resize((1024, 402), Image.LANCZOS).save('assets/mousebear/banner.png', optimize=True)
    big = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0)); roundel(ImageDraw.Draw(big), 1024, 1024, 1000)
    big.resize((512, 512), Image.LANCZOS).save('assets/mousebear/logo.png', optimize=True)

main()
