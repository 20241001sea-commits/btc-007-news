/* BTC-007 News — activity lattice, hero ticks, and market-link orb.
   Original visualization. Not copied from eqn.news or RetroValix. */
(function () {
  const SPARK = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
  const HERO_MS = 720;
  const GLOW_MS = 1400;
  const CORR_MIN = 0.72;
  const MAX_LINKS_PER = 3;
  const heroPrev = new Map();
  const heroRaf = new Map();
  const lattices = new Map();
  let orb = null;

  const $ = (id) => document.getElementById(id);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const app = () => window.BTC007_APP || null;
  const cssVar = (name, fallback) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  const token = () => ({
    up: cssVar("--up", "#46f0b0"),
    down: cssVar("--down", "#ff9b6e"),
    accent: cssVar("--accent", "#7af0e0"),
    text: cssVar("--text", "#f3f6f9"),
    faint: cssVar("--text-faint", "#8b9aab"),
    bg: cssVar("--bg", "#071018")
  });

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function playHero(el, value, opts = {}) {
    if (!el || value == null || Number.isNaN(Number(value))) return;
    const next = Number(value);
    const key = opts.key || el.getAttribute("data-hero") || el;
    const format = opts.format || ((n) => String(n));
    const prev = heroPrev.get(key);
    heroPrev.set(key, next);
    const dir = prev == null ? 0 : next - prev;
    if (opts.dirClass) {
      el.classList.remove("hero-up", "hero-down");
      if (dir > 0) el.classList.add("hero-up");
      else if (dir < 0) el.classList.add("hero-down");
    }
    if (prev == null || prev === next || reduced()) {
      const raf = heroRaf.get(key);
      if (raf) cancelAnimationFrame(raf);
      el.textContent = format(next);
      return;
    }
    const from = prev;
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / HERO_MS);
      el.textContent = format(from + (next - from) * easeOut(t));
      if (t < 1) heroRaf.set(key, requestAnimationFrame(step));
      else {
        heroRaf.delete(key);
        el.textContent = format(next);
      }
    };
    const raf = heroRaf.get(key);
    if (raf) cancelAnimationFrame(raf);
    heroRaf.set(key, requestAnimationFrame(step));
  }

  function ensureLattice(id, keys, compact) {
    const box = typeof id === "string" ? $(id) : id;
    if (!box) return null;
    const list = (keys || []).map(String);
    let st = lattices.get(box);
    const same = st && st.keys.join("\0") === list.join("\0") && st.compact === !!compact;
    if (same) return st;
    const n = Math.max(list.length, compact ? 16 : 40);
    const cols = compact ? Math.min(16, Math.max(8, Math.ceil(Math.sqrt(n * 2)))) : Math.min(20, Math.max(10, Math.ceil(Math.sqrt(n * 1.6))));
    const rows = Math.max(compact ? 2 : 4, Math.ceil(n / cols));
    const total = cols * rows;
    box.classList.add("fx-lattice");
    if (compact) box.classList.add("is-compact");
    box.style.setProperty("--fx-cols", String(cols));
    box.innerHTML = Array.from({ length: total }, (_, i) => {
      const k = list[i] || "";
      return `<i class="fx-cell" data-k="${k.replace(/"/g, "")}" aria-hidden="true"></i>`;
    }).join("");
    st = { box, keys: list, compact: !!compact, index: new Map(list.map((k, i) => [k, i])), primed: st ? st.primed : false };
    lattices.set(box, st);
    return st;
  }

  function hitLattice(id, key, dir) {
    const box = typeof id === "string" ? $(id) : id;
    if (!box) return;
    const st = lattices.get(box);
    if (!st) return;
    if (!st.primed) { st.primed = true; return; }
    const i = st.index.has(key) ? st.index.get(key) : Math.abs(hash(key)) % st.box.children.length;
    const cell = st.box.children[i];
    if (!cell) return;
    const tone = dir === "down" || dir === "short" ? "down" : dir === "flat" ? "flat" : "up";
    cell.classList.remove("is-up", "is-down", "is-flat", "is-lit");
    void cell.offsetWidth;
    cell.classList.add("is-lit", "is-" + tone);
    window.setTimeout(() => cell.classList.remove("is-lit", "is-up", "is-down", "is-flat"), GLOW_MS + 80);
  }

  function primeLattice(id) {
    const box = typeof id === "string" ? $(id) : id;
    const st = box && lattices.get(box);
    if (st) st.primed = true;
  }

  function hash(s) {
    let h = 0;
    const str = String(s);
    for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function sparkReturns(sp) {
    if (typeof sp !== "string" || sp.length < 12) return null;
    const vals = [];
    for (let i = 0; i < sp.length; i++) {
      const v = SPARK.indexOf(sp[i]);
      if (v < 0) return null;
      vals.push(v);
    }
    const ret = [];
    let energy = 0;
    for (let i = 1; i < vals.length; i++) {
      const d = vals[i] - vals[i - 1];
      ret.push(d);
      energy += d * d;
    }
    if (energy < 8) return null;
    return ret;
  }

  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 10) return null;
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const xa = a[i] - ma, xb = b[i] - mb;
      num += xa * xb; da += xa * xa; db += xb * xb;
    }
    if (da < 1e-6 || db < 1e-6) return null;
    return num / Math.sqrt(da * db);
  }

  function fibSphere(n) {
    const out = [];
    const off = 2 / n;
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + 0.5) * off;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * phi;
      out.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }
    return out;
  }

  function buildGraph(rows, limit) {
    const list = (rows || []).slice(0, limit);
    const series = list.map((r) => sparkReturns(r.sp));
    const links = [];
    const used = new Array(list.length).fill(0);
    const pairs = [];
    for (let i = 0; i < list.length; i++) {
      if (!series[i]) continue;
      for (let j = i + 1; j < list.length; j++) {
        if (!series[j]) continue;
        const c = pearson(series[i], series[j]);
        if (c != null && c >= CORR_MIN) pairs.push({ i, j, c });
      }
    }
    pairs.sort((a, b) => b.c - a.c);
    for (const p of pairs) {
      if (used[p.i] >= MAX_LINKS_PER || used[p.j] >= MAX_LINKS_PER) continue;
      used[p.i] += 1; used[p.j] += 1;
      links.push(p);
    }
    const pts = fibSphere(list.length);
    return { nodes: list.map((r, i) => ({ rec: r, p: pts[i] })), links };
  }

  function setupOrb() {
    const host = $("markets-orb");
    if (!host) return null;
    let canvas = host.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);
    }
    let tip = $("markets-orb-tip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "markets-orb-tip";
      tip.className = "fx-orb-tip";
      tip.hidden = true;
      host.appendChild(tip);
    }
    const st = {
      host, canvas, tip, ctx: canvas.getContext("2d"),
      graph: { nodes: [], links: [] },
      rot: 0.35, raf: 0, last: 0, hover: -1, visible: false, active: false,
      dpr: 1, w: 0, h: 0, cx: 0, cy: 0, R: 0, proj: []
    };
    const ro = new ResizeObserver(() => resizeOrb(st));
    ro.observe(host);
    const io = new IntersectionObserver((ents) => {
      st.visible = ents.some((e) => e.isIntersecting);
      bumpOrb(st);
    }, { threshold: 0.15 });
    io.observe(host);
    canvas.addEventListener("mousemove", (e) => onOrbMove(st, e));
    canvas.addEventListener("mouseleave", () => { st.hover = -1; st.tip.hidden = true; st.canvas.style.cursor = "default"; });
    canvas.addEventListener("click", () => {
      if (st.hover < 0) return;
      const rec = st.graph.nodes[st.hover] && st.graph.nodes[st.hover].rec;
      if (rec && app() && app().openCoinDetail) app().openCoinDetail(rec.s, { pinned: true });
    });
    return st;
  }

  function resizeOrb(st) {
    const r = st.host.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    st.w = Math.max(1, Math.floor(r.width));
    st.h = Math.max(1, Math.floor(r.height));
    st.dpr = dpr;
    st.canvas.width = Math.floor(st.w * dpr);
    st.canvas.height = Math.floor(st.h * dpr);
    st.canvas.style.width = st.w + "px";
    st.canvas.style.height = st.h + "px";
    st.cx = st.w / 2;
    st.cy = st.h / 2 + 4;
    st.R = Math.min(st.w, st.h) * 0.36;
    drawOrb(st);
  }

  function setGraph(rows) {
    if (!orb) orb = setupOrb();
    if (!orb) return;
    const narrow = (orb.host.clientWidth || 800) < 640;
    const limit = reduced() || narrow ? 24 : 40;
    orb.graph = buildGraph(rows, limit);
    if (!orb.w) resizeOrb(orb);
    else drawOrb(orb);
    bumpOrb(orb);
    const note = $("markets-orb-count");
    if (note) {
      const n = orb.graph.nodes.length;
      const l = orb.graph.links.length;
      note.textContent = (app() && app().t) ? app().t("orb_count", { n, l }) : `${n} · ${l}`;
    }
  }

  function updateOrbQuotes() {
    if (!orb || !orb.graph.nodes.length) return;
    const get = app() && app().coinOf;
    if (!get) return;
    for (const n of orb.graph.nodes) {
      const rec = get(n.rec.s);
      if (rec) n.rec = rec;
    }
  }

  function project(st) {
    const cos = Math.cos(st.rot), sin = Math.sin(st.rot);
    const tilt = 0.28;
    const ct = Math.cos(tilt), stt = Math.sin(tilt);
    const fl = 2.8;
    st.proj = st.graph.nodes.map((n, i) => {
      let { x, y, z } = n.p;
      const x1 = x * cos - z * sin;
      const z1 = x * sin + z * cos;
      const y1 = y * ct - z1 * stt;
      const z2 = y * stt + z1 * ct;
      const sc = st.R * (fl / (fl + z2 + 1.05));
      const rec = n.rec;
      const chg = rec && rec.c24;
      const dir = chg == null || Number(chg) === 0 ? "flat" : Number(chg) > 0 ? "up" : "down";
      const mc = rec && rec.mc ? Number(rec.mc) : 0;
      return {
        i, x: st.cx + x1 * sc, y: st.cy + y1 * sc, z: z2, sc,
        rec, dir, chg, mc,
        r: Math.max(2.4, Math.min(9.5, Math.sqrt(Math.max(mc, 0)) / 180000))
      };
    });
  }

  function onOrbMove(st, e) {
    const r = st.canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    let best = -1, bestD = 12;
    for (const p of st.proj) {
      if (p.z < -0.15) continue;
      const d = Math.hypot(p.x - x, p.y - y) - p.r;
      if (d < bestD) { bestD = d; best = p.i; }
    }
    st.hover = best;
    if (best < 0) { st.tip.hidden = true; return; }
    const p = st.proj[best];
    const rec = p.rec;
    const fmtP = app() && app().formatPrice ? app().formatPrice(rec.p) : rec.p;
    const fmtC = app() && app().formatPct ? app().formatPct(rec.c24) : rec.c24;
    st.tip.hidden = false;
    st.tip.innerHTML = `<strong>${escapeHtml(rec.s)}</strong> ${escapeHtml(rec.n || "")}<br>$${escapeHtml(String(fmtP))} · ${escapeHtml(String(fmtC))}`;
    const maxX = st.w - 8;
    st.tip.style.left = Math.min(maxX - 8, Math.max(8, p.x + 10)) + "px";
    st.tip.style.top = Math.max(8, p.y - 28) + "px";
    st.canvas.style.cursor = "pointer";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function drawOrb(st) {
    const ctx = st.ctx;
    if (!ctx || !st.w) return;
    const c = token();
    const dpr = st.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, st.w, st.h);
    project(st);

    const g = ctx.createRadialGradient(st.cx, st.cy, st.R * 0.15, st.cx, st.cy, st.R * 1.55);
    g.addColorStop(0, hexAlpha(c.accent, 0.1));
    g.addColorStop(0.7, hexAlpha(c.accent, 0.03));
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(st.cx, st.cy, st.R * 1.55, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = hexAlpha(c.accent, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(st.cx, st.cy, st.R * 1.02, st.R * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = hexAlpha(c.accent, 0.1);
    ctx.beginPath();
    ctx.arc(st.cx, st.cy, st.R * 1.05, 0, Math.PI * 2);
    ctx.stroke();

    const idx = st.proj;
    const byI = idx;
    for (const link of st.graph.links) {
      const a = byI[link.i], b = byI[link.j];
      if (!a || !b) continue;
      const midz = (a.z + b.z) / 2;
      const alpha = 0.08 + 0.35 * ((link.c - CORR_MIN) / (1 - CORR_MIN)) * (0.45 + 0.55 * ((midz + 1) / 2));
      const col = a.dir === b.dir && a.dir !== "flat" ? (a.dir === "up" ? c.up : c.down) : c.accent;
      ctx.strokeStyle = hexAlpha(col, alpha);
      ctx.lineWidth = 0.8 + 1.4 * ((link.c - CORR_MIN) / (1 - CORR_MIN));
      ctx.beginPath();
      const mx = (a.x + b.x) / 2 + (st.cx - (a.x + b.x) / 2) * 0.12;
      const my = (a.y + b.y) / 2 + (st.cy - (a.y + b.y) / 2) * 0.12;
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
    }

    const order = idx.map((_, i) => i).sort((ia, ib) => idx[ia].z - idx[ib].z);
    const topLabel = idx.slice().sort((a, b) => b.mc - a.mc).slice(0, 8).map((p) => p.i);
    const labelSet = new Set(topLabel);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "600 10px " + cssVar("--font-ui", "system-ui");
    for (const i of order) {
      const p = idx[i];
      const depth = (p.z + 1) / 2;
      const col = p.dir === "up" ? c.up : p.dir === "down" ? c.down : c.accent;
      const r = p.r * (0.75 + 0.45 * depth);
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
      glow.addColorStop(0, hexAlpha(col, 0.18 + 0.28 * depth));
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(col, 0.35 + 0.5 * depth);
      ctx.fill();
      ctx.lineWidth = st.hover === i ? 1.6 : 0.7;
      ctx.strokeStyle = hexAlpha("#fff", st.hover === i ? 0.7 : 0.18 + 0.3 * depth);
      ctx.stroke();
      if ((labelSet.has(i) && p.z > -0.05) || st.hover === i) {
        ctx.fillStyle = hexAlpha(c.text, 0.45 + 0.5 * depth);
        ctx.fillText(p.rec.s, p.x, p.y - r - 3);
      }
    }
  }

  function hexAlpha(color, a) {
    const s = String(color).trim();
    if (s.startsWith("#") && (s.length === 7 || s.length === 4)) {
      let r, g, b;
      if (s.length === 4) {
        r = parseInt(s[1] + s[1], 16); g = parseInt(s[2] + s[2], 16); b = parseInt(s[3] + s[3], 16);
      } else {
        r = parseInt(s.slice(1, 3), 16); g = parseInt(s.slice(3, 5), 16); b = parseInt(s.slice(5, 7), 16);
      }
      return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
    }
    if (s.startsWith("rgb")) {
      const m = s.match(/[\d.]+/g);
      if (m && m.length >= 3) return `rgba(${m[0]},${m[1]},${m[2]},${Math.max(0, Math.min(1, a))})`;
    }
    return s;
  }

  function loop(st, now) {
    st.raf = 0;
    if (!st.active || !st.visible || reduced() || document.hidden) { drawOrb(st); return; }
    const dt = st.last ? Math.min(0.05, (now - st.last) / 1000) : 0.016;
    st.last = now;
    st.rot += dt * 0.14;
    drawOrb(st);
    st.raf = requestAnimationFrame((t) => loop(st, t));
  }

  function bumpOrb(st) {
    if (!st) return;
    if (st.active && st.visible && !reduced() && !document.hidden) {
      if (!st.raf) { st.last = 0; st.raf = requestAnimationFrame((t) => loop(st, t)); }
    } else {
      if (st.raf) cancelAnimationFrame(st.raf);
      st.raf = 0;
      drawOrb(st);
    }
  }

  function setMarketsActive(on) {
    if (!orb) orb = setupOrb();
    if (!orb) return;
    orb.active = !!on;
    bumpOrb(orb);
  }

  function topCoins(n) {
    const a = app();
    if (a && a.topCoins) return a.topCoins(n);
    return [];
  }

  function onMarketsView() {
    const rows = topCoins(80);
    const keys = rows.map((r) => r.s);
    const lat = ensureLattice("markets-lattice", keys, false);
    setGraph(rows);
    setMarketsActive(true);
    if (lat && !lat.primed) {
      requestAnimationFrame(() => primeLattice("markets-lattice"));
    }
  }

  function onQuotes(changed) {
    if (!changed || !changed.length) return;
    updateOrbQuotes();
    const box = $("markets-lattice");
    const view = $("view-markets");
    if (box && view && !view.hidden) {
      for (const ev of changed) hitLattice(box, ev.s, ev.dir);
    }
    if (orb && orb.active && orb.visible && (reduced() || !orb.raf)) drawOrb(orb);
  }

  document.addEventListener("visibilitychange", () => { if (orb) bumpOrb(orb); });

  window.BTC007_VIZ = {
    playHero,
    ensureLattice,
    hitLattice,
    primeLattice,
    onMarketsView,
    onQuotes,
    setMarketsActive,
    setGraph
  };
})();
