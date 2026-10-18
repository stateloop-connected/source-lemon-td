#!/usr/bin/env python3
"""Inspect a game screenshot: saturation/value, dominant colours, pixel probes, zoom crops.

Usage:
  python shot_stats.py shot.png
  python shot_stats.py shot.png --points 500,550 800,100
  python shot_stats.py shot.png --crop 720,520,1140,780 --zoom 2 --out crop.png
"""
import argparse
import colorsys
from collections import Counter

from PIL import Image


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--points", nargs="*", default=[], help="x,y pairs to probe")
    ap.add_argument("--crop", help="x0,y0,x1,y1")
    ap.add_argument("--zoom", type=float, default=1.0)
    ap.add_argument("--out", help="write the (cropped/zoomed) image here")
    ap.add_argument("--top", type=int, default=6)
    args = ap.parse_args()

    im = Image.open(args.image).convert("RGB")
    orig = im
    print(f"image: {im.width}x{im.height}")

    if args.crop:
        box = tuple(int(v) for v in args.crop.split(","))
        im = im.crop(box)

    if args.zoom and args.zoom != 1.0:
        im = im.resize(
            (max(1, int(im.width * args.zoom)), max(1, int(im.height * args.zoom))),
            Image.LANCZOS,
        )

    if args.out:
        im.save(args.out)
        print(f"saved: {args.out}")

    small = im.resize((min(320, im.width), min(200, im.height)))
    px = list(small.getdata())
    hsv = [colorsys.rgb_to_hsv(r / 255, g / 255, b / 255) for r, g, b in px]
    sat = sum(h[1] for h in hsv) / len(hsv)
    val = sum(h[2] for h in hsv) / len(hsv)
    print(f"mean saturation: {sat:.3f}   mean value: {val:.3f}")

    quant = [(r // 32 * 32, g // 32 * 32, b // 32 * 32) for r, g, b in px]
    for colour, n in Counter(quant).most_common(args.top):
        share = n / len(px) * 100
        print(f"  rgb{colour}  {share:5.1f}%")

    for point in args.points:
        try:
            x, y = (int(v) for v in point.split(","))
            print(f"  pixel {x},{y} = {orig.getpixel((x, y))}")
        except Exception as exc:  # noqa: BLE001
            print(f"  pixel {point}: {exc}")


if __name__ == "__main__":
    main()
