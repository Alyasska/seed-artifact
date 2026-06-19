#!/usr/bin/env python3
# Session 1 — pull a REAL DEM of a real SEED festival venue (Lightning in a Bottle
# at Lake San Antonio, Bradley CA) and write a plain heightmap JSON the browser +
# the field builder consume. Uses AWS "Terrarium" terrain tiles (open data, no
# auth, no key). Only dependency is Pillow (PIL), which is present.
#
#   elevation_m = (R*256 + G + B/256) - 32768
#
# Run: python3 tools/fetch_dem.py

import json, math, os, urllib.request
from PIL import Image

LAT, LON, ZOOM = 35.80, -120.88, 13          # Lake San Antonio, ~4 km tile at z13
OUT_W = OUT_H = 120                            # downsample target
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "lake-san-antonio.json")

def deg2tile(lat, lon, z):
    n = 2 ** z
    x = int((lon + 180.0) / 360.0 * n)
    lat_r = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n)
    return x, y, n

def tile_bbox(x, y, z):
    n = 2 ** z
    def lon_of(xx): return xx / n * 360.0 - 180.0
    def lat_of(yy): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * yy / n))))
    return dict(w=lon_of(x), e=lon_of(x + 1), n=lat_of(y), s=lat_of(y + 1))

def main():
    x, y, n = deg2tile(LAT, LON, ZOOM)
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{x}/{y}.png"
    print("tile", ZOOM, x, y, "->", url)
    tmp = "/tmp/terrarium.png"
    req = urllib.request.Request(url, headers={"User-Agent": "forge-demo/0.1"})
    with urllib.request.urlopen(req, timeout=20) as r, open(tmp, "wb") as f:
        f.write(r.read())

    im = Image.open(tmp).convert("RGB")
    W, H = im.size
    px = im.load()
    sx, sy = W / OUT_W, H / OUT_H
    elev, lo, hi = [], 1e9, -1e9
    for j in range(OUT_H):
        for i in range(OUT_W):
            r, g, b = px[min(W - 1, int(i * sx)), min(H - 1, int(j * sy))]
            e = (r * 256 + g + b / 256.0) - 32768.0
            elev.append(round(e, 1)); lo = min(lo, e); hi = max(hi, e)

    bbox = tile_bbox(x, y, ZOOM)
    # approx tile span in metres (for travel-cost scaling)
    span_m = (bbox["e"] - bbox["w"]) * 111320 * math.cos(math.radians(LAT))
    out = dict(venue="Lake San Antonio, Bradley CA (LIB site)", source="AWS Terrarium / SRTM",
               zoom=ZOOM, tile=[x, y], bbox=bbox, span_m=round(span_m),
               w=OUT_W, h=OUT_H, min=round(lo, 1), max=round(hi, 1), elev=elev)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f)
    print(f"wrote {OUT}  {OUT_W}x{OUT_H}  elev {lo:.0f}..{hi:.0f} m  span ~{span_m:.0f} m")

if __name__ == "__main__":
    main()
