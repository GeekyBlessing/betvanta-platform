# Generates BETVANTA's original sport illustrations (no third-party artwork). Output: SVG, viewBox 0 0 240 240.
import math, sys, os
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

def svg(body, defs=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs>{defs}</defs>{body}</svg>\n'

def shadow(cx=120, cy=214, rx=70, ry=8, o=0.10):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#0b1630" opacity="{o}"/>'

def f(n): return f"{n:.2f}".rstrip("0").rstrip(".")

# ---------- Soccer: a real truncated icosahedron projected onto a sphere ----------
def soccer():
    phi = (1 + 5 ** 0.5) / 2
    base = []
    def perms(v):
        x, y, z = v
        return [(x, y, z), (z, x, y), (y, z, x)]
    seeds = [(0, 1, 3 * phi), (1, 2 + phi, 2 * phi), (phi, 2, 2 * phi + 1)]
    for s in seeds:
        for p in perms(s):
            for sx in (1, -1):
                for sy in (1, -1):
                    for sz in (1, -1):
                        v = (p[0] * sx, p[1] * sy, p[2] * sz)
                        if all(abs(v[0] - b[0]) + abs(v[1] - b[1]) + abs(v[2] - b[2]) > 1e-6 for b in base):
                            base.append(v)
    assert len(base) == 60, len(base)
    norm = lambda v: math.sqrt(sum(c * c for c in v))
    unit = lambda v: tuple(c / norm(v) for c in v)
    V = [unit(v) for v in base]
    # icosahedron vertex directions -> pentagon centres; icosahedron face centres -> hexagon centres
    ico = []
    for a in (1, -1):
        for b in (phi, -phi):
            ico += [(0, a, b), (a, b, 0), (b, 0, a)]
    ico = [unit(v) for v in ico]
    dot = lambda a, b: sum(x * y for x, y in zip(a, b))
    faces = []
    for c in ico:
        faces.append(("p", c, sorted(range(60), key=lambda i: -dot(V[i], c))[:5]))
    tri = set()
    for i in range(12):
        for j in range(12):
            for k in range(12):
                if i < j < k and dot(ico[i], ico[j]) > 0.4 and dot(ico[j], ico[k]) > 0.4 and dot(ico[i], ico[k]) > 0.4:
                    tri.add((i, j, k))
    for t in tri:
        c = unit(tuple(sum(ico[i][d] for i in t) for d in range(3)))
        faces.append(("h", c, sorted(range(60), key=lambda i: -dot(V[i], c))[:6]))
    assert len(faces) == 32
    # rotate for a pleasing view
    def rot(v, ax, ay, az):
        x, y, z = v
        y, z = y * math.cos(ax) - z * math.sin(ax), y * math.sin(ax) + z * math.cos(ax)
        x, z = x * math.cos(ay) + z * math.sin(ay), -x * math.sin(ay) + z * math.cos(ay)
        x, y = x * math.cos(az) - y * math.sin(az), x * math.sin(az) + y * math.cos(az)
        return (x, y, z)
    A = (0.35, -0.42, 0.15)
    R, CX, CY = 88, 120, 112
    def proj(v):
        x, y, z = rot(v, *A)
        return (CX + R * x, CY - R * y, z)
    polys = []
    for kind, c, idx in faces:
        cz = rot(c, *A)[2]
        # order vertices around the face centre
        cc = c
        ref = unit(tuple(V[idx[0]][d] - dot(V[idx[0]], cc) * cc[d] for d in range(3)))
        cr = (cc[1] * ref[2] - cc[2] * ref[1], cc[2] * ref[0] - cc[0] * ref[2], cc[0] * ref[1] - cc[1] * ref[0])
        idx = sorted(idx, key=lambda i: math.atan2(dot(V[i], cr), dot(V[i], ref)))
        # curved edges: subdivide, push back onto the sphere
        pts = []
        for a, b in zip(idx, idx[1:] + idx[:1]):
            for s in range(8):
                t = s / 8
                m = unit(tuple(V[a][d] * (1 - t) + V[b][d] * t for d in range(3)))
                pts.append(proj(m))
        if cz > -0.35:
            polys.append((cz, kind, pts))
    polys.sort(key=lambda p: p[0])
    body = []
    for cz, kind, pts in polys:
        d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y, _ in pts) + "Z"
        fill = "#151a22" if kind == "p" else "#ffffff"
        body.append(f'<path d="{d}" fill="{fill}" stroke="#9aa3ae" stroke-width="1.3" stroke-linejoin="round"/>')
    defs = (f'<clipPath id="sb"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath>'
            f'<radialGradient id="ss" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/>'
            f'<stop offset="0.8" stop-color="#0b1630" stop-opacity="0.18"/><stop offset="1" stop-color="#0b1630" stop-opacity="0.42"/></radialGradient>')
    return svg(shadow(rx=64) + f'<g clip-path="url(#sb)"><circle cx="{CX}" cy="{CY}" r="{R}" fill="#fff"/>' + "".join(body) +
               f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="url(#ss)"/></g><circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="#7d8793" stroke-width="1.5"/>', defs)

# ---------- American football ----------
def american_football():
    defs = ('<linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a65a2c"/><stop offset="0.55" stop-color="#7e3f1b"/><stop offset="1" stop-color="#55280f"/></linearGradient>'
            '<radialGradient id="hl" cx="0.42" cy="0.28" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
            '<clipPath id="fb"><path d="__FB__"/></clipPath>')
    ball = '__FB__'
    laces = "".join(f'<rect x="{f(x - 3)}" y="88" width="6" height="22" rx="3" fill="#fbf8f2"/>' for x in range(94, 150, 11))
    g = (f'<g transform="rotate(-20 120 116)">'
         f'<path d="{ball}" fill="url(#lg)" stroke="#3d1c09" stroke-width="2.5" stroke-linejoin="round"/>'
         f'<g clip-path="url(#fb)"><path d="M60,78 Q50,120 60,162" fill="none" stroke="#fbf8f2" stroke-width="9"/>'
         f'<path d="M180,78 Q190,120 180,162" fill="none" stroke="#fbf8f2" stroke-width="9"/>'
         f'<path d="M30,120 C60,108 180,108 210,120" fill="none" stroke="#3d1c09" stroke-opacity="0.35" stroke-width="1.5"/>'
         f'<path d="{ball}" fill="url(#hl)"/></g>'
         f'<path d="M88,99 L156,99" stroke="#fbf8f2" stroke-width="4" stroke-linecap="round"/>{laces}</g>')
    a, h, e = 106, 60, 1.0
    top = [(120 + a * u, 120 - h * (1 - u * u) ** e) for u in [-1 + 2 * i / 80 for i in range(81)]]
    path = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in top + [(x, 240 - y) for x, y in reversed(top)][1:-1]) + "Z"
    return svg(shadow(rx=78) + g, defs).replace("__FB__", path)

