/**
 * THE FILMS' SHARED PIECES: backgrounds, kinetic words, pop-up cards,
 * counters, taps, the desktop cursor, the browser window, captions and grain.
 * The phone lives in phone.js. Every piece is driven by the timeline or by a
 * per-frame hook that reads only the time.
 */

/* ---------- backgrounds ---------- */

/** Deep navy with a soft electric glow from the top: the films' night canvas. */
/** Shows a node only from t0 to t1, whichever way the film is sought: a ring
    made with fromTo would otherwise sit at its start state before its press. */
function gate(ctx, node, t0, t1) {
  node.style.visibility = "hidden";
  ctx.onFrame((t) => { node.style.visibility = t >= t0 && t < t1 ? "inherit" : "hidden"; });
}

export function bgNavy(ctx, parent, { glowX = 50, glowY = 8, glow = 0.55 } = {}) {
  return ctx.el("div", {
    class: "fill",
    style: {
      background: `radial-gradient(90% 55% at ${glowX}% ${glowY}%, rgb(0 105 254 / ${glow}) 0%, rgb(0 63 152 / ${glow * 0.45}) 38%, transparent 70%),
        radial-gradient(120% 90% at 50% 110%, rgb(2 6 63 / 0.9) 0%, transparent 60%),
        linear-gradient(180deg, #02063f 0%, #010118 62%, #010118 100%)`,
    },
  }, parent);
}

/** Warm dusk: navy with orange and peach low in the frame (stays, going out). */
export function bgDusk(ctx, parent, { x = 50, y = 96 } = {}) {
  return ctx.el("div", {
    class: "fill",
    style: {
      background: `radial-gradient(80% 45% at ${x}% ${y}%, rgb(255 107 26 / 0.62) 0%, rgb(255 178 122 / 0.22) 36%, transparent 68%),
        radial-gradient(70% 40% at 50% 0%, rgb(0 105 254 / 0.35) 0%, transparent 70%),
        linear-gradient(180deg, #02063f 0%, #0b0a2e 55%, #1a0f24 100%)`,
    },
  }, parent);
}

/** Light studio grey, like the reference product shots. */
export function bgStudio(ctx, parent) {
  return ctx.el("div", {
    class: "fill",
    style: { background: "radial-gradient(80% 60% at 50% 38%, #ffffff 0%, #f2f3f6 55%, #e6e8ee 100%)" },
  }, parent);
}

/** A soft coloured light, for depth behind a subject. */
export function glow(ctx, parent, { x, y, size, color = "rgb(0 105 254 / 0.55)" }) {
  return ctx.el("div", {
    class: "abs",
    style: {
      left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: "50%",
      background: `radial-gradient(closest-side, ${color} 0%, ${color.replace(/[\d.]+\)$/, (a) => `${(parseFloat(a) * 0.45).toFixed(3)})`)} 45%, transparent 100%)`,
    },
  }, parent);
}

/* ---------- words ---------- */

/**
 * Kinetic type: `text` split into masked words. Returns { el, words, masks }:
 * animate `words` (y: "110%" -> 0 reveals a word from under its mask).
 */
export function words(ctx, text, { cls = "display", style = {}, parent = null, tag = "div" } = {}) {
  const el = ctx.el(tag, { class: `abs ${cls}`, style }, parent);
  const out = [];
  const masks = [];
  text.split(/(\s+)/).forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); return; }
    const mask = ctx.el("span", { class: "mask" }, el);
    out.push(ctx.el("span", { class: "word", text: part }, mask));
    masks.push(mask);
  });
  return { el, words: out, masks };
}

/* ---------- pop-up cards ---------- */

/**
 * The "you got paid" card. DESIGN.md section 4 and FACTS.md: only the
 * allowed phrasings, and `example: true` whenever it is illustrative.
 * { theme: "dark"|"light", sticker: codepoint | icon: lucide name, title, line, now, example, fontSize }
 */
export function popup(ctx, { theme = "dark", sticker, icon, title, line, now = "now", example = true, fontSize = 40, wrap = false, parent = null, style = {} }) {
  const card = ctx.el("div", { class: `popup glass-${theme}${wrap ? " wrap" : ""}`, style: { fontSize: `${fontSize}px`, ...style } }, parent);
  const chip = ctx.el("div", { class: "chip" }, card);
  if (sticker) ctx.sticker(sticker, Math.round(fontSize * 1.5), chip);
  else if (icon) {
    const i = ctx.icon(icon, { size: Math.round(fontSize * 1.05), stroke: 2 }, chip);
    i.style.color = theme === "dark" ? "var(--sky)" : "var(--electric)";
  }
  const body = ctx.el("div", { class: "body" }, card);
  ctx.el("div", { class: "title", text: title }, body);
  if (line) ctx.el("div", { class: "line", text: line }, body);
  if (now || example) {
    const meta = ctx.el("div", { class: "meta" }, card);
    if (now) ctx.el("div", { class: "now", text: now }, meta);
    if (example) ctx.el("span", { class: "example-chip", text: "Example" }, meta);
  }
  return card;
}

