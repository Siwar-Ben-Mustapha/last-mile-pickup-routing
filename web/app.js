/* ============================================================
   Plateforme web — Tournées LaDe
   Toutes les valeurs affichées proviennent de data/donnees.js,
   généré par le Notebook (source de vérité).
   ============================================================ */
(function () {
  "use strict";
  const P = window.PROJET;
  if (!P) { document.getElementById("erreur-donnees").hidden = false; return; }

  // ---------- Outils ----------
  const $ = (s, r = document) => r.querySelector(s);
  const fr = (x, d = 1) => Number(x).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const ent = (x) => Math.round(x).toLocaleString("fr-FR");
  const pc = (x, d = 0) => fr(100 * x, d) + " %";
  const sig = (x, d = 1) => (x > 0 ? "+" : x < 0 ? "−" : "") + fr(Math.abs(x), d) + " %";
  const var_ = (a, b) => (100 * (b - a)) / a;
  const hhmm = (min) => { const m = Math.round(min); const h = Math.floor(m / 60); return String(h).padStart(2, "0") + " h " + String(((m % 60) + 60) % 60).padStart(2, "0"); };
  const C = { reel: "#9b96b3", sans: "#ff8a3d", avec: "#a46bff", gris: "#aaa4c0", trait: "#30294a" };
  const NOMS = { reel: "Réel (coursier)", sans_ml: "Optimisé sans ML", avec_ml: "Optimisé avec ML" };
  const COUL = { reel: C.reel, sans_ml: C.sans, avec_ml: C.avec };
  const ind = P.eda.indicateurs, op = P.optim, ml = P.ml;
  const K = Object.fromEntries(op.kpi_moyens.map((r) => [r.strategie, r]));
  const KR = K[NOMS.reel], KS = K[NOMS.sans_ml], KM = K[NOMS.avec_ml];
  const MOD = Object.fromEntries(ml.modeles.map((m) => [m.modele, m]));
  const BASE = MOD["Baseline (moyennes historiques)"], FIN = MOD[ml.modele_final];
  const SC = P.scenarios;
  const SIM = window.Simulateur.creer(SC.heure_min, SC.heure_max);
  const graphes = {};

  if (window.Chart) {
    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = "#aaa4c0";
    Chart.defaults.borderColor = C.trait;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.animation.duration = 400;
  }
  function graphe(id, config) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return null;
    if (graphes[id]) graphes[id].destroy();
    graphes[id] = new Chart(el, config);
    return graphes[id];
  }
  const axe = (titre, extra = {}) => ({ title: { display: !!titre, text: titre }, grid: { color: C.trait }, ...extra });

  // ---------- Carte (canvas, sans fond de carte : fonctionne hors ligne) ----------
  function dessinerCarte(canvas, sc, routes, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
    const lat0 = sc.lat[0], kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.57;
    const X = sc.lng.map((v) => (v - sc.lng[0]) * kx), Y = sc.lat.map((v) => (v - sc.lat[0]) * ky);
    const minX = Math.min(...X), maxX = Math.max(...X), minY = Math.min(...Y), maxY = Math.max(...Y);
    const pad = 34, sx = (w - 2 * pad) / Math.max(maxX - minX, 0.05), sy = (h - 2 * pad) / Math.max(maxY - minY, 0.05);
    const s = Math.min(sx, sy);
    const ox = (w - (maxX - minX) * s) / 2, oy = (h - (maxY - minY) * s) / 2;
    const px = (i) => ox + (X[i] - minX) * s, py = (i) => h - (oy + (Y[i] - minY) * s);
    // échelle
    const km = [0.1, 0.2, 0.5, 1, 2, 5, 10].find((k) => k * s > 60) || 10;
    ctx.strokeStyle = "#8c85a8"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, h - 14); ctx.lineTo(14 + km * s, h - 14); ctx.stroke();
    ctx.fillStyle = "#aaa4c0"; ctx.font = "12px Inter, sans-serif"; ctx.fillText(fr(km, km < 1 ? 1 : 0) + " km", 18 + km * s, h - 10);
    routes.forEach((r) => {
      ctx.strokeStyle = r.couleur; ctx.lineWidth = r.epaisseur || 2.4; ctx.globalAlpha = r.alpha ?? 1;
      ctx.setLineDash(r.pointille ? [6, 5] : []); ctx.lineJoin = "round";
      ctx.beginPath(); r.ordre.forEach((j, k) => (k ? ctx.lineTo(px(j), py(j)) : ctx.moveTo(px(j), py(j)))); ctx.stroke();
    });
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    const ref = routes[routes.length - 1];
    const rang = new Array(sc.n); ref.ordre.forEach((j, k) => (rang[j] = k + 1));
    for (let i = 0; i < sc.n; i++) {
      const enRetard = opts.retards && opts.retards.has(i);
      ctx.beginPath(); ctx.arc(px(i), py(i), 10, 0, 2 * Math.PI);
      ctx.fillStyle = "#1b1726"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = enRetard ? "#ff6b4a" : ref.couleur; ctx.stroke();
      ctx.fillStyle = "#ffffff"; ctx.font = "600 11px Inter, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(rang[i]), px(i), py(i) + 0.5);
    }
    ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
  }

  // ---------- Navigation ----------
  const rendus = {};
  const PAGES = { accueil: rendreAccueil, donnees: rendreDonnees, preparation: rendrePreparation, eda: rendreEDA,
                  ml: rendreML, simulateur: rendreSimulateur, comparaison: rendreComparaison, conclusion: rendreConclusion };
  function afficher(nom) {
    if (!PAGES[nom]) nom = "accueil";
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + nom));
    document.querySelectorAll("nav a").forEach((a) => { if (a.dataset.page === nom) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    if (!rendus[nom]) { PAGES[nom]($("#page-" + nom)); rendus[nom] = true; }
    $("#nav").classList.remove("ouvert"); $(".menu-mobile").setAttribute("aria-expanded", "false");
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => afficher(location.hash.slice(1)));
  $(".menu-mobile").addEventListener("click", (e) => { const o = $("#nav").classList.toggle("ouvert"); e.currentTarget.setAttribute("aria-expanded", String(o)); });

  // Scénario de démonstration : la journée exemple du Notebook si elle est exportée, sinon la plus parlante
  function scenarioDemo() {
    const ex = SC.scenarios.find((s) => s.id === op.exemple.journee);
    if (ex) return ex;
    // sinon : la journée au gain de distance médian (ni la meilleure, ni la pire)
    const tri = SC.scenarios.slice().sort((a, b) => (a.resultats_notebook.reel.distance_km - a.resultats_notebook.avec_ml.distance_km) - (b.resultats_notebook.reel.distance_km - b.resultats_notebook.avec_ml.distance_km));
    return tri[Math.floor(tri.length / 2)];
  }
  const nomJour = (sc) => "Coursier " + sc.courier_id + ", " + String(sc.ds).padStart(4, "0").slice(2) + "/" + String(sc.ds).padStart(4, "0").slice(0, 2) + ", " + sc.n + " visites";

  // ======================= 1. ACCUEIL =======================
  function rendreAccueil(el) {
    const demo = scenarioDemo();
    const rReel = SIM.simuler(demo, "reel", SC.lambda_defaut), rMl = SIM.simuler(demo, "avec_ml", SC.lambda_defaut);
    el.innerHTML = `
      <div class="hero">
        <div class="hero-texte">
          <h1 id="t-accueil">Après chaque collecte, le coursier doit choisir où aller ensuite. Nous l'aidons à mieux choisir.</h1>
          <p class="chapeau">À Yantai, chaque colis doit être collecté avant la fin d'une fenêtre de 2 heures, et les demandes arrivent tout au long de la journée.
          Un modèle de Machine Learning <b>prédit le temps</b> entre deux points de collecte ; un algorithme d'optimisation <b>décide l'ordre de visite</b> à chaque arrêt.</p>
          <div class="chiffres" style="grid-template-columns:repeat(2,minmax(0,1fr))">
            <div class="chiffre bon"><div class="val">${sig(op.gains.distance_avec_vs_reel_pct)}</div><div class="lib">de distance par rapport aux coursiers réels (moyenne sur ${op.n_journees} journées de test)</div></div>
            <div class="chiffre bon"><div class="val">${sig(op.gains.deplacement_avec_vs_reel_pct)}</div><div class="lib">de temps de déplacement, en simulation</div></div>
            <div class="chiffre ml"><div class="val">${sig(var_(KS.n_retard, KM.n_retard), 0)}</div><div class="lib">de collectes en retard grâce au ML, par rapport à l'optimisation sans ML</div></div>
            <div class="chiffre"><div class="val">${pc(op.milp_vs_heuristique.part_optimum)}</div><div class="lib">des instances test résolues à l'optimum prouvé par notre heuristique (MILP HiGHS)</div></div>
          </div>
        </div>
        <figure class="hero-carte" style="margin:0">
          <canvas id="carte-hero" aria-label="Carte des deux tournées de la journée de démonstration"></canvas>
          <figcaption class="legende-carte">
            <span><i style="background:${C.reel}"></i>Ordre réel : ${fr(rReel.distance_km, 1)} km</span>
            <span><i style="background:${C.avec}"></i>Optimisé avec ML : ${fr(rMl.distance_km, 1)} km</span>
            <span>${nomJour(demo)}, journée de test au gain médian ; numéros = ordre optimisé, recalculé dans votre navigateur</span>
          </figcaption>
        </figure>
      </div>
      <div class="chaine" aria-label="Démarche du projet">
        <div><b>Données</b>${ent(ind.colis)} colis réels de ${ent(ind.coursiers)} coursiers (LaDe, Cainiao)</div>
        <div class="ml"><b>Modèle ML</b>Gradient Boosting : temps entre deux visites selon distance, lieu, heure</div>
        <div class="ml"><b>Prédictions</b>Une matrice de temps par heure, pour chaque journée</div>
        <div class="opt"><b>Décision</b>À chaque arrêt, optimisation de l'ordre des visites connues (TSPTW)</div>
        <div class="opt"><b>Évaluation</b>Réel, sans ML et avec ML notés par un évaluateur indépendant</div>
      </div>
      <div class="grille g2 bloc">
        <div class="panneau">
          <h3>Le problème métier</h3>
          <p>Un mauvais ordre de visite ajoute des kilomètres, consomme du temps de travail et fait manquer des échéances.
          Comme seulement ${pc(ind.part_connue_avant_debut)} des tâches sont connues avant la première collecte, l'ordre ne peut pas être fixé le matin : il faut le <b>recalculer à chaque arrêt</b>.</p>
          <h3 style="margin-top:14px">Les objectifs</h3>
          <ul class="liste-simple"><li>Prédire le temps entre deux visites mieux qu'une moyenne historique.</li><li>Utiliser ces prédictions dans un modèle d'optimisation.</li><li>Mesurer honnêtement le gain en distance, en temps et en retards.</li></ul>
        </div>
        <div class="panneau">
          <h3>KPI moyens par journée de test</h3>
          <p class="sous">${op.n_journees} journées de septembre–octobre, λ = ${fr(op.lambda, 0)}</p>
          <div class="grille g2" style="gap:10px"><div class="graph bas"><canvas id="g-acc-km"></canvas></div><div class="graph bas"><canvas id="g-acc-ret"></canvas></div></div>
          <p class="lecture">L'optimisation raccourcit les tournées ; sans ML, elle fait plus de retards que le terrain. Avec ML, elle garde le gain et réduit les retards.</p>
        </div>
      </div>`;
    requestAnimationFrame(() => dessinerCarte($("#carte-hero"), demo, [
      { ordre: rReel.ordre, couleur: C.reel, epaisseur: 2, alpha: 0.75, pointille: true },
      { ordre: rMl.ordre, couleur: C.avec, epaisseur: 2.6 }]));
    window.addEventListener("resize", () => { if ($("#page-accueil").classList.contains("active")) dessinerCarte($("#carte-hero"), demo, [
      { ordre: rReel.ordre, couleur: C.reel, epaisseur: 2, alpha: 0.75, pointille: true }, { ordre: rMl.ordre, couleur: C.avec, epaisseur: 2.6 }]); });
    const miniK = (id, titre, champ, unite, d) => graphe(id, { type: "bar", data: { labels: ["Réel", "Sans ML", "Avec ML"],
      datasets: [{ label: titre, data: ["reel", "sans_ml", "avec_ml"].map((s) => K[NOMS[s]][champ]), backgroundColor: [C.reel, C.sans, C.avec], borderRadius: 4 }] },
      options: { plugins: { legend: { display: false }, title: { display: true, text: titre }, tooltip: { callbacks: { label: (c) => fr(c.raw, d) + " " + unite } } },
        scales: { y: axe("", { beginAtZero: true }), x: { grid: { display: false } } } } });
    miniK("g-acc-km", "Distance (km / journée)", "distance_km", "km", 2);
    miniK("g-acc-ret", "Collectes en retard / journée", "n_retard", "retard(s)", 2);
  }

  // ======================= 2. DONNÉES =======================
  function rendreDonnees(el) {
    const cols = P.echantillon.colonnes, lignes = P.echantillon.lignes;
    const afficheCols = ["order_id", "courier_id", "ds", "region_id", "aoi_type", "lng", "lat", "accept_time", "time_window_start", "time_window_end", "pickup_time"];
    const idx = afficheCols.map((c) => cols.indexOf(c));
    const types = [...new Set(lignes.map((l) => l[cols.indexOf("aoi_type")]))].sort((a, b) => a - b);
    const regions = [...new Set(lignes.map((l) => l[cols.indexOf("region_id")]))].sort((a, b) => a - b);
    el.innerHTML = `
      <div class="entete"><h2 id="t-donnees">Explorer les données</h2>
        <p>Dataset public <b>LaDe-P</b> (Cainiao, licence Apache-2.0), ville de Yantai. Chaque ligne est un colis à collecter. Le tableau montre un échantillon aléatoire de ${ent(lignes.length)} colis ; le Notebook travaille sur les ${ent(ind.colis)}.</p></div>
      <div class="chiffres">
        <div class="chiffre"><div class="val">${ent(ind.colis)}</div><div class="lib">lignes (colis)</div></div>
        <div class="chiffre"><div class="val">${ind.colonnes}</div><div class="lib">colonnes</div></div>
        <div class="chiffre"><div class="val">${ent(ind.coursiers)}</div><div class="lib">coursiers, ${ind.regions} régions</div></div>
        <div class="chiffre"><div class="val">${ind.jours}<small> jours</small></div><div class="lib">de mai à octobre</div></div>
      </div>
      <div class="panneau bloc">
        <div class="outils">
          <label class="champ">Rechercher (identifiant, coursier, date…)<input type="search" id="f-texte" placeholder="Ex. 992 ou 05-18"></label>
          <label class="champ">Type d'AOI<select id="f-type"><option value="">Tous</option>${types.map((t) => `<option>${t}</option>`).join("")}</select></label>
          <label class="champ">Région<select id="f-region"><option value="">Toutes</option>${regions.map((t) => `<option>${t}</option>`).join("")}</select></label>
        </div>
        <div class="table-zone"><table><thead><tr>${afficheCols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody id="t-corps"></tbody></table></div>
        <div class="pagination"><button id="p-prec">Page précédente</button><span id="p-info"></span><button id="p-suiv">Page suivante</button></div>
      </div>
      <div class="panneau bloc"><h3>À quoi servent les variables ?</h3>
        <div class="table-zone"><table><thead><tr><th>Variable</th><th>Signification</th><th>Rôle dans le projet</th></tr></thead><tbody>
          <tr><td>courier_id, ds</td><td>coursier et date (MMJJ)</td><td>regroupent les colis en journées de tournée</td></tr>
          <tr><td>lng, lat</td><td>coordonnées du point de collecte</td><td>distances entre visites</td></tr>
          <tr><td>region_id, aoi_id, aoi_type</td><td>zone, aire d'intérêt et son type</td><td>variables explicatives du ML</td></tr>
          <tr><td>time_window_end</td><td>fin de la fenêtre promise</td><td>échéance dans l'optimisation</td></tr>
          <tr><td>accept_time</td><td>moment où la tâche devient connue</td><td>on ne planifie jamais une tâche avant qu'elle existe</td></tr>
          <tr><td>pickup_time</td><td>moment réel de la collecte</td><td>ordre réel du coursier et cible du ML</td></tr>
          <tr><td>*_gps_*</td><td>position GPS du coursier</td><td>non utilisées (21 % à 36 % manquantes)</td></tr>
        </tbody></table></div></div>`;
    let page = 0; const parPage = 15;
    const filtrer = () => {
      const q = $("#f-texte").value.trim().toLowerCase(), ty = $("#f-type").value, rg = $("#f-region").value;
      return lignes.filter((l) => (!ty || String(l[cols.indexOf("aoi_type")]) === ty) && (!rg || String(l[cols.indexOf("region_id")]) === rg)
        && (!q || idx.some((i) => String(l[i]).toLowerCase().includes(q))));
    };
    const maj = () => {
      const f = filtrer(); const nb = Math.max(1, Math.ceil(f.length / parPage)); page = Math.min(page, nb - 1);
      $("#t-corps").innerHTML = f.slice(page * parPage, (page + 1) * parPage).map((l) => "<tr>" + idx.map((i) => `<td class="${typeof l[i] === "number" ? "num" : ""}">${l[i] ?? ""}</td>`).join("") + "</tr>").join("")
        || `<tr><td colspan="${idx.length}">Aucun colis ne correspond à ces filtres. Effacez la recherche ou choisissez « Tous ».</td></tr>`;
      $("#p-info").textContent = `${ent(f.length)} colis, page ${page + 1} sur ${nb}`;
      $("#p-prec").disabled = page === 0; $("#p-suiv").disabled = page >= nb - 1;
    };
    ["#f-texte", "#f-type", "#f-region"].forEach((s) => $(s).addEventListener("input", () => { page = 0; maj(); }));
    $("#p-prec").addEventListener("click", () => { page--; maj(); });
    $("#p-suiv").addEventListener("click", () => { page++; maj(); });
    maj();
  }

  // ======================= 3. PRÉPARATION =======================
  function rendrePreparation(el) {
    const J = P.eda.journal_preprocessing;
    const explic = {
      "Données brutes": "Le fichier pickup_yt.csv est chargé tel quel.",
      "Doublons exacts": "Aucune ligne n'est répétée : rien à supprimer.",
      "Identifiants en double": "Chaque colis a un identifiant unique.",
      "Collecte avant acceptation": "Aucun colis n'est collecté avant que la tâche soit connue : les dates sont cohérentes.",
      "Fenêtre inversée": "Aucune fenêtre ne finit avant de commencer.",
      "Points hors de la zone de Yantai": "Toutes les coordonnées sont plausibles : aucune suppression.",
      "Visites construites": "Plusieurs colis consécutifs au même endroit forment une seule visite : le coursier ne se déplace pas entre eux.",
      "Paires consécutives": "Chaque passage d'une visite à la suivante devient un exemple d'apprentissage.",
      "Paires causales": "On garde le trajet seulement si la visite suivante était déjà connue au départ ; sinon l'écart mesure une attente, pas un trajet.",
      "Pauses exclues de l'apprentissage": "Au-delà de 120 min, ce n'est plus un trajet mais une pause : exclu de l'apprentissage, conservé dans les tournées réelles.",
      "Paires d'apprentissage": "Base finale : 9 variables connues avant de partir, sans fuite de données.",
    };
    const manq = Object.entries(P.eda.valeurs_manquantes);
    el.innerHTML = `
      <div class="entete"><h2 id="t-preparation">Préparation des données</h2>
        <p>Du fichier brut à la base d'apprentissage. Chaque étape est justifiée ; aucune ligne n'est supprimée sans raison.</p></div>
      <div class="grille g2">
        <div class="panneau"><h3>État initial : valeurs manquantes par colonne</h3>
          <p class="sous">Seules les colonnes GPS ont des trous ; elles ne sont pas utilisées par le modèle.</p>
          <div class="graph haut"><canvas id="g-manq"></canvas></div></div>
        <div class="panneau"><h3>Du colis au trajet d'apprentissage</h3>
          <p class="sous">Nombre de lignes à chaque étape clé</p>
          <div class="graph haut"><canvas id="g-entonnoir"></canvas></div></div>
      </div>
      <div class="panneau bloc"><h3>Les étapes, dans l'ordre</h3>
        <ol class="etapes">${J.map((r) => `<li><div><b>${r.etape}</b><p>${explic[r.etape] || r.explication}</p></div><span class="nb">${ent(r.lignes)}</span></li>`).join("")}</ol></div>
      <div class="grille g2 bloc">
        <div class="encadre"><h3>Découpage sans fuite de données</h3><p>Le modèle apprend sur <b>mai à août</b> et il est testé sur <b>septembre–octobre</b> : on ne prédit jamais le passé avec le futur. Les coursiers sont tirés au hasard en deux groupes disjoints. Le groupe A entraîne le modèle qui <b>décide</b> ; le groupe B entraîne un modèle qui <b>note</b> les tournées. Le modèle qui décide n'est jamais celui qui note.</p></div>
        <div class="encadre orange"><h3>Ce qu'on ne peut pas savoir</h3><p>L'année n'est pas dans les dates : le jour de la semaine est inconnu et n'est donc pas utilisé. Les heures réelles de collecte de la visite cible ne sont jamais des variables explicatives.</p></div>
      </div>`;
    graphe("g-manq", { type: "bar", data: { labels: manq.map((m) => m[0]), datasets: [{ label: "Valeurs manquantes (%)", data: manq.map((m) => (100 * m[1]) / ind.colis), backgroundColor: manq.map((m) => (m[1] ? C.sans : C.avec)), borderRadius: 3 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fr(c.raw, 1) + " % manquantes" } } }, scales: { x: axe("% de lignes manquantes", { max: 40 }), y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } });
    const etapes = ["Données brutes", "Visites construites", "Paires consécutives", "Paires causales", "Paires d'apprentissage"];
    const Jm = Object.fromEntries(J.map((r) => [r.etape, r.lignes]));
    graphe("g-entonnoir", { type: "bar", data: { labels: ["Colis", "Visites", "Paires consécutives", "Paires causales", "Base d'apprentissage"], datasets: [{ label: "Lignes", data: etapes.map((e) => Jm[e]), backgroundColor: C.avec, borderRadius: 4 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ent(c.raw) + " lignes" } } }, scales: { y: axe("Lignes", { beginAtZero: true }), x: { grid: { display: false } } } } });
  }

  // ======================= 4. EDA =======================
  function rendreEDA(el) {
    const E = P.eda;
    const carte = (id, titre, sous, lecture, cls = "") => `<div class="panneau"><h3>${titre}</h3><p class="sous">${sous}</p><div class="graph ${cls}"><canvas id="${id}"></canvas></div><p class="lecture">${lecture}</p></div>`;
    el.innerHTML = `
      <div class="entete"><h2 id="t-eda">Analyse exploratoire</h2><p>Chaque graphique répond à une question logistique qui oriente le modèle ou l'optimisation. Survolez les graphiques pour lire les valeurs.</p></div>
      <div class="grille g2">
        ${carte("g-vol", "Le volume est-il stable ?", "Colis collectés par jour", "L'activité culmine en juin puis se stabilise autour de 6 000 colis/jour. La période de test (sept.–oct.) reste comparable à l'apprentissage.")}
        ${carte("g-ecarts", "Combien de temps entre deux visites ?", "Distribution des écarts (min, tronqué à 200)", `Médiane de <b>${fr(ind.ecart_median, 0)} min</b>, mais une longue queue : au-delà de 120 min, ce sont des pauses, exclues de l'apprentissage.`)}
        ${carte("g-dist", "La distance explique-t-elle le temps ?", "Temps médian et 50 % central par tranche de distance", "Le temps n'est <b>pas proportionnel</b> à la distance : il plafonne vers 13 min puis baisse pour les longs trajets. À distance égale, la dispersion est forte.")}
        <div class="panneau"><h3>L'heure de la journée compte-t-elle ?</h3><p class="sous">Temps entre visites selon l'heure de départ</p>
          <div class="bascule" role="group" aria-label="Statistique affichée"><button aria-pressed="true" data-stat="moyenne">Moyenne</button><button aria-pressed="false" data-stat="mediane">Médiane</button></div>
          <div class="graph" style="margin-top:8px"><canvas id="g-heure"></canvas></div>
          <p class="lecture">Le matin est rapide ; l'après-midi, le temps moyen monte jusqu'à environ 20 min. La matrice de temps doit donc <b>dépendre de l'heure</b>.</p></div>
        ${carte("g-marge", "Les fenêtres horaires sont-elles respectées ?", "Minutes restantes avant l'échéance au moment de la collecte", `Seulement <b>${pc(ind.taux_retard_reel, 2)}</b> de retards réels, et ${pc(ind.taux_avant_fenetre)} des colis collectés avant le début de la fenêtre. Le gain attendu porte sur le temps et la distance.`)}
        ${carte("g-type", "Le type de lieu influence-t-il le temps ?", "Temps moyen selon le type d'AOI d'arrivée (8 types les plus fréquents)", "Écarts modestes (14 à 16 min) : une information utile mais secondaire, ce que confirme l'importance des variables.")}
        ${carte("g-taille", "Quelle est la taille d'une tournée ?", "Visites par journée de coursier (tronqué à 60)", "Les journées de 10 à 30 visites sont celles où l'ordre compte vraiment : ce sont elles que nous optimisons.")}
        <div class="panneau"><h3>Où sont les points de collecte ?</h3><p class="sous">4 000 visites tirées au hasard ; couleur = région</p>
          <div class="graph"><canvas id="g-points"></canvas></div>
          <p class="lecture">Plusieurs pôles urbains séparés : les tournées restent locales, et la région apporte une information utile au modèle.</p></div>
      </div>
      <div class="panneau bloc"><h3>Corrélations entre variables (Spearman)</h3><p class="sous">Plus la case est foncée, plus le lien est fort</p>
        <div class="table-zone"><table class="corr" id="t-corr"></table></div>
        <p class="lecture">La distance (0,27) et l'heure (0,17) sont les variables les plus liées au temps, mais toutes les corrélations restent faibles : il faut un modèle <b>non linéaire</b> qui combine les variables.</p></div>`;
    graphe("g-vol", { type: "line", data: { labels: E.volume_quotidien.dates, datasets: [{ label: "Colis par jour", data: E.volume_quotidien.colis, borderColor: C.avec, borderWidth: 2, pointRadius: 0, tension: 0.2 }] },
      options: { interaction: { mode: "index", intersect: false }, plugins: { legend: { display: false } }, scales: { y: axe("Colis par jour"), x: { ticks: { maxTicksLimit: 8 }, grid: { display: false } } } } });
    const centres = (b) => b.slice(0, -1).map((x, i) => (x + b[i + 1]) / 2);
    graphe("g-ecarts", { type: "bar", data: { labels: centres(E.hist_ecarts.bords).map((x) => fr(x, 0)), datasets: [{ label: "Trajets", data: E.hist_ecarts.valeurs, backgroundColor: E.hist_ecarts.bords.slice(0, -1).map((x) => (x >= 120 ? C.sans : C.avec)), barPercentage: 1, categoryPercentage: 0.95 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => "Vers " + c[0].label + " min", label: (c) => ent(c.raw) + " trajets" } } }, scales: { y: axe("Trajets"), x: axe("Écart (min)", { grid: { display: false }, ticks: { maxTicksLimit: 11 } }) } } });
    const D = E.temps_vs_distance;
    graphe("g-dist", { type: "line", data: { labels: D.bandes, datasets: [
      { label: "3e quartile", data: D.q75, borderColor: "rgba(164,107,255,.45)", backgroundColor: "rgba(164,107,255,.18)", fill: "+1", pointRadius: 0 },
      { label: "1er quartile", data: D.q25, borderColor: "rgba(164,107,255,.45)", pointRadius: 0, fill: false },
      { label: "Médiane", data: D.mediane, borderColor: C.avec, borderWidth: 2.2, pointRadius: 3, pointBackgroundColor: C.avec }] },
      options: { interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { filter: (l) => l.text !== "1er quartile" } } }, scales: { y: axe("Temps (min)"), x: { grid: { display: false } } } } });
    const H = E.par_heure;
    const gH = graphe("g-heure", { type: "bar", data: { labels: H.heures.map((h) => h + " h"), datasets: [{ label: "Temps moyen (min)", data: H.moyenne, backgroundColor: C.avec, borderRadius: 3 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => ent(H.n[c.dataIndex]) + " trajets" } } }, scales: { y: axe("Temps (min)", { beginAtZero: true }), x: { grid: { display: false } } } } });
    el.querySelectorAll(".bascule button").forEach((b) => b.addEventListener("click", () => {
      el.querySelectorAll(".bascule button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      if (gH) { const st = b.dataset.stat; gH.data.datasets[0].data = H[st]; gH.data.datasets[0].label = st === "moyenne" ? "Temps moyen (min)" : "Temps médian (min)"; gH.update(); }
    }));
    const M = E.hist_marge;
    graphe("g-marge", { type: "bar", data: { labels: centres(M.bords).map((x) => fr(x, 0)), datasets: [{ label: "Colis", data: M.valeurs, backgroundColor: M.bords.slice(0, -1).map((x) => (x < 0 ? C.sans : C.avec)), barPercentage: 1, categoryPercentage: 0.95 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => c[0].label + " min avant l'échéance", label: (c) => ent(c.raw) + " colis" } } }, scales: { y: axe("Colis"), x: axe("Minutes avant l'échéance (négatif = retard)", { grid: { display: false }, ticks: { maxTicksLimit: 12 } }) } } });
    const T = E.par_type_aoi;
    graphe("g-type", { type: "bar", data: { labels: T.types.map((t) => "type " + t), datasets: [{ label: "Temps moyen (min)", data: T.moyenne, backgroundColor: C.avec, borderRadius: 3 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => ent(T.n[c.dataIndex]) + " trajets" } } }, scales: { y: axe("Temps moyen (min)", { beginAtZero: true }), x: { grid: { display: false } } } } });
    const S = E.hist_taille;
    graphe("g-taille", { type: "bar", data: { labels: S.bords.slice(0, -1).map((x) => fr(x, 0)), datasets: [{ label: "Journées", data: S.valeurs, backgroundColor: S.bords.slice(0, -1).map((x) => (x >= 10 && x <= 30 ? C.sans : C.avec)), barPercentage: 1, categoryPercentage: 0.95 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => c[0].label + " visites", label: (c) => ent(c.raw) + " journées" } } }, scales: { y: axe("Journées-coursier"), x: axe("Visites dans la journée", { grid: { display: false }, ticks: { maxTicksLimit: 12 } }) } } });
    const pts = E.points_carte, regs = [...new Set(pts.map((p) => p[2]))].sort((a, b) => a - b);
    const teinte = (r) => `hsl(${(regs.indexOf(r) * 137.5) % 360} 65% 62%)`;
    graphe("g-points", { type: "scatter", data: { datasets: [{ label: "Visites", data: pts.map((p) => ({ x: p[0], y: p[1], r: p[2] })), pointRadius: 1.4, pointBackgroundColor: pts.map((p) => teinte(p[2])), pointBorderWidth: 0 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "Région " + c.raw.r + " (" + fr(c.raw.x, 3) + " ; " + fr(c.raw.y, 3) + ")" } } }, scales: { x: axe("Longitude"), y: axe("Latitude") } } });
    const V = E.correlations.variables, MAT = E.correlations.matrice;
    $("#t-corr").innerHTML = "<thead><tr><th></th>" + V.map((v) => `<th>${v}</th>`).join("") + "</tr></thead><tbody>" +
      V.map((v, i) => `<tr><th>${v}</th>` + MAT[i].map((x) => { const a = Math.abs(x); const c = x >= 0 ? `rgba(164,107,255,${a * 0.85})` : `rgba(255,138,61,${a * 0.85})`; return `<td style="background:${c};color:${a > 0.55 ? "#fff" : "#e9e5f5"}">${fr(x, 2)}</td>`; }).join("") + "</tr>").join("") + "</tbody>";
  }

  // ======================= 5. ML =======================
  function rendreML(el) {
    const noms = ml.modeles.map((m) => m.modele);
    const coulM = noms.map((n) => (n === ml.modele_final ? C.avec : n.startsWith("Baseline") ? C.sans : C.reel));
    el.innerHTML = `
      <div class="entete"><h2 id="t-ml">Modèles de Machine Learning</h2>
        <p>Le modèle prédit le <b>temps en minutes entre la fin d'une visite et le début de la suivante</b>. Il apprend sur ${ent(ml.tailles.train)} trajets (mai–août) et il est testé sur ${ent(ml.tailles.test)} trajets jamais vus (sept.–oct.).</p></div>
      <div class="grille g2">
        <div class="encadre"><h3>Comment le modèle transforme des données en prédiction</h3>
          <p>Pour chaque paire de points, on lui donne 9 informations connues <b>avant</b> de partir : distance, même aire d'intérêt ou non, types de lieux, heure, nombre de colis, région et coordonnées d'arrivée.</p>
          <p>Le Gradient Boosting construit des centaines de petits arbres de décision « si… alors… ». Chaque arbre corrige les erreurs des précédents, et la prédiction est la somme de leurs réponses. Pour une journée, on interroge le modèle sur <b>toutes les paires de points, pour chaque heure</b> : on obtient la matrice de temps que l'optimiseur utilise.</p></div>
        <div class="panneau"><h3>Les modèles comparés</h3>
          <ul class="liste-simple">
            <li><b>Baseline</b> (sans ML) : ${fr(ml.baseline.service_median_min, 0)} min de service + distance ÷ ${fr(ml.baseline.vitesse_mediane_kmh, 1)} km/h, à partir de moyennes historiques.</li>
            <li><b>Régression linéaire</b> : un coefficient par variable, simple à expliquer.</li>
            <li><b>Arbre de décision</b> : des règles lisibles (profondeur 10).</li>
            <li><b>Random Forest</b> : la moyenne de nombreux arbres, robuste.</li>
            <li><b>Gradient Boosting</b> : des arbres successifs qui corrigent les erreurs, rapide sur de gros volumes.</li></ul></div>
      </div>
      <div class="panneau bloc"><h3>Performances sur le jeu de test</h3>
        <div class="table-zone"><table><thead><tr><th>Modèle</th><th class="num">MAE (min)</th><th class="num">Biais moyen (min)</th><th class="num">RMSE (min)</th><th class="num">R²</th><th class="num">Entraînement (s)</th></tr></thead><tbody>
          ${ml.modeles.map((m) => `<tr class="${m.modele === ml.modele_final ? "retenu" : ""}"><td>${m.modele}${m.modele === ml.modele_final ? " (retenu)" : ""}</td><td class="num">${fr(m.MAE, 2)}</td><td class="num">${fr(m.Biais, 2)}</td><td class="num">${fr(m.RMSE, 2)}</td><td class="num">${fr(m.R2, 3)}</td><td class="num">${fr(m.temps_entrainement_s, 1)}</td></tr>`).join("")}
        </tbody></table></div>
        <div class="grille g3" style="margin-top:14px">
          <div><h3>MAE</h3><p class="sous">erreur moyenne, plus petit = mieux</p><div class="graph bas"><canvas id="g-mae"></canvas></div></div>
          <div><h3>RMSE</h3><p class="sous">pénalise les grosses erreurs</p><div class="graph bas"><canvas id="g-rmse"></canvas></div></div>
          <div><h3>Biais moyen</h3><p class="sous">proche de 0 = juste en moyenne</p><div class="graph bas"><canvas id="g-biais"></canvas></div></div>
        </div>
        <p class="lecture"><b>La baseline a la plus petite MAE</b> (${fr(BASE.MAE, 2)} min) car elle prédit le trajet « typique ». Mais elle <b>sous-estime chaque trajet de ${fr(Math.abs(BASE.Biais), 1)} min en moyenne</b>, ce qui fait environ ${fr(Math.abs(BASE.Biais) * 20, 0)} min d'erreur sur une tournée de 20 trajets. Le ${ml.modele_final} a la meilleure RMSE (${fr(FIN.RMSE, 2)}), le meilleur R² (${fr(FIN.R2, 2)}) et un biais quasi nul : c'est lui que nous retenons, car une tournée <b>additionne</b> les temps.</p>
      </div>
      <div class="grille g2 bloc">
        <div class="panneau"><h3>Où le modèle se trompe-t-il ?</h3><p class="sous">Erreur moyenne par tranche de distance</p><div class="graph"><canvas id="g-errdist"></canvas></div>
          <p class="lecture">Sur les trajets courts, la formule fait aussi bien. Au-delà de 5 km, son erreur explose (plus de 100 min au-delà de 15 km), alors que le ML reste stable. Le ML sert surtout à <b>éviter les grosses erreurs</b>.</p></div>
        <div class="panneau"><h3>Quelles variables comptent ?</h3><p class="sous">Hausse de la MAE si la variable est mélangée au hasard (min)</p><div class="graph"><canvas id="g-imp"></canvas></div>
          <p class="lecture">La <b>localisation</b> et l'<b>heure</b> pèsent plus que la distance : certains quartiers et l'après-midi sont plus lents. Le R² reste modeste (≈ ${fr(FIN.R2, 2)}) : une partie du temps dépend d'éléments absents des données.</p></div>
      </div>`;
    const barres = (id, champ) => graphe(id, { type: "bar", data: { labels: noms.map((n) => n.replace(" (moyennes historiques)", "")), datasets: [{ label: champ, data: ml.modeles.map((m) => m[champ]), backgroundColor: coulM, borderRadius: 3 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => fr(c.raw, 2) + " min" } } }, scales: { x: axe(""), y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } });
    barres("g-mae", "MAE"); barres("g-rmse", "RMSE"); barres("g-biais", "Biais");
    const ED = ml.erreurs_par_distance;
    graphe("g-errdist", { type: "bar", data: { labels: ED.bandes, datasets: [{ label: "Baseline (formule)", data: ED.baseline, backgroundColor: C.sans, borderRadius: 3 }, { label: ml.modele_final, data: ED.ml, backgroundColor: C.avec, borderRadius: 3 }] },
      options: { plugins: { tooltip: { callbacks: { label: (c) => c.dataset.label + " : " + fr(c.raw, 1) + " min" } } }, scales: { y: axe("MAE (min)", { beginAtZero: true }), x: { grid: { display: false }, ticks: { font: { size: 10 } } } } } });
    const imp = Object.entries(ml.importances);
    graphe("g-imp", { type: "bar", data: { labels: imp.map((i) => i[0]), datasets: [{ label: "Importance", data: imp.map((i) => i[1]), backgroundColor: C.avec, borderRadius: 3 }] },
      options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "+" + fr(c.raw, 2) + " min de MAE" } } }, scales: { x: axe("min"), y: { grid: { display: false } } } } });
  }

  // ======================= 6. SIMULATEUR =======================
  function rendreSimulateur(el) {
    const scs = SC.scenarios;
    const demo = scenarioDemo();
    el.innerHTML = `
      <div class="entete"><h2 id="t-simulateur">Simulateur de tournées</h2>
        <p>Choisissez une vraie journée de test et une politique. Le navigateur <b>rejoue la journée arrêt par arrêt</b> : à chaque arrêt, l'optimiseur recalcule l'ordre des visites déjà connues. Les matrices de temps (prédictions ML, formule sans ML, évaluateur) sont précalculées par le Notebook ; <b>l'optimisation, elle, est exécutée ici</b>, avec le même algorithme que dans le Notebook.</p></div>
      <div class="sim">
        <form class="panneau commandes" id="f-sim">
          <label class="champ">Journée de test<select id="s-jour">${scs.map((s) => `<option value="${s.id}" ${s.id === demo.id ? "selected" : ""}>${nomJour(s)}</option>`).join("")}</select></label>
          <label class="champ">Coût d'une minute de retard (λ)
            <span class="valeur-lambda" id="s-lval">${fr(SC.lambda_defaut, 1)}</span>
            <input type="range" id="s-lambda" min="0" max="20" step="0.5" value="${SC.lambda_defaut}" aria-describedby="aide-l"></label>
          <p class="aide" id="aide-l">λ = 0 : on ne cherche qu'à raccourcir la tournée. λ élevé : on accepte des détours pour respecter les échéances. Valeur du Notebook : ${fr(SC.lambda_defaut, 0)}.</p>
          <fieldset><legend>Connaissance des tâches</legend>
            <label class="radio"><input type="radio" name="s-info" value="reelle" checked><span>Comme en réalité<small>une tâche n'est planifiée qu'après son acceptation</small></span></label>
            <label class="radio"><input type="radio" name="s-info" value="totale"><span>Toutes connues dès le départ<small>scénario optimiste, pour mesurer le coût de l'incertitude</small></span></label>
          </fieldset>
          <button type="submit" class="principal">Simuler la journée</button>
          <p class="aide">Les trois stratégies partent de la même première visite, à la même heure. Le temps réellement écoulé est donné par l'évaluateur indépendant ; la distance est exacte.</p>
        </form>
        <div id="s-res"><div class="res-vide">Réglez les paramètres puis cliquez sur « Simuler la journée ».</div></div>
      </div>`;
    const lam = $("#s-lambda");
    lam.addEventListener("input", () => ($("#s-lval").textContent = fr(+lam.value, 1)));
    $("#f-sim").addEventListener("submit", (e) => { e.preventDefault(); lancer(); });
    lancer();

    function lancer() {
      const sc = scs.find((s) => s.id === +$("#s-jour").value);
      const l = +lam.value, toutes = el.querySelector('input[name="s-info"]:checked').value === "totale";
      const t0 = performance.now();
      const res = { reel: SIM.simuler(sc, "reel", l), sans_ml: SIM.simuler(sc, "sans_ml", l, toutes), avec_ml: SIM.simuler(sc, "avec_ml", l, toutes) };
      const duree = performance.now() - t0;
      // Contrôle de cohérence avec le Notebook (mêmes paramètres que le Notebook)
      let parite = "";
      if (l === SC.lambda_defaut && !toutes) {
        const ok = ["reel", "sans_ml", "avec_ml"].every((s) => ["distance_km", "deplacement_min", "n_retard", "retard_min"].every((c) => Math.abs(res[s][c] - sc.resultats_notebook[s][c]) < 1e-6));
        parite = ok ? `<p class="parite">Résultats identiques à ceux calculés par le Notebook pour cette journée (λ = ${fr(l, 0)}).</p>`
                    : `<p class="parite diff">Écart avec le Notebook détecté pour cette journée : vérifiez que data/donnees.js a été régénéré par la dernière exécution du Notebook.</p>`;
      }
      const base = res.reel;
      const ligne = (s, lib, champ, d, unite) => {
        const v = res[s][champ], r = base[champ];
        let ecart = "";
        if (s !== "reel" && r > 0) { const p = var_(r, v); ecart = `<span class="ecart ${p < -0.05 ? "mieux" : p > 0.05 ? "pire" : ""}">${sig(p, 0)}</span>`; }
        else if (s !== "reel" && champ === "n_retard" && v > r) ecart = `<span class="ecart pire">+${v - r}</span>`;
        return `<dt>${lib}</dt><dd>${champ === "n_retard" ? v : fr(v, d)} ${unite}${ecart}</dd>`;
      };
      const carteStrat = (s) => `<div class="strat" style="--c:${COUL[s]}"><h3>${NOMS[s]}</h3><dl>
        ${ligne(s, "Distance", "distance_km", 2, "km")}${ligne(s, "Déplacement", "deplacement_min", 0, "min")}${ligne(s, "Durée totale", "duree_min", 0, "min")}
        ${ligne(s, "Collectes en retard", "n_retard", 0, "")}${ligne(s, "Minutes de retard", "retard_min", 0, "min")}</dl></div>`;
      const m = res.avec_ml, sa = res.sans_ml;
      const conseil = (() => {
        const dKm = var_(base.distance_km, m.distance_km), dT = var_(base.deplacement_min, m.deplacement_min);
        let t = `Avec ML, la tournée change de ${sig(dKm, 0)} en distance et de ${sig(dT, 0)} en temps de déplacement par rapport à l'ordre réel. `;
        if (m.n_retard < sa.n_retard) t += `Elle compte <b>${sa.n_retard - m.n_retard} retard(s) de moins</b> que l'optimisation sans ML, qui sous-estime les temps. `;
        else if (m.n_retard > sa.n_retard) t += `Ici, elle compte ${m.n_retard - sa.n_retard} retard(s) de plus que l'optimisation sans ML : le ML n'est pas meilleur sur toutes les journées. `;
        else t += `Les deux optimiseurs ont le même nombre de retards sur cette journée. `;
        if (l === 0) t += "Avec λ = 0, les retards ne sont pas pénalisés : l'optimiseur ne cherche que le chemin le plus court.";
        else t += "<b>Décision recommandée :</b> suivre l'ordre « avec ML », qui garde l'essentiel du gain de distance tout en protégeant les échéances.";
        return t;
      })();
      $("#s-res").innerHTML = `
        <div class="trois">${carteStrat("reel")}${carteStrat("sans_ml")}${carteStrat("avec_ml")}</div>
        <div class="panneau bloc verdict" style="margin-top:14px"><h3>Ce que montre cette journée</h3><p>${conseil}</p>
          ${toutes ? "<p class='aide'>Scénario optimiste : l'ordre réel reste rejoué tel quel, avec sa contrainte de tâches connues.</p>" : ""}
          ${parite}<p class="aide">${sc.n} visites, ${res.avec_ml.journal.length + res.sans_ml.journal.length} décisions optimisées en ${fr(duree, 0)} ms dans votre navigateur.</p></div>
        <div class="grille g2 bloc">
          <div class="panneau"><h3>Comparaison des KPI</h3><p class="sous">Valeurs pour la journée simulée</p>
            <div class="grille g3" style="gap:8px">
              <div><div class="graph haut"><canvas id="gs-km"></canvas></div></div>
              <div><div class="graph haut"><canvas id="gs-min"></canvas></div></div>
              <div><div class="graph haut"><canvas id="gs-ret"></canvas></div></div></div>
            <p class="lecture">Les pourcentages des cartes ci-dessus sont calculés par rapport à l'ordre réel du coursier, rejoué dans les mêmes conditions.</p></div>
          <div class="panneau carte-sim"><h3>Carte de la tournée</h3>
            <div class="bascule" role="group" aria-label="Tournée affichée"><button type="button" data-s="avec_ml" aria-pressed="true">Avec ML</button><button type="button" data-s="sans_ml" aria-pressed="false">Sans ML</button><button type="button" data-s="reel" aria-pressed="false">Réel</button></div>
            <p class="sous" style="margin-top:6px">Trait plein : tournée choisie, numérotée dans l'ordre de passage. Pointillés gris : ordre réel. Cercle orange foncé : collecte en retard.</p>
            <canvas id="s-carte"></canvas></div>
        </div>
        <div class="panneau bloc"><h3>Journal des décisions avec ML</h3><p class="sous">À chaque arrêt : combien de tâches étaient connues, et où l'optimiseur a envoyé le coursier</p>
          <div class="table-zone" style="max-height:360px;overflow-y:auto"><table class="journal"><thead><tr><th>Arrêt</th><th>Départ</th><th>De</th><th>Vers</th><th class="num">Tâches connues</th><th class="num">Distance</th><th class="num">Temps</th><th>Arrivée</th></tr></thead><tbody>
          ${m.journal.map((j, k) => `<tr><td>${k + 1}</td><td>${hhmm(j.depart)}</td><td>visite ${j.de + 1}</td><td>visite ${j.vers + 1}</td><td class="num">${j.connues}</td><td class="num">${fr(j.km, 2)} km</td><td class="num">${fr(j.duree, 1)} min</td><td class="${j.retard ? "retard" : ""}">${hhmm(j.arrivee)}${j.retard ? " (retard)" : ""}</td></tr>`).join("")}
          </tbody></table></div></div>`;
      const mini = (id, titre, champ, d) => graphe(id, { type: "bar", data: { labels: ["Réel", "Sans ML", "Avec ML"], datasets: [{ label: titre, data: ["reel", "sans_ml", "avec_ml"].map((s) => res[s][champ]), backgroundColor: [C.reel, C.sans, C.avec], borderRadius: 3 }] },
        options: { plugins: { legend: { display: false }, title: { display: true, text: titre, color: "#ffffff", font: { weight: 600 } }, tooltip: { callbacks: { label: (c) => fr(c.raw, d) } } }, scales: { y: axe("", { beginAtZero: true }), x: { grid: { display: false }, ticks: { font: { size: 10 } } } } } });
      mini("gs-km", "Distance (km)", "distance_km", 2); mini("gs-min", "Déplacement (min)", "deplacement_min", 0); mini("gs-ret", "Retards", "n_retard", 0);
      const dessiner = (s) => {
        const retards = new Set(res[s].journal.filter((j) => j.retard).map((j) => j.vers));
        const routes = s === "reel" ? [{ ordre: res.reel.ordre, couleur: C.reel, epaisseur: 2.6 }]
          : [{ ordre: res.reel.ordre, couleur: C.reel, epaisseur: 1.6, alpha: 0.6, pointille: true }, { ordre: res[s].ordre, couleur: COUL[s], epaisseur: 2.6 }];
        dessinerCarte($("#s-carte"), sc, routes, { retards });
      };
      $("#s-res").querySelectorAll(".bascule button").forEach((b) => b.addEventListener("click", () => {
        $("#s-res").querySelectorAll(".bascule button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); dessiner(b.dataset.s); }));
      requestAnimationFrame(() => dessiner("avec_ml"));
    }
  }

  // ======================= 7. AVANT / APRÈS =======================
  function rendreComparaison(el) {
    const G = op.gains, mv = op.milp_vs_heuristique, sens = op.sensibilite_lambda;
    const lig = (lib, v, ref, d, unite, inverse = false) => { const p = var_(ref, v); return `<div class="ligne"><span>${lib}<span class="ref">réel : ${fr(ref, d)} ${unite}</span></span><span><b>${fr(v, d)}</b> ${unite} <span class="ecart ${p < 0 ? "mieux" : "pire"}">${sig(p, 0)}</span></span></div>`; };
    el.innerHTML = `
      <div class="entete"><h2 id="t-comparaison">Avant / après : la preuve sur ${op.n_journees} journées</h2>
        <p>Moyennes par journée de test (septembre–octobre), λ = ${fr(op.lambda, 0)}. Les deux scénarios utilisent le <b>même optimiseur</b> ; seule change la matrice de temps. Les pourcentages sont calculés par rapport à l'ordre réel des coursiers.</p></div>
      <div class="duel">
        <div style="--c:${C.sans}"><h3>Sans Machine Learning</h3><p class="sous">Formule : ${fr(ml.baseline.service_median_min, 0)} min + distance ÷ ${fr(ml.baseline.vitesse_mediane_kmh, 1)} km/h</p>
          ${lig("Distance parcourue", KS.distance_km, KR.distance_km, 2, "km")}${lig("Temps de déplacement", KS.deplacement_min, KR.deplacement_min, 1, "min")}${lig("Durée de la tournée", KS.duree_min, KR.duree_min, 1, "min")}${lig("Collectes en retard", KS.n_retard, KR.n_retard, 2, "")}${lig("Minutes de retard", KS.retard_min, KR.retard_min, 1, "min")}</div>
        <div style="--c:${C.avec}"><h3>Avec Machine Learning</h3><p class="sous">Matrice horaire prédite par le ${ml.modele_final}</p>
          ${lig("Distance parcourue", KM.distance_km, KR.distance_km, 2, "km")}${lig("Temps de déplacement", KM.deplacement_min, KR.deplacement_min, 1, "min")}${lig("Durée de la tournée", KM.duree_min, KR.duree_min, 1, "min")}${lig("Collectes en retard", KM.n_retard, KR.n_retard, 2, "")}${lig("Minutes de retard", KM.retard_min, KR.retard_min, 1, "min")}</div>
      </div>
      <div class="grille g3 bloc">
        <div class="encadre"><h3>Valeur de l'optimisation</h3><p>Par rapport aux coursiers réels, l'optimisation avec ML réduit la distance de <b>${fr(-G.distance_avec_vs_reel_pct, 1)} %</b> et le temps de déplacement de <b>${fr(-G.deplacement_avec_vs_reel_pct, 1)} %</b>. Elle fait mieux que le réel dans ${pc(G.part_journees_ml_meilleur_que_reel_deplacement)} des journées (Wilcoxon, p &lt; 0,001).</p></div>
        <div class="encadre"><h3>Valeur du ML</h3><p>Par rapport à l'optimisation sans ML, les retards baissent de <b>${fr(-var_(KS.n_retard, KM.n_retard), 0)} %</b>. En contrepartie, la distance augmente de ${fr(G.distance_avec_vs_sans_pct, 1)} % et le temps de déplacement de ${fr(G.deplacement_avec_vs_sans_pct, 1)} %.</p></div>
        <div class="encadre orange"><h3>Le compromis, honnêtement</h3><p>Sans ML, l'optimiseur gagne plus de kilomètres mais fait <b>plus de retards que le terrain</b>, car sa formule sous-estime les temps de ${fr(Math.abs(BASE.Biais), 1)} min par trajet. Le ML ne raccourcit pas davantage les tournées : il rend le plan <b>fiable</b>.</p></div>
      </div>
      <div class="grille g2 bloc">
        <div class="panneau"><h3>Gain de temps par journée</h3><p class="sous">Nombre de journées selon le gain de temps de déplacement par rapport au réel</p><div class="graph"><canvas id="g-gains"></canvas></div>
          <p class="lecture">Gain médian : ${fr(op.gain_median_deplacement_pct.sans_ml, 1)} % sans ML, ${fr(op.gain_median_deplacement_pct.avec_ml, 1)} % avec ML. Quelques journées sont moins bonnes que le réel : le coursier sait parfois des choses absentes des données.</p></div>
        <div class="panneau"><h3>Le compromis temps / retards selon λ</h3><p class="sous">50 journées ; chaque point est une valeur de λ (0, 1, 5, 20)</p><div class="graph"><canvas id="g-sens"></canvas></div>
          <p class="lecture">Même avec une forte pénalité, l'optimiseur sans ML plafonne en retards : <b>une bonne pénalité ne compense pas une mauvaise prédiction</b>.</p></div>
      </div>
      <div class="grille g3 bloc">
        <div class="chiffre"><div class="val">${fr(mv.ecart_moyen_pct, 2)}<small> %</small></div><div class="lib">écart moyen de l'heuristique à l'optimum exact (MILP HiGHS, ${mv.n_instances} instances de 8 visites)</div></div>
        <div class="chiffre"><div class="val">${fr(mv.temps_heuristique_moyen_s * 1000, 1)}<small> ms</small></div><div class="lib">par décision pour l'heuristique, contre ${fr(mv.temps_milp_moyen_s, 2)} s pour le MILP exact</div></div>
        <div class="chiffre"><div class="val">${fr(op.validation_evaluateur.correlation, 2)}</div><div class="lib">corrélation entre durées simulées et durées réelles des tournées (évaluateur indépendant)</div></div>
      </div>
      <div class="encadre orange bloc"><h3>Ce qui est observé, ce qui est simulé</h3><p><b>Observé :</b> l'ordre réel, les positions, les fenêtres, les distances. <b>Simulé :</b> les temps des tournées optimisées, qui n'ont jamais été réalisées. L'évaluateur surestime les retards en valeur absolue (${fr(KR.n_retard, 2)} simulés contre ${fr(op.retards_observes_moyens, 2)} observés par journée). Seules les <b>comparaisons entre stratégies</b>, toutes notées de la même façon, sont donc interprétables.</p></div>`;
    const gs = op.gains_par_journee_pct, all = gs.sans_ml.concat(gs.avec_ml);
    const lo = Math.floor(Math.min(...all) / 2.5) * 2.5, hi = Math.ceil(Math.max(...all) / 2.5) * 2.5, bins = [];
    for (let x = lo; x < hi; x += 2.5) bins.push(x);
    const cpt = (arr) => bins.map((b) => arr.filter((v) => v >= b && v < b + 2.5).length);
    graphe("g-gains", { type: "bar", data: { labels: bins.map((b) => fr(b, 1) + " à " + fr(b + 2.5, 1)), datasets: [
      { label: "Optimisé sans ML", data: cpt(gs.sans_ml), backgroundColor: C.sans, borderRadius: 2 }, { label: "Optimisé avec ML", data: cpt(gs.avec_ml), backgroundColor: C.avec, borderRadius: 2 }] },
      options: { plugins: { tooltip: { callbacks: { title: (c) => "Gain de " + c[0].label + " %", label: (c) => c.dataset.label + " : " + c.raw + " journées" } } }, scales: { y: axe("Journées"), x: axe("Gain (%) — positif = meilleur que le réel", { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 10 } } }) } } });
    const serie = (s) => sens.filter((r) => r.strategie === s).map((r) => ({ x: r.deplacement_min, y: r.n_retard, l: r.lambda }));
    graphe("g-sens", { type: "scatter", data: { datasets: [
      { label: "Optimisé sans ML", data: serie("sans_ml"), borderColor: C.sans, backgroundColor: C.sans, showLine: true, pointRadius: 5 },
      { label: "Optimisé avec ML", data: serie("avec_ml"), borderColor: C.avec, backgroundColor: C.avec, showLine: true, pointRadius: 5 },
      { label: "Réel (coursier)", data: [{ x: op.reel_50.deplacement_min, y: op.reel_50.n_retard, l: null }], backgroundColor: C.reel, pointRadius: 7 }] },
      options: { plugins: { tooltip: { callbacks: { label: (c) => c.dataset.label + (c.raw.l !== null ? " (λ = " + fr(c.raw.l, 0) + ")" : "") + " : " + fr(c.raw.x, 0) + " min, " + fr(c.raw.y, 2) + " retard(s)" } } },
        scales: { x: axe("Temps de déplacement moyen (min / journée)"), y: axe("Retards moyens / journée", { beginAtZero: true }) } } });
  }

  // ======================= 8. CONCLUSION =======================
  function rendreConclusion(el) {
    const b = op.borne_information_parfaite;
    el.innerHTML = `
      <div class="entete"><h2 id="t-conclusion">Conclusion</h2><p>Ce que le projet démontre, et ce qu'il ne démontre pas.</p></div>
      <div class="grille g2">
        <div class="panneau"><h3>Principaux résultats</h3><ul class="liste-simple">
          <li>Les coursiers réels respectent déjà les échéances (${pc(ind.taux_retard_reel, 2)} de retards), mais seulement ${pc(ind.part_connue_avant_debut)} des tâches sont connues le matin : l'optimisation doit être <b>dynamique</b>.</li>
          <li>Le ${ml.modele_final} prédit des temps <b>sans biais</b> (${fr(FIN.Biais, 2)} min), là où la moyenne historique les sous-estime de ${fr(Math.abs(BASE.Biais), 1)} min par trajet.</li>
          <li>L'optimisation avec ML réduit la distance de ${fr(-op.gains.distance_avec_vs_reel_pct, 1)} % et le temps de déplacement de ${fr(-op.gains.deplacement_avec_vs_reel_pct, 1)} % par rapport au terrain (simulation).</li>
          <li>Par rapport à l'optimisation sans ML, le ML réduit les retards de ${fr(-var_(KS.n_retard, KM.n_retard), 0)} %, au prix de ${fr(op.gains.distance_avec_vs_sans_pct, 1)} % de distance en plus.</li>
          <li>Si toutes les tâches étaient connues le matin, le temps de déplacement descendrait à ${fr(b.deplacement_min, 0)} min par journée sur 50 journées : c'est le coût de l'incertitude.</li></ul></div>
        <div class="panneau"><h3>La valeur ajoutée du ML</h3>
          <p>Le ML ne fait pas de « magie » sur les kilomètres. Il apporte à l'optimiseur des temps <b>justes en moyenne</b>, qui dépendent du quartier et de l'heure. Résultat : un plan qui tient ses promesses, avec moins de retards, sans perdre le gain de l'optimisation.</p>
          <h3 style="margin-top:12px">Limites</h3><ul class="liste-simple">
            <li>Les gains de temps sont simulés : une tournée jamais réalisée ne peut pas être observée.</li>
            <li>Le R² du modèle reste modeste (${fr(FIN.R2, 2)}) ; l'évaluateur surestime les retards en valeur absolue.</li>
            <li>Les distances sont à vol d'oiseau, et le coursier réel connaît des contraintes absentes des données.</li></ul>
          <h3 style="margin-top:12px">Pistes d'amélioration</h3><ul class="liste-simple">
            <li>Distances routières à partir du réseau fourni par LaDe (roads.csv).</li>
            <li>Plusieurs coursiers à la fois (VRPTW) pour réaffecter les visites.</li>
            <li>Prévoir l'arrivée des prochaines demandes pour anticiper les détours.</li></ul></div>
      </div>
      <div class="panneau bloc"><h3>Documents du projet</h3><p>Le Notebook est la source de vérité : le rapport et cette plateforme utilisent ses figures et ses exports.</p>
        <div class="liens"><a href="../rapport/rapport_final_fr.pdf">Ouvrir le rapport (PDF)</a><a class="second" href="../rapport/rapport_final_fr.docx">Rapport modifiable (DOCX)</a><a class="second" href="../notebook/projet_tournees_lade_fr.ipynb">Télécharger le Notebook</a></div></div>`;
  }

  afficher(location.hash.slice(1) || "accueil");
})();