# ---------- Basketball ----------
def basketball():
    defs = ('<radialGradient id="bb" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffab5c"/><stop offset="0.55" stop-color="#ec7a2a"/><stop offset="1" stop-color="#b44d12"/></radialGradient>'
            '<clipPath id="bc"><circle cx="120" cy="112" r="88"/></clipPath>'
            '<pattern id="pb" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.8" fill="#7a3208" opacity="0.25"/></pattern>')
    s = 'fill="none" stroke="#2a160a" stroke-width="4.5" stroke-linecap="round"'
    g = (f'<circle cx="120" cy="112" r="88" fill="url(#bb)"/><circle cx="120" cy="112" r="88" fill="url(#pb)"/>'
         f'<g clip-path="url(#bc)" transform="rotate(-18 120 112)"><path d="M120,20 L120,204" {s}/><path d="M28,112 C70,126 170,126 212,112" {s}/>'
         f'<path d="M58,40 C92,72 92,152 58,184" {s}/><path d="M182,40 C148,72 148,152 182,184" {s}/></g>'
         f'<circle cx="120" cy="112" r="88" fill="none" stroke="#2a160a" stroke-width="3"/>')
    return svg(shadow(rx=64) + g, defs)

# ---------- Baseball: ball in front of a wooden bat ----------
def stitches(p0, p1, p2, p3, n, side):
    out = []
    for i in range(1, n):
        t = i / n
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]
        dx = -3 * (1 - t) ** 2 * p0[0] + 3 * (1 - t) ** 2 * p1[0] - 6 * (1 - t) * t * p1[0] + 6 * (1 - t) * t * p2[0] - 3 * t * t * p2[0] + 3 * t * t * p3[0]
        dy = -3 * (1 - t) ** 2 * p0[1] + 3 * (1 - t) ** 2 * p1[1] - 6 * (1 - t) * t * p1[1] + 6 * (1 - t) * t * p2[1] - 3 * t * t * p2[1] + 3 * t * t * p3[1]
        L = math.hypot(dx, dy); tx, ty = dx / L, dy / L; nx, ny = -ty * side, tx * side
        a = (x + nx * 7 - tx * 3, y + ny * 7 - ty * 3); b = (x + nx * 2, y + ny * 2); c = (x + nx * 7 + tx * 3, y + ny * 7 + ty * 3)
        out.append(f'<path d="M{f(a[0])},{f(a[1])} L{f(b[0])},{f(b[1])} L{f(c[0])},{f(c[1])}" fill="none" stroke="#d3262e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>')
    return "".join(out)