/**
 * Drops a pop-up in at t: from above (or `from`: "left"|"right"|"below"),
 * overshooting a touch, with the notification chime; out at tOut.
 */
export function popIn(ctx, card, t, { from = "above", distance = 90, tOut = null, sound = "chime_notify", offset = 0 } = {}) {
  const { tl } = ctx;
  const axis = from === "left" || from === "right" ? "x" : "y";
  const sign = from === "above" || from === "left" ? -1 : 1;
  tl.fromTo(card, { [axis]: sign * distance, scale: 0.92, opacity: 0 }, { [axis]: 0, scale: 1, opacity: 0.9999, duration: 0.55, ease: "back.out(1.6)" }, t);
  if (sound) ctx.sfx(sound, t, { offset });
  if (tOut != null) tl.to(card, { [axis]: sign * distance * 0.6, opacity: 0, scale: 0.96, duration: 0.28, ease: "power2.in" }, tOut);
}

/* ---------- numbers ---------- */

export const naira = (n) => `₦${Math.round(n).toLocaleString("en-NG")}`;

/** Counts `node` from `from` to `to` between t0 and t1 (with counter ticks). */
export function countUp(ctx, node, { from = 0, to, t0, t1, ease = "power2.out", format = naira, ticks = 10, offset = 0 }) {
  const e = ctx.ease(ease);
  ctx.text(node, (t) => format(from + (to - from) * e(ctx.progress(t, t0, t1))));
  for (let k = 0; k < ticks; k += 1) ctx.sfx("counter_tick", t0 + ((t1 - t0) * k) / ticks, { offset });
}

/* ---------- taps, cursor ---------- */

/** A tap on a phone screen at display pixel (x, y): a ripple and the tap sound. */
export function tap(ctx, screen, { x, y, t, size = 240, color = "rgb(143 211 255 / 0.55)", sound = "tap", offset = 0 }) {
  const ring = ctx.el("div", {
    class: "abs",
    style: {
      left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: "50%",
      background: `radial-gradient(closest-side, ${color}, transparent)`, border: "4px solid rgb(255 255 255 / 0.55)", opacity: 0, zIndex: 50,
    },
  }, screen);
  ctx.tl.fromTo(ring, { scale: 0.2, opacity: 0.95 }, { scale: 1, opacity: 0, duration: 0.55, ease: "power2.out" }, t);
  gate(ctx, ring, t, t + 0.55);
  if (sound) ctx.sfx(sound, t, { offset });
  return ring;
}

