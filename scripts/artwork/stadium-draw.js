// Procedural night-stadium artwork for the BETVANTA hero. Original, no third-party imagery.
function draw(W, H, opt) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  let seed = opt.seed || 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const S = H / 1440; // scale
  // Camera: elevated in the main stand, looking across at the far stand.
  const cx = W / 2, yH = H * opt.horizon, f = H * opt.focal, camH = 22;
  const Zc = 70, Zfar = Zc + 34, Znear = Zc - 34;
  const P = (X, Z) => [cx + (f * X) / Z, yH + (f * camH) / Z];
  const yFar = P(0, Zfar)[1];
  // Sky / darkness
  let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "#03090a"); gr.addColorStop(0.5, "#081615"); gr.addColorStop(1, "#050c0b");
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // Far stand geometry
  const standTop = yFar - H * opt.stand, roofY = standTop - 26 * S, tierBreak = standTop + (yFar - standTop) * 0.42;
  // Crowd texture via ImageData
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const pal = [[22,30,30],[30,38,40],[60,60,58],[90,84,76],[120,110,96],[18,61,59],[28,90,84],[196,124,82],[150,80,50],[200,190,176],[230,225,214],[70,40,30],[40,52,70]];
  const lightAt = (x, y) => { let s = 0; for (const L of lights) { const dx = (x - L.x) / (W * 0.22), dy = (y - L.y) / (H * 0.35); s += L.p / (1 + dx * dx * 3 + dy * dy * 4); } return s; };
  const lights = [];
  const nL = opt.lights;
  for (let i = 0; i < nL; i++) lights.push({ x: W * (0.5 + (i - (nL - 1) / 2) * opt.lightGap), y: roofY + 4 * S, p: 0.55 });
  for (let y = Math.floor(standTop); y < yFar; y++) {
    const t = (y - standTop) / (yFar - standTop); // 0 top, 1 bottom
    const cell = Math.max(2, Math.round((2.2 + t * 3.2) * S * opt.crowdScale));
    if (Math.abs(y - tierBreak) < 9 * S) continue; // concourse band drawn later
    for (let x = 0; x < W; x += cell) {
      const row = Math.floor(y / cell), colI = Math.floor(x / cell);
      const h = Math.sin(row * 127.1 + colI * 311.7) * 43758.5453, r = h - Math.floor(h);
      const aisle = ((x + y * 0.08) % (W / 9)) < 7 * S;
      let col = aisle ? [14, 20, 20] : pal[Math.floor(r * pal.length)];
      const L = 0.35 + lightAt(x, y) * 0.9 + t * 0.15;
      const vary = 0.6 + ((r * 7919) % 1) * 0.6;
      const phone = !aisle && r > 0.9965;
      for (let yy = 0; yy < 1; yy++) for (let xx = 0; xx < cell && x + xx < W; xx++) {
        // rounded heads: darken cell edges
        const edge = (xx === 0 || (y % cell) === 0) ? 0.55 : 1;
        const i = (y * W + x + xx) * 4;
        const k = phone ? 3.2 : L * vary * edge;
        d[i] = Math.min(255, col[0] * k + (phone ? 120 : 0)); d[i + 1] = Math.min(255, col[1] * k + (phone ? 120 : 0)); d[i + 2] = Math.min(255, col[2] * k + (phone ? 110 : 0));
      }
    }
  }
  g.putImageData(img, 0, 0);
  // Concourse band with lit hospitality windows
  g.fillStyle = "#0b1413"; g.fillRect(0, tierBreak - 9 * S, W, 18 * S);
  for (let x = 0; x < W; x += 34 * S) { g.fillStyle = `rgba(234,200,160,${0.25 + rnd() * 0.35})`; g.fillRect(x + 4 * S, tierBreak - 5 * S, 22 * S, 9 * S); }
  // Advertising board ring (neutral teal/copper, no text)
  g.fillStyle = "#0e2a28"; g.fillRect(0, yFar - 14 * S, W, 12 * S);
  for (let x = 0; x < W; x += 260 * S) { const gg = g.createLinearGradient(x, 0, x + 240 * S, 0); gg.addColorStop(0, "rgba(196,124,82,.0)"); gg.addColorStop(.5, "rgba(196,124,82,.55)"); gg.addColorStop(1, "rgba(196,124,82,.0)"); g.fillStyle = gg; g.fillRect(x, yFar - 12 * S, 240 * S, 8 * S); }
  { const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; tmp.getContext('2d').drawImage(c, 0, 0);
    g.save(); g.beginPath(); g.rect(0, standTop - 4 * S, W, yFar - standTop + 2 * S); g.clip(); g.filter = `blur(${1.8 * S}px) saturate(0.8)`; g.drawImage(tmp, 0, 0); g.restore(); g.filter = 'none'; }
  // Roof
  gr = g.createLinearGradient(0, roofY - 60 * S, 0, standTop); gr.addColorStop(0, "#02060600"); gr.addColorStop(0.6, "#0a1312"); gr.addColorStop(1, "#111c1b");
  g.fillStyle = gr; g.fillRect(0, roofY - 60 * S, W, standTop - roofY + 60 * S);
  g.fillStyle = "rgba(180,200,195,.18)"; g.fillRect(0, standTop - 2 * S, W, 2 * S);
  // Pitch
  const stripe = 105 / 20;
  for (let i = -14; i < 14; i++) {
    const X0 = i * stripe, X1 = X0 + stripe;
    const a = P(X0, Zfar), b = P(X1, Zfar), cc = P(X1 * Zfar / Znear * 0 + X1, 6), dd = P(X0, 6);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(cc[0], cc[1]); g.lineTo(dd[0], dd[1]); g.closePath();
    g.fillStyle = i % 2 ? "#173f33" : "#1b4a3b"; g.fill();
  }
  // Area beyond the pitch (track / apron)
  g.fillStyle = "#123326"; const fl = P(-200, Zfar), fr = P(200, Zfar); g.fillRect(0, yFar - 2 * S, W, (fl[1] - yFar) + 6 * S);
  // Lines
  g.strokeStyle = "rgba(240,240,232,.78)"; g.lineCap = "round";
  const line = (pts, w) => { g.lineWidth = w * S; g.beginPath(); pts.forEach(([X, Z], i) => { const [x, y] = P(X, Z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  const lw = (Z) => 3.2 * (Zc / Z);
  line([[-52.5, Zfar], [52.5, Zfar]], 2.4); line([[-52.5, Znear], [52.5, Znear]], 4.2);
  line([[-52.5, Zfar], [-52.5, Znear]], 3); line([[52.5, Zfar], [52.5, Znear]], 3);
  line([[0, Zfar], [0, Znear]], 3.2);
  const circ = []; for (let a = 0; a <= 64; a++) circ.push([Math.cos(a / 64 * Math.PI * 2) * 9.15, Zc + Math.sin(a / 64 * Math.PI * 2) * 9.15]); line(circ, 3.2);
  for (const s of [-1, 1]) { line([[s * 52.5, Zc - 20.16], [s * 36, Zc - 20.16], [s * 36, Zc + 20.16], [s * 52.5, Zc + 20.16]], 3); line([[s * 52.5, Zc - 9.16], [s * 47, Zc - 9.16], [s * 47, Zc + 9.16], [s * 52.5, Zc + 9.16]], 3);
    const arc = []; for (let a = -53; a <= 53; a += 4) arc.push([s * (41.5 - Math.cos(a * Math.PI / 180) * 9.15 + 9.15 - 9.15) + s * 0, 0]);
  }
  const [sx, sy] = P(0, Zc); g.fillStyle = "rgba(240,240,232,.9)"; g.beginPath(); g.ellipse(sx, sy, 5 * S, 2.4 * S, 0, 0, 7); g.fill();
  // Ball on the centre spot
  g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(sx + 10 * S, sy + 4 * S, 16 * S, 5 * S, 0, 0, 7); g.fill();
  let bg = g.createRadialGradient(sx - 4 * S, sy - 16 * S, 1, sx, sy - 11 * S, 13 * S); bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.7, "#d9d6cf"); bg.addColorStop(1, "#7d7a74");
  g.fillStyle = bg; g.beginPath(); g.arc(sx, sy - 11 * S, 12 * S, 0, 7); g.fill();
  // Light pools on the pitch
  g.globalCompositeOperation = "lighter";
  for (const L of lights) { const [px, py] = [L.x, yFar + (H - yFar) * 0.35]; const rg = g.createRadialGradient(px, py, 0, px, py, W * 0.32); rg.addColorStop(0, "rgba(120,160,140,.12)"); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(0, yFar, W, H - yFar); }
  // Light shafts and haze
  for (const L of lights) {
    const sg = g.createLinearGradient(0, L.y, 0, H * 0.95); sg.addColorStop(0, "rgba(255,244,225,.045)"); sg.addColorStop(1, "rgba(255,244,225,0)");
    g.fillStyle = sg; g.beginPath(); g.moveTo(L.x - 30 * S, L.y); g.lineTo(L.x + 30 * S, L.y); g.lineTo(L.x + W * 0.16, H); g.lineTo(L.x - W * 0.2, H); g.closePath(); g.fill();
  }
  const haze = g.createRadialGradient(cx, roofY + 80 * S, 0, cx, roofY + 80 * S, W * 0.7); haze.addColorStop(0, "rgba(160,190,180,.10)"); haze.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = haze; g.fillRect(0, 0, W, H);
  // Floodlight banks with bloom
  for (const L of lights) {
    for (let r of [W * 0.16, W * 0.07, W * 0.025]) { const rg = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, r); rg.addColorStop(0, "rgba(255,246,228,.55)"); rg.addColorStop(0.25, "rgba(255,226,190,.16)"); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(L.x - r, L.y - r, r * 2, r * 2); }
    const core = g.createRadialGradient(L.x, L.y, 0, L.x, L.y, 26 * S); core.addColorStop(0, "rgba(255,253,246,1)"); core.addColorStop(0.35, "rgba(255,246,228,.85)"); core.addColorStop(1, "rgba(255,240,215,0)");
    g.fillStyle = core; g.beginPath(); g.ellipse(L.x, L.y, 34 * S, 14 * S, 0, 0, 7); g.fill();
  }
  g.globalCompositeOperation = "source-over";
  // Vignette and grade
  const vg = g.createRadialGradient(cx, H * 0.45, Math.min(W, H) * 0.25, cx, H * 0.5, Math.max(W, H) * 0.8); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(2,10,10,.75)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "soft-light"; g.fillStyle = "rgba(18,61,59,.55)"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";
  // Grain
  const im2 = g.getImageData(0, 0, W, H), e = im2.data;
  for (let i = 0; i < e.length; i += 4) { const n = (rnd() - 0.5) * 14; e[i] += n; e[i + 1] += n; e[i + 2] += n; }
  g.putImageData(im2, 0, 0);
  return c;
}