def baseball():
    defs = ('<linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e6b77a"/><stop offset="0.5" stop-color="#c98d4a"/><stop offset="1" stop-color="#9c6630"/></linearGradient>'
            '<radialGradient id="bw" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f1ede4"/><stop offset="1" stop-color="#d3ccbf"/></radialGradient>'
            '<clipPath id="bwc"><circle cx="148" cy="152" r="56"/></clipPath>')
    bat = ('<g transform="rotate(45 112 112)"><path d="M108,6 C108,2 132,2 132,6 L130,120 L126,196 L114,196 L110,120 Z" fill="url(#wood)" stroke="#6e4318" stroke-width="2"/>'
           '<rect x="112" y="166" width="16" height="30" fill="#1f2a3a"/><path d="M112,172 L128,170 M112,180 L128,178 M112,188 L128,186" stroke="#3b4a60" stroke-width="2"/>'
           '<ellipse cx="120" cy="200" rx="13" ry="6" fill="#6e4318"/></g>')
    l = ((116, 104), (140, 130), (140, 174), (116, 202))
    r = ((180, 104), (156, 130), (156, 174), (180, 202))
    ball = (f'<circle cx="148" cy="152" r="56" fill="url(#bw)" stroke="#b9b0a1" stroke-width="2"/>'
            f'<g clip-path="url(#bwc)"><path d="M{l[0][0]},{l[0][1]} C{l[1][0]},{l[1][1]} {l[2][0]},{l[2][1]} {l[3][0]},{l[3][1]}" fill="none" stroke="#c9bfae" stroke-width="2"/>'
            f'<path d="M{r[0][0]},{r[0][1]} C{r[1][0]},{r[1][1]} {r[2][0]},{r[2][1]} {r[3][0]},{r[3][1]}" fill="none" stroke="#c9bfae" stroke-width="2"/>'
            + stitches(l[0], l[1], l[2], l[3], 10, -1) + stitches(r[0], r[1], r[2], r[3], 10, 1) + '</g>')
    return svg(shadow(cx=124, rx=80) + bat + ball, defs)

