"""Kartenhintergrund aus OpenStreetMap backen → data/karte-hintergrund.json

1. Overpass-Abfrage (Ausschnitt S,W,N,E so wählen, dass alle Orte + Rand drin sind):
     [out:json][timeout:90];
     ( way["highway"~"^(trunk|primary|secondary|tertiary)$"](S,W,N,E);
       way["railway"="rail"](S,W,N,E); way["natural"="wood"](S,W,N,E);
       way["landuse"="forest"](S,W,N,E); way["leisure"="park"](S,W,N,E);
       way["natural"="water"](S,W,N,E); );
     out geom;
   per curl an https://overpass-api.de/api/interpreter → osm.json
2. python3 werkstatt/karte-backen.py osm.json  (im Ordner wolke-der-zeugen)

Stand Okt. 2026: Ausschnitt 52.506,13.090,52.564,13.200 (mit Seniorenzentrum Hohenlohe im Norden).
"""
import json, math, sys

QUELLE = sys.argv[1] if len(sys.argv) > 1 else "osm.json"
S, W, N, E = 52.508, 13.093, 52.562, 13.197   # nur Wege, die hier hineinragen
LAT0 = 52.535
MX = 111320 * math.cos(math.radians(LAT0)); MY = 111320
LABELS = ["Heerstraße", "Brunsbütteler Damm", "Nennhauser Damm", "Magistratsweg", "Seegefelder Weg"]

d = json.load(open(QUELLE))

def xy(p): return ((p[1] - 13.14) * MX, (p[0] - LAT0) * MY)

def rdp(pts, eps):
    if len(pts) < 3: return pts
    a, b = xy(pts[0]), xy(pts[-1])
    dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        p = xy(pts[i])
        dist = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L
        if dist > dmax: dmax, idx = dist, i
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

def rund(pts): return [[round(p[0], 5), round(p[1], 5)] for p in pts]
def drin(pts): return any(S <= p[0] <= N and W <= p[1] <= E for p in pts)
def flaeche(pts):
    q = [xy(p) for p in pts]; s = 0
    for i in range(len(q)):
        x1, y1 = q[i]; x2, y2 = q[(i + 1) % len(q)]; s += x1 * y2 - x2 * y1
    return abs(s) / 2
def laenge(pts):
    q = [xy(p) for p in pts]
    return sum(math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]) for i in range(len(q) - 1))

strassen, bahn, gruen, wasser = [], [], [], []
laengste = {}
for e in d["elements"]:
    t = e.get("tags", {}); g = e.get("geometry")
    if not g: continue
    pts = [[p["lat"], p["lon"]] for p in g]
    if not drin(pts): continue
    if "highway" in t:
        k = t["highway"]; eps = 6 if k in ("trunk", "primary") else 8
        strassen.append({"k": k, "p": rund(rdp(pts, eps))})
        n = t.get("name")
        if n:
            L = laenge(pts)
            if n not in laengste or L > laengste[n][0]: laengste[n] = (L, rund(rdp(pts, 12)))
    elif t.get("railway") == "rail":
        if t.get("service"): continue
        bahn.append(rund(rdp(pts, 10)))
    elif t.get("natural") == "water":
        if flaeche(pts) < 8000: continue
        wasser.append(rund(rdp(pts, 10)))
    else:
        if flaeche(pts) < 20000: continue
        gruen.append(rund(rdp(pts, 12)))

labels = [{"n": n, "p": laengste[n][1]} for n in LABELS if n in laengste]
out = {
    "quelle": "Kartendaten © OpenStreetMap-Mitwirkende (ODbL)",
    "stand": "2026-10",
    "strassen": strassen, "bahn": bahn, "gruen": gruen, "wasser": wasser, "labels": labels
}
s = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
open("data/karte-hintergrund.json", "w").write(s)
print("Größe:", len(s) // 1024, "KB | Straßen:", len(strassen), "Bahn:", len(bahn), "Grün:", len(gruen),
      "Wasser:", len(wasser), "Labels:", [l["n"] for l in labels])
