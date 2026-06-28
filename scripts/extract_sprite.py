#!/usr/bin/env python3
"""Extract the chameleon sprite from the original app icon.

The icon's light marble areas are the *same beige* as the background, so plain
color keying fragments the body. Instead we build a solid silhouette:

1. Flood-fill the beige background from the border (tolerance TBG).
2. Foreground = everything not background.
3. Morphological CLOSE (dilate R then erode R) to bridge the thin beige channels
   that cut through the body, merging it into one blob (floating dots stay apart
   if the gap is wider than the kernel).
4. Keep the largest connected component of the closed mask = the silhouette.
5. Fill the silhouette with the ORIGINAL pixels (light areas render as beige,
   faithful to the icon), feathering the outer edge alpha.
6. Crop the thin drawn tongue + catch dot at the mouth by column-height profile.
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

SRC = "public/app-icon.png"
OUT = "public/chameleon.png"

TBG = float(sys.argv[1]) if len(sys.argv) > 1 else 32.0   # bg flood tolerance
R = int(sys.argv[2]) if len(sys.argv) > 2 else 7          # closing radius (px)
FEATHER = float(sys.argv[3]) if len(sys.argv) > 3 else 22.0  # edge feather scale
TONGUE_CUT = float(sys.argv[4]) if len(sys.argv) > 4 else 0.30  # col-height frac for mouth


def main():
    im = Image.open(SRC).convert("RGB")
    W, H = im.size
    px = im.load()

    corners = [px[0, 0], px[W - 1, 0], px[0, H - 1], px[W - 1, H - 1]]
    br = sum(c[0] for c in corners) / 4
    bg_ = sum(c[1] for c in corners) / 4
    bb = sum(c[2] for c in corners) / 4

    def dist(c):
        dr, dg, db = c[0] - br, c[1] - bg_, c[2] - bb
        return (dr * dr + dg * dg + db * db) ** 0.5

    # 1. flood-fill background from border
    is_bg = bytearray(W * H)
    q = deque()
    def seed(x, y):
        i = y * W + x
        if not is_bg[i] and dist(px[x, y]) < TBG:
            is_bg[i] = 1
            q.append((x, y))
    for x in range(W):
        seed(x, 0); seed(x, H - 1)
    for y in range(H):
        seed(0, y); seed(W - 1, y)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                ni = ny * W + nx
                if not is_bg[ni] and dist(px[nx, ny]) < TBG:
                    is_bg[ni] = 1
                    q.append((nx, ny))

    # 2-3. foreground mask -> morphological close to bridge beige channels
    fg = Image.new("L", (W, H), 0)
    fp = fg.load()
    for y in range(H):
        for x in range(W):
            if not is_bg[y * W + x]:
                fp[x, y] = 255
    k = 2 * R + 1
    closed = fg.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
    cp = closed.load()

    # 4. keep largest connected component of the closed silhouette
    label = [0] * (W * H)
    best_label, best_size, cur = 0, 0, 0
    for sy in range(H):
        for sx in range(W):
            si = sy * W + sx
            if cp[sx, sy] and not label[si]:
                cur += 1
                size = 0
                st = [(sx, sy)]
                label[si] = cur
                while st:
                    x, y = st.pop()
                    size += 1
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H:
                            ni = ny * W + nx
                            if cp[nx, ny] and not label[ni]:
                                label[ni] = cur
                                st.append((nx, ny))
                if size > best_size:
                    best_size, best_label = size, cur
    print(f"bg~({br:.0f},{bg_:.0f},{bb:.0f}) components:{cur} silhouette:{best_size}")

    sil = bytearray(W * H)
    minx, miny, maxx, maxy = W, H, 0, 0
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if label[i] == best_label:
                sil[i] = 1
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y

    # 5b. fill ALL interior holes regardless of size: any non-silhouette pixel
    #     not reachable from the border is an enclosed hole -> make it silhouette.
    outside = bytearray(W * H)
    dq = deque()
    for x in range(W):
        for y in (0, H - 1):
            i = y * W + x
            if not sil[i] and not outside[i]:
                outside[i] = 1
                dq.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            i = y * W + x
            if not sil[i] and not outside[i]:
                outside[i] = 1
                dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H:
                ni = ny * W + nx
                if not sil[ni] and not outside[ni]:
                    outside[ni] = 1
                    dq.append((nx, ny))
    filled = 0
    for i in range(W * H):
        if not sil[i] and not outside[i]:
            sil[i] = 1
            filled += 1
    print(f"filled interior holes: {filled}")

    # 6. crop drawn tongue+dot: scan columns L->R, mouth = last column whose
    #    silhouette height stays above TONGUE_CUT * max height.
    col_h = [0] * W
    for x in range(minx, maxx + 1):
        h = 0
        for y in range(miny, maxy + 1):
            if sil[y * W + x]:
                h += 1
        col_h[x] = h
    maxh = max(col_h) if col_h else 0
    thresh = maxh * TONGUE_CUT
    mouthx = maxx
    # walk from left; once we drop below thresh and stay low to the edge, cut there
    for x in range(minx, maxx + 1):
        if col_h[x] < thresh:
            # confirm it stays thin until the end (a protrusion, not a dip)
            if all(col_h[xx] < maxh * 0.6 for xx in range(x, maxx + 1)):
                mouthx = x
                break
    print(f"bbox=({minx},{miny})-({maxx},{maxy}) maxh={maxh} mouthx={mouthx}")

    # 5. compose: solid interior (no holes), soft outer edge via blurred mask.
    mask = Image.new("L", (W, H), 0)
    mp = mask.load()
    fmaxx = 0
    for y in range(H):
        for x in range(W):
            if x <= mouthx and sil[y * W + x]:
                mp[x, y] = 255
                if x > fmaxx:
                    fmaxx = x
    mask = mask.filter(ImageFilter.GaussianBlur(1.1))

    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    op = out.load()
    bmp = mask.load()
    for y in range(H):
        for x in range(W):
            a = bmp[x, y]
            if a <= 0:
                continue
            c = px[x, y]
            op[x, y] = (c[0], c[1], c[2], a)

    crop = out.crop((minx, miny, fmaxx + 1, maxy + 1))
    crop.save(OUT)
    print(f"saved {OUT} {crop.size}")


if __name__ == "__main__":
    main()