# ---------- Ice hockey: crossed sticks and a puck ----------
def hockey():
    defs = ('<linearGradient id="sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9a368"/><stop offset="1" stop-color="#a8723a"/></linearGradient>'
            '<linearGradient id="pk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f48"/><stop offset="1" stop-color="#0d1015"/></linearGradient>')
    def stick(mirror):
        t = f'transform="translate(240 0) scale(-1 1)"' if mirror else ''
        return (f'<g {t}><path d="M182,22 L194,28 L96,176 L84,170 Z" fill="url(#sh)" stroke="#6e4318" stroke-width="2" stroke-linejoin="round"/>'
                f'<path d="M84,170 L96,176 C92,188 84,196 70,198 L30,200 C22,200 20,190 28,188 L66,184 C74,183 80,178 84,170 Z" fill="#1d232c" stroke="#0b0e12" stroke-width="2" stroke-linejoin="round"/>'
                f'<path d="M40,190 L72,187 M46,195 L76,192" stroke="#3b4554" stroke-width="1.5"/>'
                f'<path d="M176,31 L188,37 L180,49 L168,43 Z" fill="#f4f1ea" stroke="#c7c0b2" stroke-width="1.2"/>'
                f'<path d="M150,72 L162,78 L157,86 L145,80 Z" fill="#c4372d"/></g>')
    puck = ('<ellipse cx="120" cy="196" rx="34" ry="11" fill="#0b0e12"/><rect x="86" y="182" width="68" height="14" fill="url(#pk)"/>'
            '<ellipse cx="120" cy="182" rx="34" ry="11" fill="#2b3039" stroke="#0b0e12" stroke-width="1.5"/><ellipse cx="114" cy="180" rx="14" ry="3.5" fill="#fff" opacity="0.12"/>')
    return svg(shadow(cy=212, rx=96) + stick(False) + stick(True) + puck, defs)

# ---------- Tennis: racket and ball ----------
def tennis():
    defs = ('<radialGradient id="tb" cx="0.38" cy="0.32" r="0.75"><stop offset="0" stop-color="#f1fa7a"/><stop offset="0.6" stop-color="#d6e43a"/><stop offset="1" stop-color="#a5b51c"/></radialGradient>'
            '<clipPath id="head"><ellipse cx="0" cy="0" rx="50" ry="62"/></clipPath><clipPath id="tbc"><circle cx="80" cy="164" r="38"/></clipPath>')
    strings = "".join(f'<line x1="{x}" y1="-70" x2="{x}" y2="70" stroke="#c9ced6" stroke-width="1.6"/>' for x in range(-45, 50, 10)) + \
              "".join(f'<line x1="-60" y1="{y}" x2="60" y2="{y}" stroke="#c9ced6" stroke-width="1.6"/>' for y in range(-57, 62, 10))
    racket = (f'<g transform="translate(116 88) rotate(-36)">'
              f'<path d="M-9,62 L-6,150 L6,150 L9,62 C20,72 -20,72 -9,62Z" fill="#1d3a5f"/>'
              f'<path d="M-14,58 C-6,82 -6,90 -7,104 M14,58 C6,82 6,90 7,104" fill="none" stroke="#1d3a5f" stroke-width="7" stroke-linecap="round"/>'
              f'<rect x="-9" y="104" width="18" height="52" rx="5" fill="#f4f1ea" stroke="#cfc8bb" stroke-width="1.5"/>'
              + "".join(f'<path d="M-9,{y} L9,{y + 7}" stroke="#d8d2c6" stroke-width="2"/>' for y in range(108, 152, 8)) +
              f'<rect x="-10" y="150" width="20" height="8" rx="3" fill="#1d3a5f"/>'
              f'<g clip-path="url(#head)">{strings}</g>'
              f'<ellipse cx="0" cy="0" rx="54" ry="66" fill="none" stroke="#c0392b" stroke-width="9"/>'
              f'<ellipse cx="0" cy="0" rx="54" ry="66" fill="none" stroke="#1d3a5f" stroke-width="3" stroke-dasharray="14 8"/></g>')
    ball = ('<circle cx="80" cy="164" r="38" fill="url(#tb)" stroke="#8d9a17" stroke-width="1.5"/>'
            '<g clip-path="url(#tbc)"><path d="M48,142 C70,154 70,182 50,196" fill="none" stroke="#fbfdf0" stroke-width="4"/>'
            '<path d="M114,132 C92,146 92,174 114,188" fill="none" stroke="#fbfdf0" stroke-width="4"/></g>')
    return svg(shadow(cx=118, rx=84) + racket + ball, defs)