/** The desktop pointer. Animate its x and y (stage px of its tip). */
export function cursor(ctx, parent, { size = 44 } = {}) {
  const node = ctx.el("div", { class: "abs", style: { left: 0, top: 0, width: `${size}px`, height: `${size}px`, zIndex: 800, filter: "drop-shadow(0 6px 10px rgb(0 0 20 / 0.45))" } }, parent);
  node.innerHTML = `<svg viewBox="0 0 32 32" width="${size}" height="${size}"><path d="M5 3.2v22.6l6.1-5.6 3.9 9 4.1-1.8-3.9-8.9 8.4-.4L5 3.2Z" fill="#fff" stroke="#0b1230" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return node;
}

/** A click: the pointer dips, a ring opens at its tip, the tap sound. */
export function click(ctx, pointer, t, { ringParent, x, y, sound = "tap", offset = 0 } = {}) {
  /* fromTo with explicit start values: a .to() records its start on first
     render, which depends on the order frames are drawn. */
  ctx.tl.fromTo(pointer, { scale: 1 }, { scale: 0.86, duration: 0.08, ease: "power2.out", transformOrigin: "10% 8%", immediateRender: false }, t - 0.02);
  ctx.tl.fromTo(pointer, { scale: 0.86 }, { scale: 1, duration: 0.22, ease: "power2.out", immediateRender: false }, t + 0.08);
  if (ringParent) {
    const ring = ctx.el("div", { class: "abs", style: { left: `${x - 60}px`, top: `${y - 60}px`, width: "120px", height: "120px", borderRadius: "50%", border: "3px solid rgb(143 211 255 / 0.9)", opacity: 0, zIndex: 790 } }, ringParent);
    ctx.tl.fromTo(ring, { scale: 0.2, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.5, ease: "power2.out" }, t);
    gate(ctx, ring, t, t + 0.5);
  }
  if (sound) ctx.sfx(sound, t, { offset });
}

/* ---------- the browser window (desktop film) ---------- */

/**
 * A browser window showing the web app. The content area is 1440 x 900 CSS
 * px (the desktop captures are 2880 x 1800 at 2x); the window is scaled to
 * `width`. Returns { root, content, bar, url }: animate `root` (x, y, scale,
 * rotationX/Y with a transformPerspective), put captures in `content`.
 */
export function browserWindow(ctx, { parent, width = 1500, url = "vallospaces.com", theme = "dark" }) {
  const scale = width / 1440;
  const barH = 56;
  const root = ctx.el("div", {
    class: "abs",
    style: {
      left: "0px", top: "0px", width: "1440px", height: `${900 + barH}px`, transformOrigin: "50% 50%",
      borderRadius: "22px", overflow: "hidden",
      background: theme === "dark" ? "#0b0f2a" : "#ffffff",
      boxShadow: "0 60px 140px -30px rgb(0 0 20 / 0.75), 0 20px 50px -20px rgb(0 0 30 / 0.6), 0 0 0 1.5px rgb(120 170 255 / 0.22)",
    },
  }, parent);
  const bar = ctx.el("div", {
    class: "abs",
    style: {
      left: 0, top: 0, right: 0, height: `${barH}px`, display: "flex", alignItems: "center", gap: "10px", padding: "0 20px",
      background: theme === "dark" ? "linear-gradient(180deg, #151a3d, #10143a)" : "linear-gradient(180deg, #f7f8fb, #eef0f5)",
      borderBottom: theme === "dark" ? "1px solid rgb(120 170 255 / 0.14)" : "1px solid rgb(10 20 60 / 0.08)",
    },
  }, root);
  for (const c of ["#ff5f57", "#febc2e", "#28c840"]) ctx.el("span", { style: { width: "14px", height: "14px", borderRadius: "50%", background: c, opacity: "0.9" } }, bar);
  const pill = ctx.el("div", {
    style: {
      margin: "0 auto", transform: "translateX(-30px)", minWidth: "420px", height: "34px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
      font: "500 16px/1 Inter, sans-serif", letterSpacing: "-0.005em",
      color: theme === "dark" ? "rgb(255 255 255 / 0.78)" : "rgb(10 20 60 / 0.72)",
      background: theme === "dark" ? "rgb(255 255 255 / 0.07)" : "rgb(10 20 60 / 0.05)",
    },
  }, bar);
  const urlText = ctx.el("span", { text: url }, pill);
  const content = ctx.el("div", { class: "abs", style: { left: 0, top: `${barH}px`, width: "1440px", height: "900px", overflow: "hidden" } }, root);
  ctx.gsap.set(root, { scale, transformOrigin: "0 0" });
  return { root, bar, content, url: urlText, scale, width, height: (900 + barH) * scale };
}

/* ---------- captions ---------- */

/**
 * Burned-in captions from the word timings, so both films work muted: the
 * line being spoken on a navy glass pill, words already said in white, the
 * word being said in sky blue, words to come dimmed.
 */
export function installCaptions(ctx) {
  const mobile = ctx.isMobile;
  const maxWords = mobile ? 6 : 9;
  const maxChars = mobile ? 30 : 52;
  const lines = [];
  for (const s of ctx.T.sentences) {
    const ws = ctx.T.words.filter((w) => w.sentence === s.i);
    let cur = [];
    const flush = () => { if (cur.length) lines.push(cur); cur = []; };
    ws.forEach((w, k) => {
      cur.push(w);
      const chars = cur.map((x) => x.word).join(" ").length;
      const punct = /[,…?.:]$/.test(w.word);
      const next = ws[k + 1];
      const nextChars = next ? chars + 1 + next.word.length : 0;
      if (cur.length >= maxWords || nextChars > maxChars || (punct && cur.length >= 3 && next && ws.length - k - 1 >= 2)) flush();
    });
    flush();
  }
  const spans = lines.map((line, k) => {
    const next = lines[k + 1];
    const from = line[0].start - 0.12;
    let to = line[line.length - 1].end + 0.45;
    if (next && next[0].start - 0.12 < to) to = next[0].start - 0.12;
    return { line, from, to };
  });

  /* Mobile: centred on y 1580, below the phone's readable content and above
     the Reels and TikTok bottom overlays.
     Desktop: low (y 985) and in the right-hand column, x 920–1860, centred
     it sits in the band BELOW the browser window rather than on it. Centred
     at y 1012 it clears the window in its side pose (which ends at 953) and
     the right-hand column's lowest row (which ends at 912), and it keeps
     well over 40px to every edge. Centred on the frame it used to sit on the
     subject itself: on the phone's own bottom bar and floating button in
     most shots, and now on the page the window is showing. */
  const box = ctx.el("div", {
    class: "captions",
    style: mobile
      ? { top: "1580px", transform: "translateY(-50%)" }
      : { left: "240px", right: "240px", top: "1012px", transform: "translateY(-50%)" },
  }, ctx.stage);
  /* Mobile captions stay inside x 140–940: clear of the right-hand buttons of
     TikTok and Reels. Desktop is a little smaller, so a line usually still
     fits on one row in the narrower column. */
  const pill = ctx.el("div", { class: "pill", style: { fontSize: mobile ? "44px" : "30px", ...(mobile ? { maxWidth: "800px" } : {}) } }, box);
  let shown = -1;
  let nodes = [];
  ctx.onFrame((t) => {
    const hidden = ctx.captionGaps.some(([a, b]) => t >= a && t < b);
    const k = hidden ? -1 : spans.findIndex((s) => t >= s.from && t < s.to);
    if (k !== shown) {
      shown = k;
      pill.innerHTML = "";
      nodes = k < 0 ? [] : spans[k].line.map((w, i) => {
        const node = ctx.el("span", { class: "w", text: w.word }, pill);
        if (i < spans[k].line.length - 1) pill.appendChild(document.createTextNode(" "));
        return node;
      });
    }
    box.style.visibility = k < 0 ? "hidden" : "visible";
    if (k < 0) return;
    const s = spans[k];
    const a = ctx.progress(t, s.from, s.from + 0.14);
    const b = 1 - ctx.progress(t, s.to - 0.12, s.to);
    const o = Math.min(a, b);
    /* Never quite 1, and no scale: a layer that has been scaled or faded and
       comes back to exactly 1 is painted differently by Chromium depending
       on the frames drawn before it, which breaks parallel renders. */
    pill.style.opacity = String(Math.min(o, 0.9999));
    pill.style.transform = `translateY(${(1 - a) * 14}px)`;
    s.line.forEach((w, i) => {
      const cls = t >= w.end ? "w said" : t >= w.start - 0.02 ? "w now" : "w";
      if (nodes[i].className !== cls) nodes[i].className = cls;
    });
  });
  return { box, pill, lines: spans };
}

/* ---------- grain ---------- */

/**
 * A fine, seeded grain over everything, changing twelve times a second:
 * it keeps the navy gradients from banding in 8-bit video.
 */
export function installGrain(ctx, { opacity = 0.045, tiles = 6 } = {}) {
  const size = 256;
  const rand = ctx.random(20260930);
  const urls = [];
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  for (let k = 0; k < tiles; k += 1) {
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.round(rand() * 255);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    urls.push(canvas.toDataURL("image/png"));
  }
  const layer = ctx.el("div", { class: "grain", style: { opacity: String(opacity) } }, ctx.stage);
  const faces = urls.map((u) => ctx.el("div", { class: "fill", style: { backgroundImage: `url(${u})`, backgroundSize: `${size}px ${size}px`, visibility: "hidden" } }, layer));
  let on = -1;
  ctx.onFrame((t) => {
    const k = Math.floor(t * 12) % tiles;
    if (k !== on) {
      if (on >= 0) faces[on].style.visibility = "hidden";
      faces[k].style.visibility = "visible";
      on = k;
    }
  });
  return layer;
}

/* ---------- the spine's question cards ---------- */

/** When a flat turn swaps faces (s after its start); the whole turn takes 0.62 s. */
export const TURN_SWAP = 0.3;

/**
 * A flat card turn that reads as a turn: the card narrows to its edge
 * (0.3 s, power2.in) and opens on the other face (0.32 s, back.out(1.4)),
 * with a slight skewY that follows the narrowing (up to 6°, one way closing
 * and the other opening, as a turning card's near edge), a shade on the
 * narrowing face and a highlight sweeping the face that opens. Pure in t:
 * CSS 3D turns are raster-cached by Chromium differently depending on the
 * frames drawn before. `turns` is a sorted list of start times (the caller
 * may add to it); the caller shows the front before start + TURN_SWAP and
 * the back after it.
 */
export function installFlatTurn(ctx, { inner, front, back }, turns) {
  const overlay = (face, bg) => ctx.el("div", { class: "abs", style: { inset: 0, borderRadius: "inherit", pointerEvents: "none", opacity: 0, background: bg } }, face);
  const shade = overlay(front, "linear-gradient(90deg, rgb(0 6 30 / 0.05) 0%, rgb(0 6 30 / 0.85) 100%)");
  const light = overlay(back, "linear-gradient(105deg, rgb(255 255 255 / 0) 30%, rgb(255 255 255 / 0.55) 50%, rgb(255 255 255 / 0) 70%)");
  light.style.backgroundSize = "260% 100%";
  const ease = (name, u) => ctx.ease(name)(Math.min(1, Math.max(0, u)));
  ctx.onFrame((t) => {
    let at = null;
    for (const a of turns) if (t >= a) at = a;
    if (at === null) {
      inner.style.transform = "";
      shade.style.opacity = "0";
      light.style.opacity = "0";
      return;
    }
    const close = (t - at) / TURN_SWAP;
    const open = (t - at - TURN_SWAP) / (0.62 - TURN_SWAP);
    const n = close < 1 ? 1 - 0.98 * ease("power2.in", close) : 0.02 + 0.98 * ease("back.out(1.4)", open);
    const edge = Math.max(0, 1 - Math.min(1, n));
    const skew = 6 * edge * (close < 1 ? 1 : -1);
    inner.style.transform = n >= 0.9999 && Math.abs(n - 1) < 1e-4 ? "" : `skewY(${skew.toFixed(3)}deg) scaleX(${Math.max(0.001, n).toFixed(4)})`;
    shade.style.opacity = close < 1 ? (0.75 * ease("power1.in", close)).toFixed(4) : "0";
    const lit = close >= 1 && open < 1.4 ? Math.sin(Math.PI * Math.min(1, Math.max(0, open / 1.4))) : 0;
    light.style.opacity = (0.8 * lit).toFixed(4);
    light.style.backgroundPosition = `${(100 - Math.min(1, Math.max(0, open / 1.4)) * 100).toFixed(1)}% 0%`;
  });
}

/**
 * A glass question card that turns over to its answer (the films' spine:
 * three doubts in frame one, each answered later). Build it at a box
 * { x, y, w, h }; animate `root` (x, y, rotation, scale, opacity) and call
 * turn(t) to flip it to the answer. The back shows the verified mark when
 * `mark` is set.
 */
export function questionCard(ctx, parent, { q, a, box, mark = false, fontSize = null }) {
  const size = fontSize ?? Math.round(Math.min(box.h * 0.26, box.w * 0.075));
  const root = ctx.el("div", { class: "abs", style: { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` } }, parent);
  const inner = ctx.el("div", { class: "abs", style: { inset: 0 } }, root);
  const face = (back) => ctx.el("div", {
    class: "abs glass-dark",
    style: {
      inset: 0, borderRadius: `${Math.round(box.h * 0.18)}px`, display: "flex", alignItems: "center", gap: `${Math.round(size * 0.5)}px`,
      padding: `0 ${Math.round(size * 1.1)}px`,
      font: `600 ${back ? Math.round(size * 0.86) : size}px/1.16 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em",
      ...(back ? { background: "linear-gradient(150deg, rgb(0 105 254 / 0.9), rgb(0 63 152 / 0.92))", border: "1.5px solid rgb(143 211 255 / 0.55)", visibility: "hidden" } : {}),
    },
  }, inner);
  const front = face(false);
  front.textContent = q;
  const back = face(true);
  if (mark) {
    /* The product's verified mark (assets/icons/ui/verified-badge.svg), drawn
       inline as a white badge with an electric tick on the blue back. A CSS
       filter would whiten the tick too and leave a plain disc. */
    const px = Math.round(size * 1.3);
    const badge = ctx.el("div", { style: { width: `${px}px`, height: `${px}px`, flex: "none" } }, back);
    badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><circle cx="12" cy="12" r="10" fill="#fff"/><path d="m16.2 9-5.6 5.6L7.8 11.8" fill="none" stroke="#0069fe" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  ctx.el("span", { text: a }, back);
  const turns = [];
  ctx.onFrame((t) => {
    const flipped = turns.some((at) => t >= at + TURN_SWAP);
    front.style.visibility = flipped ? "hidden" : "inherit";
    back.style.visibility = flipped ? "inherit" : "hidden";
  });
  return {
    root,
    inner,
    front,
    back,
    /**
     * Turns the card over to its answer at t (0.6 s, with a soft pop). The
     * turn is flat: the card narrows to its edge and opens on the other face.
     * A CSS 3D turn is raster-cached by Chromium differently depending on the
     * frames drawn before it, which breaks parallel renders.
     */
    turn(t, { sound = "pop", offset = 0 } = {}) {
      if (!turns.length) installFlatTurn(ctx, { inner, front, back }, turns);
      turns.push(t);
      turns.sort((x, y) => x - y);
      if (sound) ctx.sfx(sound, t + 0.18, { offset });
    },
  };
}

/* ======================================================================
 * The reference film's devices, in Vallo's form (video/REFERENCES.md).
 * ==================================================================== */

/**
 * The glossy pointer: a 44 px electric-blue sphere that stands in for the
 * finger (both films). Animate its x and y (stage px of its centre) with
 * the timeline; press(t) dips it and opens a ring at its position.
 */
export function orb(ctx, parent, { size = 44, z = 850 } = {}) {
  const node = ctx.el("div", {
    class: "abs",
    style: {
      left: `${-size / 2}px`, top: `${-size / 2}px`, width: `${size}px`, height: `${size}px`, borderRadius: "50%", zIndex: String(z),
      background: "radial-gradient(circle at 34% 30%, #ffffff 0%, #bfe3ff 9%, #5c9fff 26%, #0069fe 58%, #003f98 100%)",
      boxShadow: "0 10px 22px -6px rgb(0 20 80 / 0.55), inset 0 -4px 10px rgb(0 20 90 / 0.35)",
      transformOrigin: "50% 80%",
    },
  }, parent);
  return node;
}

/** A press of the pointer at t: it dips, a ring opens where it is, the tap sound. */
export function press(ctx, pointer, t, { ringParent, x, y, sound = "tap", offset = 0, ring = true } = {}) {
  ctx.tl.fromTo(pointer, { scaleY: 1, scaleX: 1 }, { scaleY: 0.8, scaleX: 1.1, duration: 0.09, ease: "power2.out", immediateRender: false }, t - 0.06);
  ctx.tl.fromTo(pointer, { scaleY: 0.8, scaleX: 1.1 }, { scaleY: 1, scaleX: 1, duration: 0.32, ease: "back.out(2.2)", immediateRender: false }, t + 0.05);
  if (ring && ringParent) {
    const r = ctx.el("div", { class: "abs", style: { left: `${x - 50}px`, top: `${y - 50}px`, width: "100px", height: "100px", borderRadius: "50%", border: "3px solid rgb(0 105 254 / 0.8)", opacity: 0, zIndex: 840 } }, ringParent);
    ctx.tl.fromTo(r, { scale: 0.25, opacity: 1 }, { scale: 1.25, opacity: 0, duration: 0.55, ease: "power2.out" }, t);
    gate(ctx, r, t, t + 0.55);
  }
  if (sound) ctx.sfx(sound, t, { offset });
}

/**
 * A hand-drawn squiggle underline that draws itself from t over `dur`.
 * Placed under a word: x, y (its left end), w (its length).
 */
export function squiggle(ctx, parent, { x, y, w, t, dur = 0.55, color = "var(--electric)", stroke = 7, loops = null }) {
  const n = loops ?? Math.max(3, Math.round(w / 70));
  const h = 26;
  let d = `M 4 ${h / 2}`;
  for (let i = 0; i < n; i += 1) {
    const x0 = 4 + ((w - 8) * i) / n;
    const x1 = 4 + ((w - 8) * (i + 1)) / n;
    const mid = (x0 + x1) / 2;
    d += ` C ${x0 + (x1 - x0) * 0.2} ${h * 0.95}, ${mid - (x1 - x0) * 0.1} ${h * 0.95}, ${mid} ${h / 2}`;
    d += ` S ${x1 - (x1 - x0) * 0.15} ${h * 0.02}, ${x1} ${h / 2}`;
  }
  const svg = ctx.el("div", { class: "abs", style: { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` } }, parent);
  svg.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"><path d="${d}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/></svg>`;
  const path = svg.querySelector("path");
  ctx.tl.fromTo(path, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: dur, ease: "power2.inOut" }, t);
  return svg;
}

/**
 * A thin ring that draws itself around a title at t, with a burst of dots
 * and dashes (seeded, so the same every render). cx, cy, r in stage px.
 */
export function ringBurst(ctx, parent, { cx, cy, r, t, color = "var(--electric)", dots = 18, seed = 7, stroke = 4, dur = 0.8 }) {
  const size = r * 2 + 40;
  const wrap = ctx.el("div", { class: "abs", style: { left: `${cx - size / 2}px`, top: `${cy - size / 2}px`, width: `${size}px`, height: `${size}px`, pointerEvents: "none" } }, parent);
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  const circle = wrap.querySelector("circle");
  ctx.tl.fromTo(circle, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: dur, ease: "power2.inOut" }, t);
  const rand = ctx.random(seed);
  for (let i = 0; i < dots; i += 1) {
    const a = rand() * Math.PI * 2;
    const dist = r * (0.55 + rand() * 0.75);
    const dash = rand() < 0.4;
    const s = dash ? 4 : 6 + rand() * 8;
    const piece = ctx.el("div", {
      class: "abs",
      style: {
        left: `${size / 2 - (dash ? 14 : s / 2)}px`, top: `${size / 2 - s / 2}px`, width: dash ? "28px" : `${s}px`, height: `${s}px`,
        borderRadius: dash ? "3px" : "50%", background: rand() < 0.5 ? color : "var(--sky)", opacity: 0,
        transform: dash ? `rotate(${(a * 180) / Math.PI}deg)` : "none",
      },
    }, wrap);
    const t0 = t + 0.1 + rand() * 0.45;
    ctx.tl.fromTo(piece, { x: Math.cos(a) * r * 0.2, y: Math.sin(a) * r * 0.2, opacity: 0 }, { x: Math.cos(a) * dist, y: Math.sin(a) * dist, opacity: 0.9999, duration: 0.5, ease: "power3.out" }, t0);
    ctx.tl.to(piece, { opacity: 0, duration: 0.5, ease: "power1.in" }, t0 + 0.7 + rand() * 0.6);
  }
  return wrap;
}

/** A few four-point sparkles in an area, turning slowly (seeded). */
export function sparkles(ctx, parent, { area, count = 5, seed = 3, t0 = 0, t1 = 999, color = "var(--sky)", min = 18, max = 40 }) {
  const rand = ctx.random(seed);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const s = min + rand() * (max - min);
    const node = ctx.el("div", { class: "abs", style: { left: `${area.x + rand() * (area.w - s)}px`, top: `${area.y + rand() * (area.h - s)}px`, width: `${s}px`, height: `${s}px`, opacity: 0 } }, parent);
    node.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" fill="${color}"/></svg>`;
    const spin = (rand() < 0.5 ? -1 : 1) * (40 + rand() * 60);
    const phase = rand() * 2;
    ctx.onFrame((t) => {
      const on = ctx.progress(t, t0 + phase * 0.2, t0 + phase * 0.2 + 0.4) * (1 - ctx.progress(t, t1 - 0.4, t1));
      node.style.opacity = String(on * (0.55 + 0.45 * Math.sin((t + phase) * 2.1) ** 2));
      node.style.transform = `rotate(${t * spin}deg) scale(${0.85 + 0.15 * Math.sin((t + phase) * 1.7)})`;
    });
    out.push(node);
  }
  return out;
}

