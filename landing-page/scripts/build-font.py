"""
Gera public/fonts/SmoothCircularsPASI.(otf|woff2) a partir de SmoothCirculars.otf,
adicionando os glifos do português que a fonte original não tem:
á à â ã é ê í ó ô õ ú ü ç (e maiúsculas), travessões, reticências e ponto médio.

Os acentos são desenhados com traços de pontas arredondadas, no mesmo espírito
geométrico da fonte. As letras da fonte são "unicase" (maiúsculas = minúsculas),
então os mesmos acentos servem para as duas.

Uso: python3 scripts/build-font.py   (requer: pip install fonttools brotli)
"""
import math
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public/fonts/SmoothCirculars.otf"
OUT = ROOT / "public/fonts/SmoothCircularsPASI"

STROKE = 165          # espessura dos acentos (a haste da fonte tem 192)
ACCENT_BOTTOM = 1010  # topo das letras = 896
ACCENT_TOP = 1260


def arc_points(cx, cy, r, a0, a1, steps):
    """Arco aproximado por quadráticas: devolve lista de (off, on)."""
    out = []
    da = (a1 - a0) / steps
    for i in range(steps):
        am = a0 + da * (i + 0.5)
        ae = a0 + da * (i + 1)
        k = r / math.cos(da / 2)
        out.append(((cx + k * math.cos(am), cy + k * math.sin(am)),
                    (cx + r * math.cos(ae), cy + r * math.sin(ae))))
    return out


def capsule(pen, p0, p1, w=STROKE):
    """Traço reto com pontas redondas de p0 a p1 (contorno horário)."""
    (x0, y0), (x1, y1) = p0, p1
    r = w / 2
    ang = math.atan2(y1 - y0, x1 - x0)
    n = ang + math.pi / 2
    start = (x0 + r * math.cos(n), y0 + r * math.sin(n))
    pen.moveTo(rnd(start))
    # lado esquerdo até p1, semicírculo em p1, volta, semicírculo em p0
    pen.lineTo(rnd((x1 + r * math.cos(n), y1 + r * math.sin(n))))
    for off, on in arc_points(x1, y1, r, n, n - math.pi, 4):
        pen.qCurveTo(rnd(off), rnd(on))
    pen.lineTo(rnd((x0 + r * math.cos(n - math.pi), y0 + r * math.sin(n - math.pi))))
    for off, on in arc_points(x0, y0, r, n - math.pi, n - 2 * math.pi, 4):
        pen.qCurveTo(rnd(off), rnd(on))
    pen.closePath()


def dot(pen, cx, cy, d):
    r = d / 2
    pen.moveTo(rnd((cx + r, cy)))
    for off, on in arc_points(cx, cy, r, 0, -2 * math.pi, 8):
        pen.qCurveTo(rnd(off), rnd(on))
    pen.closePath()


def polyline(pen, pts, w=STROKE):
    for a, b in zip(pts, pts[1:]):
        capsule(pen, a, b, w)


def rnd(p):
    return (round(p[0]), round(p[1]))


# ---- acentos (desenhados em torno de cx) --------------------------------

def acute(pen, cx):
    capsule(pen, (cx - 70, ACCENT_BOTTOM + STROKE / 2), (cx + 70, ACCENT_TOP - STROKE / 2))


def grave(pen, cx):
    capsule(pen, (cx + 70, ACCENT_BOTTOM + STROKE / 2), (cx - 70, ACCENT_TOP - STROKE / 2))


def circumflex(pen, cx):
    b, t = ACCENT_BOTTOM + STROKE / 2, ACCENT_TOP - STROKE / 2
    polyline(pen, [(cx - 150, b), (cx, t), (cx + 150, b)])


def tilde(pen, cx):
    mid = (ACCENT_BOTTOM + ACCENT_TOP) / 2
    amp = 45
    pts = [(cx - 190 + i * 380 / 12, mid + amp * math.sin(math.pi * 2 * i / 12 + math.pi))
           for i in range(13)]
    # a onda começa descendo à esquerda e sobe à direita, como um til
    pts = [(x, 2 * mid - y) for x, y in pts]
    polyline(pen, pts, STROKE - 10)


def dieresis(pen, cx):
    y = (ACCENT_BOTTOM + ACCENT_TOP) / 2
    dot(pen, cx - 150, y, 170)
    dot(pen, cx + 150, y, 170)


def cedilla(pen, cx):
    w = 125
    polyline(pen, [(cx, -10), (cx, -100), (cx + 55, -118), (cx + 85, -160), (cx + 72, -212), (cx + 25, -240), (cx - 55, -245)], w)


ACCENTS = {"acute": acute, "grave": grave, "circumflex": circumflex,
           "tilde": tilde, "dieresis": dieresis}