# ---------- Boxing glove ----------
def boxing():
    defs = ('<linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0504a"/><stop offset="0.6" stop-color="#cf1f1f"/><stop offset="1" stop-color="#8f0f12"/></linearGradient>'
            '<radialGradient id="ghl" cx="0.35" cy="0.25" r="0.45"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>')
    body = ('M70,128 C52,96 58,48 104,32 C146,18 186,38 188,82 C190,116 176,140 160,150 L156,160 L86,160 C84,150 78,140 70,128 Z')
    thumb = 'M72,124 C58,112 50,128 58,142 C66,156 84,160 96,150 C104,142 100,128 88,124 C82,122 76,124 72,124 Z'
    g = (f'<path d="{body}" fill="url(#gl)" stroke="#6d0b0e" stroke-width="2.5" stroke-linejoin="round"/>'
         f'<path d="M108,44 C140,36 170,50 176,80" fill="none" stroke="#6d0b0e" stroke-opacity="0.35" stroke-width="2"/>'
         f'<path d="M96,104 C120,96 150,98 172,108" fill="none" stroke="#6d0b0e" stroke-opacity="0.45" stroke-width="2.5"/>'
         f'<path d="{thumb}" fill="url(#gl)" stroke="#6d0b0e" stroke-width="2.5"/>'
         f'<path d="{body}" fill="url(#ghl)"/>'
         f'<path d="M86,158 L156,158 L152,206 L92,206 Z" fill="#c71d1f" stroke="#6d0b0e" stroke-width="2.5" stroke-linejoin="round"/>'
         f'<path d="M87,166 L155,166 L154,180 L88,180 Z" fill="#f7f4ee" stroke="#c9c2b6" stroke-width="1.5"/>'
         f'<path d="M110,186 L134,200 M134,186 L110,200" stroke="#f7f4ee" stroke-width="3" stroke-linecap="round"/>'
         f'<path d="M92,206 L152,206" stroke="#6d0b0e" stroke-width="3"/>')
    return svg(shadow(cy=214, rx=58) + g, defs)

# ---------- MMA: open-finger fight glove, front view of a closed fist ----------
def mma():
    defs = ('<linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#454c58"/><stop offset="1" stop-color="#12161c"/></linearGradient>'
            '<linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efc3a4"/><stop offset="1" stop-color="#cf9572"/></linearGradient>')
    fingers = "".join(f'<rect x="{x}" y="100" width="28" height="44" rx="13" fill="url(#sk)" stroke="#a46a4b" stroke-width="1.8"/>'
                      f'<path d="M{x + 7},{132} q7,4 14,0" fill="none" stroke="#a46a4b" stroke-width="1.4"/>' for x in (64, 92, 120, 148))
    g = ('<rect x="62" y="132" width="116" height="78" rx="20" fill="url(#mg)" stroke="#07090c" stroke-width="2.5"/>'
         + fingers +
         '<path d="M58,150 C58,136 72,132 86,136 L142,146 C152,148 154,162 144,164 L84,166 C68,166 58,160 58,150 Z" fill="url(#sk)" stroke="#a46a4b" stroke-width="1.8"/>'
         '<path d="M130,149 C138,150 142,156 138,161" fill="none" stroke="#a46a4b" stroke-width="1.4"/>'
         '<rect x="54" y="34" width="132" height="76" rx="32" fill="url(#mg)" stroke="#07090c" stroke-width="2.5"/>'
         '<path d="M74,52 C108,42 140,42 168,52" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="6" stroke-linecap="round"/>'
         '<path d="M62,98 C100,104 140,104 178,98" fill="none" stroke="#07090c" stroke-opacity="0.6" stroke-width="2"/>'
         '<rect x="58" y="172" width="124" height="26" rx="5" fill="#c4372d" stroke="#7a1a14" stroke-width="2"/>'
         '<path d="M64,178 L176,178 M64,192 L176,192" stroke="#ec7b70" stroke-width="1.2" stroke-dasharray="4 3"/>')
    return svg(shadow(cy=216, rx=70) + g, defs)

ART = {"american-football": american_football, "soccer": soccer, "basketball": basketball, "baseball": baseball,
       "ice-hockey": hockey, "tennis": tennis, "boxing": boxing, "mma": mma}
for name, fn in ART.items():
    open(os.path.join(OUT, f"{name}.svg"), "w").write(fn())
print("wrote", len(ART))