/**
 * A body: a part of a live screen lifted off as a floating card. `src` is a
 * capture or display image; crop is in that image's pixels; the body shows
 * it at `scale`, with round corners and a soft shadow. Returns the outer
 * element (animate it with GSAP: x, y, scale, rotation, opacity).
 */
export function bodyFromImage(ctx, parent, { src, crop, scale = 1, radius = 22, shadow = true, x = 0, y = 0, z = 0, light = false }) {
  const w = crop.w * scale;
  const h = crop.h * scale;
  const outer = ctx.el("div", {
    class: "abs",
    style: {
      left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, borderRadius: `${radius}px`, overflow: "hidden", zIndex: String(z),
      boxShadow: shadow ? (light ? "0 28px 60px -22px rgb(10 30 80 / 0.35), 0 8px 20px -10px rgb(10 30 80 / 0.25)" : "0 30px 70px -24px rgb(0 0 20 / 0.7), 0 10px 24px -10px rgb(0 0 30 / 0.5)") : "none",
      outline: light ? "1px solid rgb(10 30 80 / 0.06)" : "1px solid rgb(143 211 255 / 0.18)",
    },
  }, parent);
  ctx.img(src, { style: { position: "absolute", left: `${-crop.x * scale}px`, top: `${-crop.y * scale}px`, width: `${crop.iw * scale}px`, height: "auto", maxWidth: "none" } }, outer);
  return outer;
}