LETTERS = {
    "a": ["acute", "grave", "circumflex", "tilde"],
    "e": ["acute", "circumflex"],
    "i": ["acute"],
    "o": ["acute", "circumflex", "tilde"],
    "u": ["acute", "dieresis"],
}
UNICODE = {
    ("a", "acute"): 0xE1, ("a", "grave"): 0xE0, ("a", "circumflex"): 0xE2, ("a", "tilde"): 0xE3,
    ("e", "acute"): 0xE9, ("e", "circumflex"): 0xEA,
    ("i", "acute"): 0xED,
    ("o", "acute"): 0xF3, ("o", "circumflex"): 0xF4, ("o", "tilde"): 0xF5,
    ("u", "acute"): 0xFA, ("u", "dieresis"): 0xFC,
}


def main():
    font = TTFont(SRC)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    glyf, hmtx = font["glyf"], font["hmtx"]
    new = {}

    def bounds(name):
        bp = BoundsPen(gs)
        gs[name].draw(bp)
        return bp.bounds

    def base_contours(name, drop_dot=False):
        rec = RecordingPen()
        gs[name].draw(rec)
        if not drop_dot:
            return rec.value
        # "i" sem o pingo: mantém só o contorno da haste (o que começa em y baixo)
        contours, cur = [], []
        for op in rec.value:
            cur.append(op)
            if op[0] in ("closePath", "endPath"):
                contours.append(cur)
                cur = []
        stem = [c for c in contours if min(p[1] for o in c for p in o[1]) < 100]
        return [op for c in stem for op in c]

    def make(name, base, uni_list, draw_extra, drop_dot=False):
        pen = TTGlyphPen(None)
        for op, args in base_contours(base, drop_dot):
            getattr(pen, op)(*args)
        draw_extra(pen)
        new[name] = (pen.glyph(), hmtx[base], uni_list)

    for base, accents in LETTERS.items():
        for base_char in (base, base.upper()):
            gname = cmap[ord(base_char)]
            x0, _, x1, _ = bounds(gname)
            cx = (x0 + x1) / 2
            for acc in accents:
                uni = UNICODE[(base, acc)]
                if base_char.isupper():
                    uni -= 0x20
                name = f"{base_char}{acc}"
                make(name, gname, [uni], lambda p, a=acc, c=cx: ACCENTS[a](p, c),
                     drop_dot=(base == "i"))

    for base_char, uni in (("c", 0xE7), ("C", 0xC7)):
        gname = cmap[ord(base_char)]
        x0, _, x1, _ = bounds(gname)
        cx = (x0 + x1) / 2
        make(f"{base_char}cedilla", gname, [uni], lambda p, c=cx: cedilla(p, c))

    # travessões, reticências e ponto médio, derivados do hífen e do ponto
    hy_w = hmtx[cmap[ord("-")]][0]

    def dash(width):
        def draw(pen):
            y0, y1 = 384, 576
            r = (y1 - y0) / 2
            capsule(pen, (r, (y0 + y1) / 2), (width - r, (y0 + y1) / 2), y1 - y0)
        return draw

    pen = TTGlyphPen(None); dash(896)(pen)
    new["endash"] = (pen.glyph(), (hy_w, 0), [0x2013])
    pen = TTGlyphPen(None); dash(1344)(pen)
    new["emdash"] = (pen.glyph(), (1472, 0), [0x2014])

    per = cmap[ord(".")]
    pw = hmtx[per][0]
    pen = TTGlyphPen(None)
    rec = RecordingPen(); gs[per].draw(rec)
    for k in range(3):
        for op, args in rec.value:
            getattr(pen, op)(*[(x + k * 256, y) for x, y in args])
    new["ellipsis"] = (pen.glyph(), (256 * 2 + pw, 0), [0x2026])

    pen = TTGlyphPen(None)
    for op, args in rec.value:
        getattr(pen, op)(*[(x, y + 352) for x, y in args])
    new["periodcentered"] = (pen.glyph(), (pw, 0), [0xB7])

    order = font.getGlyphOrder()
    for name, (glyph, metrics, unis) in new.items():
        glyf[name] = glyph
        hmtx[name] = metrics
        if name not in order:
            order.append(name)
        for sub in font["cmap"].tables:
            if sub.isUnicode():
                for u in unis:
                    sub.cmap[u] = name
    font.setGlyphOrder(order)
    font["maxp"].numGlyphs = len(order)
    if "DSIG" in font:
        del font["DSIG"]

    for rec in font["name"].names:
        if rec.nameID in (1, 4):
            rec.string = "Smooth Circulars PASI"
        elif rec.nameID == 6:
            rec.string = "SmoothCircularsPASI"
        elif rec.nameID == 3:
            rec.string = "Smooth Circulars PASI:Version 1.01"
        elif rec.nameID == 5:
            rec.string = "Version 1.01; acentos do portugues adicionados para o projeto PASI"
    font["name"].setName(
        "Derivada de Smooth Circulars (c) Darrell Flood 2014, fontstruct.com. "
        "Glifos acentuados adicionados para o projeto PASI.", 10, 3, 1, 0x409)

    font.save(OUT.with_suffix(".otf"))
    font.flavor = "woff2"
    font.save(OUT.with_suffix(".woff2"))
    print(f"{len(new)} glifos adicionados -> {OUT.name}.otf / .woff2")


if __name__ == "__main__":
    main()
