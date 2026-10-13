/* ============================================================
   graphiques.js — tiny SVG chart engine, no dependency.
   Implements the subset of the Chart.js API used by app.js / app_en.js:
   new Chart(canvas, {type:"bar"|"line"|"scatter", data, options}),
   .update(), .destroy(). Works offline.
   ============================================================ */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const fmt = (v) => {
    const a = Math.abs(v);
    const d = a === 0 ? 0 : a < 1 ? 2 : a < 10 ? 1 : 0;
    return Number(v).toLocaleString("fr-FR", { maximumFractionDigits: d });
  };
  function pasJoli(etendue, n) {
    const brut = etendue / Math.max(n, 1), p = Math.pow(10, Math.floor(Math.log10(brut || 1))), r = brut / p;
    return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
  }
  function graduations(min, max, n = 5) {
    if (min === max) { max = min + 1; }
    const pas = pasJoli(max - min, n), lo = Math.floor(min / pas) * pas, hi = Math.ceil(max / pas) * pas, t = [];
    for (let v = lo; v <= hi + pas / 2; v += pas) t.push(Math.round(v / pas) * pas);
    const d = (String(+pas.toPrecision(6)).split(".")[1] || "").length;
    return { lo, hi, t, d };
  }
  const couleur = (c, i) => (Array.isArray(c) ? c[i % c.length] : c);

  class Chart {
    constructor(canvas, config) {
      this.config = config; this.data = config.data; this.options = config.options || {};
      this.zone = document.createElement("div");
      this.zone.className = "mg-zone";
      this.zone.style.cssText = "position:relative;width:100%;height:100%";
      canvas.replaceWith(this.zone);
      this.canvas = canvas;
      this.bulle = document.createElement("div");
      this.bulle.className = "mg-bulle"; this.bulle.hidden = true;
      this.zone.appendChild(this.bulle);
      this.ro = new ResizeObserver(() => this.dessiner());
      this.ro.observe(this.zone);
      this.dessiner();
    }
    update() { this.dessiner(); }
    destroy() { this.ro.disconnect(); this.zone.replaceWith(this.canvas); }

    dessiner() {
      const W = this.zone.clientWidth, H = this.zone.clientHeight;
      if (!W || !H) return;
      if (this.svg) this.svg.remove();
      const o = this.options, sc = o.scales || {}, pl = o.plugins || {}, type = this.config.type;
      const horiz = o.indexAxis === "y";
      const svg = el("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", class: "mg" });
      this.zone.insertBefore(svg, this.bulle); this.svg = svg;
      const ds = this.data.datasets, labels = this.data.labels || [];
      const titre = pl.title && pl.title.display ? pl.title.text : null;
      const filtre = pl.legend && pl.legend.labels && pl.legend.labels.filter;
      const legendes = ds.map((d, i) => ({ text: d.label, i, c: couleur(d.borderColor && type !== "bar" ? d.borderColor : d.backgroundColor, 0) }))
        .filter((l) => !filtre || filtre(l));
      const avecLegende = !(pl.legend && pl.legend.display === false) && ds.length > 1;
      let haut = 8;
      if (titre) { el("text", { x: W / 2, y: 15, "text-anchor": "middle", class: "mg-titre" }, svg).textContent = titre; haut = 26; }
      if (avecLegende) {
        let x = 4, y = haut + 10;
        legendes.forEach((l) => {
          const w = 18 + l.text.length * 6.6;
          if (x + w > W && x > 4) { x = 4; y += 18; }
          el("rect", { x, y: y - 9, width: 11, height: 11, rx: 2, fill: l.c }, svg);
          el("text", { x: x + 15, y: y, class: "mg-leg" }, svg).textContent = l.text;
          x += w + 10;
        });
        haut = y + 12;
      }
      // --- valeurs et domaines ---
      const sx = sc.x || {}, sy = sc.y || {};
      const valAxe = horiz ? sx : sy, catAxe = horiz ? sy : sx;
      const estNum = type === "scatter";
      let vals = [];
      ds.forEach((d) => d.data.forEach((v) => { if (v == null) return; vals.push(estNum ? v.y : v); }));
      let vmin = Math.min(...vals), vmax = Math.max(...vals);
      if (type === "bar" || valAxe.beginAtZero) vmin = Math.min(0, vmin);
      if (type === "bar") vmax = Math.max(0, vmax);
      if (valAxe.max !== undefined) vmax = valAxe.max;
      const gv = graduations(vmin, vmax);
      let gx = null;
      if (estNum) {
        const xs = []; ds.forEach((d) => d.data.forEach((p) => xs.push(p.x)));
        const xmin = Math.min(...xs), xmax = Math.max(...xs), m = (xmax - xmin) * 0.06 || 1;
        gx = graduations(xmin - m, xmax + m);
        if (type === "scatter" && !sy.beginAtZero) { const ys = vals, ym = (Math.max(...ys) - Math.min(...ys)) * 0.08 || 1; Object.assign(gv, graduations(Math.min(...ys) - ym, Math.max(...ys) + ym)); }
      }
      // --- marges ---
      const lblCat = labels.map(String);
      const maxCat = Math.max(0, ...lblCat.map((s) => s.length));
      const tickTxt = gv.t.map((v) => v.toLocaleString("fr-FR", { minimumFractionDigits: gv.d, maximumFractionDigits: gv.d })), maxTick = Math.max(...tickTxt.map((s) => s.length));
      const gauche = (horiz ? Math.min(maxCat * 6.3 + 10, W * 0.42) : maxTick * 7 + 12) + ((horiz ? catAxe : valAxe).title && (horiz ? catAxe : valAxe).title.display ? 16 : 0);
      const titreX = (horiz ? valAxe : catAxe).title, titreY = (horiz ? catAxe : valAxe).title;
      const rotation = !horiz && !estNum && maxCat * 6.2 > (W - gauche) / Math.max(labels.length, 1) * 0.95;
      const bas = 22 + (titreX && titreX.display ? 16 : 0) + (rotation ? Math.min(maxCat * 4.2, 60) : 0);
      const L = gauche, R = W - 10, T = haut + 6, B = H - bas;
      if (R - L < 30 || B - T < 30) return;
      const g = el("g", {}, svg);
      const yv = (v) => B - ((v - gv.lo) / (gv.hi - gv.lo)) * (B - T);
      const xv = (v) => L + ((v - gv.lo) / (gv.hi - gv.lo)) * (R - L);
      // grille + graduations de valeur
      gv.t.forEach((v, i) => {
        if (horiz) { el("line", { x1: xv(v), x2: xv(v), y1: T, y2: B, class: "mg-grille" }, g); el("text", { x: xv(v), y: B + 15, "text-anchor": "middle", class: "mg-tick" }, g).textContent = tickTxt[i]; }
        else { el("line", { x1: L, x2: R, y1: yv(v), y2: yv(v), class: "mg-grille" }, g); el("text", { x: L - 6, y: yv(v) + 4, "text-anchor": "end", class: "mg-tick" }, g).textContent = tickTxt[i]; }
      });
      if (titreY && titreY.display) { const t = el("text", { x: 12, y: (T + B) / 2, transform: `rotate(-90 12 ${(T + B) / 2})`, "text-anchor": "middle", class: "mg-axe" }, g); t.textContent = titreY.text; }
      if (titreX && titreX.display) el("text", { x: (L + R) / 2, y: H - 4, "text-anchor": "middle", class: "mg-axe" }, g).textContent = titreX.text;
      const cb = (pl.tooltip && pl.tooltip.callbacks) || {};
      const montrer = (evt, lignes, titreB) => {
        this.bulle.innerHTML = (titreB ? `<b>${titreB}</b>` : "") + lignes.map((l) => `<div><i style="background:${l.c}"></i>${l.t}</div>`).join("");
        this.bulle.hidden = false;
        const r = this.zone.getBoundingClientRect(); let x = evt.clientX - r.left + 12, y = evt.clientY - r.top + 12;
        const bw = this.bulle.offsetWidth, bh = this.bulle.offsetHeight;
        if (x + bw > W) x = Math.max(0, x - bw - 24); if (y + bh > H) y = Math.max(0, y - bh - 24);
        this.bulle.style.left = x + "px"; this.bulle.style.top = y + "px";
      };
      const cacher = () => (this.bulle.hidden = true);
      const ctx = (d, di, i) => ({ dataset: d, datasetIndex: di, dataIndex: i, raw: d.data[i], label: lblCat[i] });
      const libelle = (c) => (cb.label ? cb.label(c) : (c.dataset.label ? c.dataset.label + " : " : "") + fmt(c.raw)) + (cb.afterLabel ? " (" + cb.afterLabel(c) + ")" : "");
      const titreBulle = (c) => (cb.title ? cb.title([c]) : c.label);

      if (type === "bar") {
        const n = labels.length, nd = ds.length, bande = (horiz ? B - T : R - L) / n;
        const occ = (ds[0] && ds[0].categoryPercentage) || 0.8, larg = ds[0] && ds[0].barPercentage === 1 ? 1 : 0.85;
        const bw = Math.max(1, (bande * occ * larg) / nd), r0 = horiz ? xv(0) : yv(0);
        ds.forEach((d, di) => d.data.forEach((v, i) => {
          if (v == null) return;
          const c0 = (horiz ? T : L) + i * bande + (bande * (1 - occ)) / 2 + di * ((bande * occ) / nd) + ((bande * occ) / nd - bw) / 2;
          const p = horiz ? xv(v) : yv(v);
          const rect = horiz ? { x: Math.min(r0, p), y: c0, width: Math.max(Math.abs(p - r0), 0.5), height: bw } : { x: c0, y: Math.min(r0, p), width: bw, height: Math.max(Math.abs(p - r0), 0.5) };
          const rr = el("rect", { ...rect, rx: Math.min(d.borderRadius || 0, bw / 2), fill: couleur(d.backgroundColor, i), class: "mg-barre", tabindex: n <= 12 ? 0 : -1 }, g);
          const c = ctx(d, di, i);
          rr.addEventListener("mousemove", (e) => montrer(e, [{ c: couleur(d.backgroundColor, i), t: libelle(c) }], titreBulle(c)));
          rr.addEventListener("mouseleave", cacher);
          rr.addEventListener("focus", () => { const b = rr.getBoundingClientRect(); montrer({ clientX: b.right, clientY: b.top }, [{ c: couleur(d.backgroundColor, i), t: libelle(c) }], titreBulle(c)); });
          rr.addEventListener("blur", cacher);
        }));
        // category labels
        const lim = (catAxe.ticks && catAxe.ticks.maxTicksLimit) || n, saut = Math.ceil(n / lim);
        lblCat.forEach((s, i) => {
          if (i % saut) return;
          const c = (horiz ? T : L) + (i + 0.5) * bande;
          if (horiz) el("text", { x: L - 6, y: c + 4, "text-anchor": "end", class: "mg-tick" }, g).textContent = s.length > 34 ? s.slice(0, 33) + "…" : s;
          else if (rotation) el("text", { x: c, y: B + 12, "text-anchor": "end", transform: `rotate(-35 ${c} ${B + 12})`, class: "mg-tick" }, g).textContent = s;
          else el("text", { x: c, y: B + 15, "text-anchor": "middle", class: "mg-tick" }, g).textContent = s;
        });
        el("line", horiz ? { x1: r0, x2: r0, y1: T, y2: B, class: "mg-zero" } : { x1: L, x2: R, y1: r0, y2: r0, class: "mg-zero" }, g);
      } else if (type === "line") {
        const n = labels.length, xi = (i) => L + (n === 1 ? (R - L) / 2 : (i / (n - 1)) * (R - L));
        ds.forEach((d, di) => {
          if (d.fill === "+1" && ds[di + 1]) {
            const a = d.data.map((v, i) => `${xi(i)},${yv(v)}`), b = ds[di + 1].data.map((v, i) => `${xi(i)},${yv(v)}`).reverse();
            el("polygon", { points: a.concat(b).join(" "), fill: d.backgroundColor, stroke: "none" }, g);
          }
        });
        ds.forEach((d) => {
          el("polyline", { points: d.data.map((v, i) => `${xi(i)},${yv(v)}`).join(" "), fill: "none", stroke: d.borderColor, "stroke-width": d.borderWidth || 2, "stroke-linejoin": "round" }, g);
          if (d.pointRadius) d.data.forEach((v, i) => el("circle", { cx: xi(i), cy: yv(v), r: d.pointRadius, fill: d.pointBackgroundColor || d.borderColor }, g));
        });
        const lim = (catAxe.ticks && catAxe.ticks.maxTicksLimit) || n, saut = Math.ceil(n / lim);
        lblCat.forEach((s, i) => {
          if (i % saut) return;
          if (rotation) el("text", { x: xi(i), y: B + 12, "text-anchor": "end", transform: `rotate(-35 ${xi(i)} ${B + 12})`, class: "mg-tick" }, g).textContent = s;
          else el("text", { x: xi(i), y: B + 15, "text-anchor": "middle", class: "mg-tick" }, g).textContent = s;
        });
        const repere = el("line", { y1: T, y2: B, class: "mg-repere", visibility: "hidden" }, g);
        const capt = el("rect", { x: L, y: T, width: R - L, height: B - T, fill: "transparent" }, g);
        capt.addEventListener("mousemove", (e) => {
          const r = svg.getBoundingClientRect(), x = e.clientX - r.left;
          const i = Math.max(0, Math.min(n - 1, Math.round(((x - L) / (R - L)) * (n - 1))));
          repere.setAttribute("x1", xi(i)); repere.setAttribute("x2", xi(i)); repere.setAttribute("visibility", "visible");
          const lignes = ds.filter((d) => !filtre || filtre({ text: d.label })).map((d, di) => ({ c: d.borderColor, t: libelle(ctx(d, di, i)) }));
          montrer(e, lignes, lblCat[i]);
        });
        capt.addEventListener("mouseleave", () => { cacher(); repere.setAttribute("visibility", "hidden"); });
      } else if (type === "scatter") {
        const xx = (v) => L + ((v - gx.lo) / (gx.hi - gx.lo)) * (R - L);
        gx.t.forEach((v) => { el("line", { x1: xx(v), x2: xx(v), y1: T, y2: B, class: "mg-grille" }, g); el("text", { x: xx(v), y: B + 15, "text-anchor": "middle", class: "mg-tick" }, g).textContent = v.toLocaleString("fr-FR", { minimumFractionDigits: gx.d, maximumFractionDigits: gx.d }); });
        ds.forEach((d, di) => {
          if (d.showLine) el("polyline", { points: d.data.map((p) => `${xx(p.x)},${yv(p.y)}`).join(" "), fill: "none", stroke: d.borderColor, "stroke-width": 2 }, g);
          d.data.forEach((p, i) => {
            const cc = el("circle", { cx: xx(p.x), cy: yv(p.y), r: d.pointRadius || 3, fill: couleur(d.pointBackgroundColor || d.backgroundColor, i), class: d.data.length < 50 ? "mg-point" : "" }, g);
            if (d.data.length < 400 || i % 4 === 0) {
              cc.addEventListener("mousemove", (e) => montrer(e, [{ c: couleur(d.pointBackgroundColor || d.backgroundColor, i), t: libelle({ dataset: d, raw: p, dataIndex: i }) }]));
              cc.addEventListener("mouseleave", cacher);
            }
          });
        });
      }
      svg.setAttribute("aria-label", (titre || ds.map((d) => d.label).join(", ")) + " — graphique");
    }
  }
  Chart.defaults = { font: {}, plugins: { legend: { labels: {} } }, animation: {} };
  window.Chart = Chart;
})();