/** A slow bob (and slight turn) on an element, from t0: y ± amp px over `period` s (seeded phase). */
export function bob(ctx, node, { amp = 6, period = 2.6, turn = 1.2, seed = 1, t0 = 0 } = {}) {
  const phase = ctx.random(seed)() * Math.PI * 2;
  ctx.onFrame((t) => {
    if (t < t0) return;
    const k = ((t - t0) / period) * Math.PI * 2 + phase;
    node.style.translate = `0px ${(Math.sin(k) * amp).toFixed(2)}px`;
    node.style.rotate = `${(Math.sin(k * 0.7) * turn).toFixed(3)}deg`;
  });
}

/**
 * An odometer number: each digit is a column that spins and lands, left to
 * right, from t0 to t1. The final value is exact and sharp; the columns in
 * motion are blurred by speed, so no false total is ever readable.
 */
export function odometer(ctx, parent, { value, t0, t1, prefix = "₦", fontSize = 96, color = "inherit", className = "display" }) {
  const text = value.toLocaleString("en-NG");
  const box = ctx.el("div", { class: `abs ${className}`, style: { fontSize: `${fontSize}px`, color, display: "flex", alignItems: "flex-start", lineHeight: "1", fontVariantNumeric: "tabular-nums" } }, parent);
  if (prefix) ctx.el("span", { text: prefix }, box);
  const digits = [...text].filter((c) => /\d/.test(c)).length;
  let k = 0;
  [...text].forEach((ch) => {
    if (!/\d/.test(ch)) {
      ctx.el("span", { text: ch }, box);
      return;
    }
    const idx = k;
    k += 1;
    const col = ctx.el("span", { style: { display: "inline-block", height: "1em", overflow: "hidden", position: "relative" } }, box);
    const strip = ctx.el("span", { style: { display: "flex", flexDirection: "column" } }, col);
    /* enough turn to read as a roll, few enough that a frame caught mid-roll
       still looks like a number */
    const spins = 1 + Math.min(3, digits - idx);
    const final = Number(ch);
    const seq = [];
    for (let s = 0; s < spins * 10 + final + 1; s += 1) seq.push(s % 10);
    /* A column is as wide as the widest digit, so a narrow digit has to be
       centred in it. Left-aligned, a "1" left a hole beside it and
       ₦26,100,000 read as "₦26,1 00,000". The display font has no tabular
       figures to do this for us. */
    seq.forEach((d) => ctx.el("span", { text: String(d), style: { height: "1em", display: "block", textAlign: "center" } }, strip));
    const land = t0 + ((t1 - t0) * (idx + 1)) / digits;
    const e = ctx.ease("power3.out");
    ctx.onFrame((t) => {
      const p = e(ctx.progress(t, t0, land));
      const pos = p * (seq.length - 1);
      strip.style.transform = `translateY(${-pos}em)`;
      const speed = p < 1 ? (1 - p) * 6 : 0;
      col.style.filter = speed > 0.5 ? `blur(${Math.min(1.5, speed * 0.3).toFixed(2)}px)` : "none";
    });
  });
  return box;
}

