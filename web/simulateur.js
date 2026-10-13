/* ============================================================
   Route simulator — line-by-line translation of the Notebook's
   Python functions (idx_heure, cout_route, planifier, simuler).
   The time matrices are precomputed by the Notebook;
   the optimisation itself really runs in the browser.
   ============================================================ */
(function (racine) {
  "use strict";

  function creer(H0, H1) {
    function idxHeure(tau) {
      return Math.min(Math.max(Math.floor(tau / 60), H0), H1) - H0;
    }

    // Cost = sum of predicted times + lambda × lateness, following the clock
    function coutRoute(route, depart, tau, M, ech, lam) {
      let t = tau, cout = 0.0, prec = depart;
      for (const j of route) {
        const d = M[idxHeure(t)][prec][j];
        t += d;
        cout += d + lam * Math.max(0.0, t - ech[j]);
        prec = j;
      }
      return cout;
    }

    // Greedy + 2-opt + or-opt (first-improvement local search)
    function planifier(depart, tau, attente, M, ech, lam, maxPasses = 50) {
      let route = [];
      const restant = attente.slice();
      let t = tau, prec = depart;
      while (restant.length) {
        let meilleur = null, mcout = Infinity;
        for (const j of restant) {
          const d = M[idxHeure(t)][prec][j];
          const c = d + lam * Math.max(0.0, t + d - ech[j]);
          if (c < mcout - 1e-12) { meilleur = j; mcout = c; }
        }
        route.push(meilleur);
        restant.splice(restant.indexOf(meilleur), 1);
        t += M[idxHeure(t)][prec][meilleur];
        prec = meilleur;
      }
      let best = coutRoute(route, depart, tau, M, ech, lam);
      const n = route.length;
      for (let passe = 0; passe < maxPasses; passe++) {
        let ameliore = false;
        for (let i = 0; i < n - 1; i++) {            // 2-opt : inverser route[i..k]
          for (let k = i + 1; k < n; k++) {
            const cand = route.slice(0, i).concat(route.slice(i, k + 1).reverse(), route.slice(k + 1));
            const c = coutRoute(cand, depart, tau, M, ech, lam);
            if (c < best - 1e-9) { route = cand; best = c; ameliore = true; }
          }
        }
        for (let i = 0; i < n; i++) {                // or-opt: move one visit
          for (let k = 0; k < n; k++) {
            if (k === i) continue;
            const cand = route.slice(0, i).concat(route.slice(i + 1));
            cand.splice(k, 0, route[i]);
            const c = coutRoute(cand, depart, tau, M, ech, lam);
            if (c < best - 1e-9) { route = cand; best = c; ameliore = true; }
          }
        }
        if (!ameliore) break;
      }
      return { route, cout: best };
    }

    /* strategie : "reel", "sans_ml" ou "avec_ml".
       Returns the KPIs, the order followed and the decision log. */
    function simuler(sc, strategie, lam, toutesConnues = false) {
      const E = sc.M_eval, D = sc.dist, ech = sc.echeance, n = sc.n;
      const connue = toutesConnues ? new Array(n).fill(-1e9) : sc.connue;
      const Mplan = strategie === "sans_ml" ? sc.M_sans : sc.M_ml;
      let cur = 0, tau = sc.fin[0];
      const tStart = tau;
      const faites = new Set([0]), ordre = [0], journal = [];
      let deplacement = 0, attente = 0, distance = 0, retardMin = 0;
      let nRetard = sc.fin[0] > ech[0] ? 1 : 0;
      let reelSuivant = 1;
      const arrivees = [tau];
      while (faites.size < n) {
        let nxt, nConnues = 0;
        if (strategie === "reel") {
          nxt = reelSuivant++;
          if (connue[nxt] > tau) { attente += connue[nxt] - tau; tau = connue[nxt]; }
        } else {
          const dispo = [];
          for (let j = 0; j < n; j++) if (!faites.has(j) && connue[j] <= tau) dispo.push(j);
          if (!dispo.length) {
            let prochaine = Infinity;
            for (let j = 0; j < n; j++) if (!faites.has(j)) prochaine = Math.min(prochaine, connue[j]);
            attente += prochaine - tau; tau = prochaine;
            continue;
          }
          nConnues = dispo.length;
          nxt = planifier(cur, tau, dispo, Mplan, ech, lam).route[0];
        }
        const d = E[idxHeure(tau)][cur][nxt];
        const depart = tau;
        tau += d; deplacement += d; distance += D[cur][nxt];
        const enRetard = tau > ech[nxt];
        if (enRetard) { nRetard += 1; retardMin += tau - ech[nxt]; }
        journal.push({ de: cur, vers: nxt, depart, arrivee: tau, duree: d, km: D[cur][nxt], connues: nConnues, retard: enRetard });
        faites.add(nxt); ordre.push(nxt); arrivees.push(tau); cur = nxt;
      }
      return { deplacement_min: deplacement, attente_min: attente, duree_min: tau - tStart, distance_km: distance,
               n_retard: nRetard, retard_min: retardMin, ordre, journal, arrivees };
    }

    return { idxHeure, coutRoute, planifier, simuler };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { creer };
  else racine.Simulateur = { creer };
})(typeof window !== "undefined" ? window : globalThis);