/* ---------- the chapter pill ---------- */

/**
 * The chapter pill (one for the whole film): the Vallo mark and a short
 * phrase, one word in blue, at the top centre. `chapters` is a list of
 * { start, end, parts: [["Find a ", false], ["home", true]] }. The pill
 * appears at a chapter's start (after the big words have shrunk into its
 * place), rolls its text at each change, and leaves at the chapter's end
 * unless the next chapter follows on.
 */
export function installChapterPill(ctx, chapters, { theme = (t) => "light" } = {}) {
  const mobile = ctx.isMobile;
  /* Mobile: y 290–360 (layout.js PILL), sitting on the phone's top bezel so
     it covers the status bar and never the screen's own headings. */
  const top = mobile ? 290 : 36;
  const h = mobile ? 70 : 60;
  const fs = mobile ? 31 : 26;
  const box = ctx.el("div", { class: "abs", style: { left: 0, right: 0, top: `${top}px`, height: `${h}px`, display: "flex", justifyContent: "center", zIndex: 880, pointerEvents: "none" } }, ctx.stage);
  const pill = ctx.el("div", {
    style: {
      height: `${h}px`, display: "flex", alignItems: "center", gap: `${Math.round(fs * 0.45)}px`, padding: `0 ${Math.round(fs * 0.9)}px 0 ${Math.round(fs * 0.6)}px`,
      borderRadius: "999px", font: `600 ${fs}px/1 Poppins, Inter, sans-serif`, letterSpacing: "-0.02em", overflow: "hidden", position: "relative",
    },
  }, box);
  const mark = ctx.img(ctx.src.brand("vallo-mark.png"), { style: { width: `${Math.round(fs * 1.35)}px`, height: `${Math.round(fs * 1.35)}px`, objectFit: "contain", flex: "none" } }, pill);
  const keys = [];
  const lines = chapters.map((c) => {
    const line = ctx.el("span", { style: { whiteSpace: "nowrap", display: "none" } }, pill);
    c.parts.forEach(([text, blue]) => {
      const n = ctx.el("span", { text, style: blue ? { color: "var(--electric)" } : {} }, line);
      if (blue) keys.push(n);
    });
    return line;
  });
  let shown = -2;
  ctx.onFrame((t) => {
    const k = chapters.findIndex((c) => t >= c.start && t < c.end);
    const dark = theme(t) === "dark";
    Object.assign(pill.style, dark
      ? { background: "rgb(10 16 60 / 0.86)", color: "#fff", border: "1.5px solid rgb(120 170 255 / 0.3)", boxShadow: "0 14px 34px -14px rgb(0 0 20 / 0.7)" }
      : { background: "rgb(255 255 255 / 0.96)", color: "#0b1230", border: "1px solid rgb(10 30 80 / 0.06)", boxShadow: "0 14px 34px -16px rgb(10 30 80 / 0.35)" });
    /* the key word: electric on light, sky on night (electric on navy barely reads) */
    for (const n of keys) n.style.color = dark ? "#8FD3FF" : "var(--electric)";
    if (k !== shown) {
      lines.forEach((l, i) => (l.style.display = i === k ? "inline" : "none"));
      shown = k;
    }
    if (k < 0) {
      box.style.visibility = "hidden";
      return;
    }
    box.style.visibility = "visible";
    const c = chapters[k];
    const prev = chapters[k - 1];
    const next = chapters[k + 1];
    const joinedIn = prev && Math.abs(prev.end - c.start) < 0.02;
    const joinedOut = next && Math.abs(next.start - c.end) < 0.02;
    const a = joinedIn ? 1 : ctx.ease("back.out(1.6)")(ctx.progress(t, c.start, c.start + 0.45));
    const b = joinedOut ? 1 : 1 - ctx.ease("power2.in")(ctx.progress(t, c.end - 0.3, c.end));
    const roll = joinedIn ? ctx.ease("power3.out")(ctx.progress(t, c.start, c.start + 0.35)) : 1;
    /* A pill gap fades the pill out over 0.15 s and back after it. */
    const gap = (ctx.pillGaps ?? []).reduce((m, [g0, g1]) => Math.min(m, t < g0 ? ctx.clamp((g0 - t) / 0.15, 0, 1) : t < g1 ? 0 : ctx.clamp((t - g1) / 0.15, 0, 1)), 1);
    box.style.opacity = String(Math.min(a, b, gap, 0.9999));
    pill.style.transform = `translateY(${(1 - Math.min(a, 1)) * -10}px)`;
    lines[k].style.display = "inline-block";
    lines[k].style.transform = `translateY(${(1 - roll) * 100}%)`;
    lines[k].style.opacity = String(roll);
    mark.style.transform = `rotate(${(1 - a) * -40}deg)`;
  });
  return { box, pill };
}
