# Guide de présentation — Tournées LaDe

Tous les chiffres de ce guide proviennent des exports du Notebook (`exports/*.json`). Ce sont les mêmes que dans le rapport et sur le site.

---

## A. Le projet en 10 phrases simples

1. Un coursier de Yantai doit collecter des colis, chacun avant la fin d'une fenêtre horaire de 2 heures.
2. Après chaque collecte, il doit choisir où aller ensuite : c'est la décision que nous optimisons.
3. Nous utilisons 1 146 781 colis réels de 2 593 coursiers, issus du dataset public LaDe (Cainiao).
4. Les données montrent que seulement 46 % des tâches sont connues le matin : il faut donc replanifier à chaque arrêt.
5. Le Machine Learning (Gradient Boosting) apprend le temps entre deux visites à partir de près d'un million de trajets.
6. La formule classique « 8 min + distance ÷ 16,7 km/h » sous-estime chaque trajet de 5,1 min en moyenne ; le modèle ML n'a presque aucun biais (−0,04 min).
7. Un modèle d'optimisation (TSP avec fenêtres horaires) utilise ces temps prédits pour choisir l'ordre de visite qui minimise le temps et les retards.
8. Sur 150 journées de test, l'optimisation avec ML réduit la distance de 14,6 % et le temps de déplacement de 6,2 % par rapport aux coursiers réels.
9. Sans ML, l'optimiseur gagne un peu plus de kilomètres mais fait plus de retards ; avec ML, il a 34 % de retards en moins que sans ML.
10. Le ML ne raccourcit donc pas davantage les tournées : il rend le plan fiable, et c'est ce que nous mesurons honnêtement, en simulation.

---

## B. Script oral (5 à 7 minutes)

**[0:00 – Accroche, page « Vue d'ensemble » du site]**
« Imaginez un coursier qui vient de collecter un colis. Il a encore une dizaine de clients à voir, chacun avec une échéance. Où va-t-il maintenant ? Cette décision, il la prend des dizaines de fois par jour. Notre projet l'aide à mieux la prendre, en combinant Machine Learning et optimisation. »

**[0:30 – Le problème]**
« C'est une version du problème du voyageur de commerce avec fenêtres horaires, un problème classique d'optimisation, NP-difficile. Mais il y a une difficulté en plus : les tâches arrivent pendant la journée. »

**[1:00 – Les données, pages « Explorer » et « Préparation »]**
« Nous avons utilisé le dataset public LaDe de Cainiao, la logistique d'Alibaba : 1,15 million de colis réels à Yantai. Les données sont propres : pas de doublons, pas d'incohérences. Nous avons regroupé les colis en visites, puis construit près d'un million de trajets "visite → visite suivante". Nous n'avons gardé un trajet que si la visite suivante était déjà connue au départ : sinon, on mesurerait une attente, pas un trajet. »

**[2:00 – Ce que révèlent les données, page « Analyse exploratoire »]**
« Trois constats orientent tout le projet. Un : le temps n'est pas proportionnel à la distance, et il dépend de l'heure. Deux : les coursiers respectent déjà les échéances, avec moins de 1 % de retards, donc le gain sera surtout en temps et en distance. Trois : seulement 46 % des tâches sont connues le matin, donc on doit optimiser dynamiquement, à chaque arrêt. »

**[3:00 – Le Machine Learning, page « Modèles ML »]**
« Le modèle prédit le temps entre deux visites. Nous avons comparé une formule historique, une régression linéaire, un arbre, une Random Forest et un Gradient Boosting. Surprise : la formule a la meilleure MAE. Mais elle sous-estime chaque trajet de 5 minutes en moyenne, soit une heure d'erreur sur une tournée de 20 trajets. Comme une tournée additionne les temps, nous avons choisi le modèle sans biais et avec la meilleure RMSE : le Gradient Boosting. »

**[4:00 – L'optimisation, page « Simulateur »]**
« Voici le cœur du projet. À chaque arrêt, on prend les visites connues et on cherche l'ordre qui minimise le temps de trajet plus λ fois les retards. L'heuristique (glouton, puis 2-opt et or-opt) trouve l'optimum prouvé par un MILP exact dans 83 % des cas testés, avec un écart moyen de 0,17 %, en une milliseconde. » *(Cliquer sur « Simuler la journée », montrer la carte et le journal des décisions.)* « Ce calcul est exécuté en direct dans le navigateur, et il donne exactement les mêmes résultats que le Notebook. »

**[5:00 – Les résultats, page « Avant / après »]**
« Sur 150 journées de test : −14,6 % de distance et −6,2 % de temps de déplacement par rapport aux coursiers réels. Sans ML, l'optimiseur gagne plus de kilomètres mais fait plus de retards que le terrain, car sa formule est trop optimiste. Avec ML, les retards baissent de 34 % par rapport au scénario sans ML. Et même avec une très forte pénalité, la formule ne rattrape pas : une bonne pénalité ne compense pas une mauvaise prédiction. »

**[6:00 – Honnêteté et conclusion, page « Conclusion »]**
« Ces gains sont simulés : une tournée qui n'a jamais été faite ne peut pas être observée. Nous l'avons notée avec un modèle évaluateur indépendant, entraîné sur d'autres coursiers et validé sur les tournées réelles. En résumé : l'optimisation raccourcit les tournées, et le ML rend le plan fiable. Merci. »

---

## C. Dix questions possibles de Mr Slim Ayedi, avec réponses

**1. Qu'est-ce qui est prédit par le ML, et qu'est-ce qui est optimisé ?**
Le ML prédit une seule chose : le temps (en minutes) entre la fin d'une visite et le début de la suivante, pour chaque paire de points et chaque heure. L'optimisation décide l'ordre de visite, c'est-à-dire les variables binaires x(i,j), en minimisant la somme des temps prédits plus λ fois les retards, sous les contraintes de passage et de propagation du temps.

**2. Pourquoi ne pas choisir le modèle qui a la meilleure MAE ?**
Parce que la décision additionne les temps de toute une tournée. La baseline a la meilleure MAE (7,98 min) car elle prédit le trajet typique, mais son biais est de −5,07 min par trajet, soit environ −101 min sur 20 trajets. Un plan aussi optimiste rate des échéances, ce que montrent les résultats : 1,39 retard par journée sans ML contre 0,92 avec ML. Pour une somme, il faut des prédictions justes en moyenne, d'où le choix sur la RMSE et le biais.

**3. Votre R² n'est que de 0,11. Le modèle est-il utile ?**
Oui, pour la décision. Une grande part du temps entre deux visites dépend d'éléments absents des données : attente du client, appels, livraisons intercalées. Le modèle capte ce qui est prévisible (quartier, heure, distance), sans biais, et il évite les très grosses erreurs sur les longs trajets : au-delà de 15 km, la formule se trompe de plus de 100 minutes. L'utilité se juge sur les KPI logistiques, et là le ML réduit les retards de 34 % par rapport à la formule.

**4. Comment évaluez-vous une tournée qui n'a jamais eu lieu ?**
Avec un modèle évaluateur indépendant, entraîné sur un autre groupe de coursiers (groupe B), alors que le modèle qui planifie est entraîné sur le groupe A. Le modèle qui décide n'est donc jamais celui qui note. Nous l'avons validé sur les tournées réelles : corrélation de 0,61 avec les durées observées et erreur médiane de 9 % par journée. La distance, elle, est calculée exactement, sans modèle.

**5. N'y a-t-il pas une fuite de données ?**
Nous avons pris quatre précautions. Le découpage est temporel : apprentissage de mai à août, test sur septembre–octobre. Les groupes de coursiers sont disjoints. Les variables explicatives sont toutes connues avant le départ (distance, lieu, heure, nombre de colis) ; l'heure réelle de collecte de la cible n'est jamais utilisée. Enfin, l'optimiseur ne planifie jamais une tâche avant son heure d'acceptation.

**6. Pourquoi une heuristique et pas le MILP partout ?**
Le problème est NP-difficile, et il faut une réponse à chaque arrêt, des milliers de fois. Nous avons utilisé le MILP exact (solveur HiGHS) comme certificat de qualité : sur 30 instances de 8 visites, l'heuristique trouve l'optimum dans 83 % des cas, avec un écart moyen de 0,17 % et un écart maximal de 3,2 %, en environ 1 ms contre 0,4 s pour le MILP.

**7. Pourquoi une optimisation dynamique ?**
Parce que les données le montrent : seulement 46 % des visites sont connues avant la première collecte. Planifier toute la journée le matin, ce serait utiliser des informations futures. Nous avons mesuré ce que coûterait de tout savoir : environ 248 min de déplacement par journée au lieu de 271 min sur 50 journées. C'est le coût de l'incertitude.

**8. Que représente λ, et comment l'avez-vous choisi ?**
λ = 5 signifie qu'une minute de retard coûte autant que 5 minutes de trajet. C'est une hypothèse métier, pas une donnée. Nous avons donc fait une analyse de sensibilité de λ = 0 à λ = 20. Avec λ = 0, le ML n'apporte rien. Dès λ = 1, il fait moins de retards. La formule sans ML plafonne à environ 0,98 retard par journée, même à λ = 20.

**9. L'optimisation avec ML parcourt plus de kilomètres que sans ML. N'est-ce pas un échec ?**
C'est un compromis, que nous présentons comme tel : +8,5 % de distance et +1,0 % de temps de déplacement par rapport à l'optimisation sans ML, mais 34 % de retards en moins. Sans ML, le gain kilométrique se paie par plus de retards que le terrain réel, donc par une dégradation du service. Avec ML, on garde l'essentiel du gain (−14,6 % de distance par rapport au réel) sans dégrader le service.

**10. Quelles sont les limites, et que feriez-vous ensuite ?**
Les gains de temps sont simulés, les distances sont à vol d'oiseau, l'évaluateur surestime les retards en valeur absolue (1,05 simulé contre 0,08 observé par journée), et le coursier réel connaît des contraintes absentes des données. Ensuite, nous utiliserions les distances routières (fichier roads.csv de LaDe), une version multi-coursiers (VRPTW) et une prévision des futures demandes.

**Exemple concret de décision, à avoir en tête :** journée du coursier 4564 du 17/10, 15 visites. À la première décision, le coursier réel est allé vers une visite à 0,89 km ; l'optimiseur avec ML choisit une visite déjà connue à 0,23 km. Sur la journée, la distance passe de 7,6 km (ordre réel) à 5,3 km (avec ML), sans aucun retard (Figure 17 du Notebook).

---

## D. Explication du code important, section par section

| Section du Notebook | Ce que fait le code | Ce qu'il faut savoir dire |
|---|---|---|
| **B.1 Paramètres** | Imports, `SEED = 42`, chemins du projet, style des graphiques, fonction `sauver()` | La graine rend tout reproductible ; `sauver()` exporte les PNG du rapport. |
| **C.1 Dates et cohérence** | `pd.to_datetime("2022-" + …)` ; contrôles de doublons et d'incohérences ; fonction `noter()` qui remplit le journal | L'année est ajoutée seulement pour calculer ; le journal alimente le rapport et le site. |
| **C.3 Visites** | Tri par coursier, jour et heure ; `cle_lieu` arrondie ; `cumsum()` sur les changements de lieu ; `groupby().agg()` | Des colis consécutifs au même endroit forment une seule visite ; on calcule son échéance et son heure de connaissance. |
| **C.4 Paires** | `groupby().shift(1)` pour obtenir la visite précédente ; `haversine_km()` ; filtre `connue_avant_depart` | Chaque ligne est un trajet ; le filtre de causalité évite de mesurer de l'attente. |
| **C.5–C.6 Split** | Exclusion des écarts > 120 min ; groupes de coursiers A/B tirés au hasard ; train mai–août, test sept.–oct. | Pas de fuite temporelle ; le modèle qui décide (A) est séparé du modèle qui note (B). |
| **E.2 Baseline** | `SERVICE_MED` (médiane des trajets < 50 m) et `VITESSE_MED` | C'est la stratégie « sans ML », faite de moyennes historiques. |
| **E.3 Modèles** | `Pipeline` (one-hot + standardisation) pour la régression ; arbre, Random Forest, `HistGradientBoostingRegressor` avec variables catégorielles ; fonction `evaluer()` (MAE, biais, RMSE, R²) | Même jeu de test pour tous ; sélection du modèle sur la RMSE et le biais. |
| **E.6 Importance** | `permutation_importance` sur 20 000 trajets de test | On mélange une variable et on regarde de combien l'erreur augmente. |
| **F.3 Heuristique** | `idx_heure()` lit la bonne matrice horaire ; `cout_route()` = temps + λ × retards ; `planifier()` = glouton puis 2-opt et or-opt jusqu'à ce qu'aucune amélioration ne soit possible | C'est l'optimiseur ; il est recopié ligne à ligne dans `web/simulateur.js`. |
| **F.4 Matrices** | Pour chaque journée : toutes les paires de points × 17 heures → `modele_final.predict()` et `evaluateur.predict()` ; formule pour le sans ML | Le ML fournit les coefficients t(i,j) du problème d'optimisation. |
| **F.5 Simulation** | `simuler()` : boucle d'arrêts ; liste des visites connues ; attente si aucune ; `planifier()` ; temps réel donné par l'évaluateur ; calcul des KPI | Les trois stratégies partent du même point à la même heure ; seule la façon de décider change. |
| **F.7 KPI** | Moyennes, variations en %, tests de Wilcoxon appariés | Les gains sont calculés, pas affirmés. |
| **F.10 Sensibilité** | Simulation pour λ ∈ {0, 1, 5, 20} | Montre que la pénalité ne corrige pas une mauvaise prédiction. |
| **F.11 MILP** | `milp_tsptw()` construit les variables x, a, L et les contraintes (une entrée, une sortie, propagation du temps big-M, retard), résolu par `scipy.optimize.milp` (HiGHS) | C'est le modèle mathématique exact ; il sert de référence pour l'heuristique. |
| **G Exports** | JSON et CSV, scénarios web, `web/data/donnees.js` | Le rapport et le site lisent ces fichiers : ils ne contiennent aucun chiffre saisi à la main. |

---

## E. Guide pour présenter la plateforme web en classe

**Avant le cours**
* Ouvrir `web/index.html` (double-clic) ou lancer `python -m http.server 8000` depuis le dossier du projet, puis aller sur http://localhost:8000/web/.
* Le site fonctionne sans internet. Mettre le navigateur en plein écran et zoomer à 110 % si la salle est grande.

**Déroulé conseillé (environ 4 minutes de démonstration)**
1. **Vue d'ensemble** (30 s) : lire la phrase titre. Montrer la carte : pointillés gris pour l'ordre réel, trait bleu pour l'ordre optimisé avec ML. Dire que cette carte est recalculée par le navigateur. Montrer la chaîne Données → ML → Prédictions → Décision → Évaluation.
2. **Explorer les données** (20 s) : taper un numéro de coursier dans la recherche (par exemple 992) pour montrer qu'il s'agit de vraies lignes.
3. **Analyse exploratoire** (40 s) : survoler le graphique « L'heure de la journée », basculer entre Moyenne et Médiane, puis montrer le graphique des fenêtres horaires (moins de 1 % de retards réels).
4. **Modèles ML** (40 s) : montrer le tableau et les trois petits graphiques, et insister sur le biais de la baseline (−5,07 min).
5. **Simulateur** (90 s), le moment fort :
   * Laisser λ = 5 et cliquer sur « Simuler la journée ». Montrer le bandeau vert « Résultats identiques à ceux calculés par le Notebook ».
   * Basculer la carte entre Avec ML, Sans ML et Réel.
   * Descendre au journal des décisions : « à cet arrêt, telle quantité de tâches était connue, et l'optimiseur a envoyé le coursier ici » (lire la colonne « Tâches connues »).
   * Mettre λ = 0 et simuler à nouveau : les retards ne sont plus pénalisés et la tournée change.
   * Cocher « Toutes connues dès le départ » : c'est la borne optimiste, qui montre le coût de l'incertitude.
6. **Avant / après** (40 s) : lire les deux colonnes, puis les trois encadrés (valeur de l'optimisation, valeur du ML, compromis). Terminer sur l'encadré « Ce qui est observé, ce qui est simulé ».
7. **Conclusion** (20 s) : ouvrir le rapport PDF depuis le bouton.

**Si une question surprend pendant la démo :** changer de journée dans le simulateur. Certaines journées sont moins bonnes avec ML que sans ML, et c'est voulu : le site montre les vrais résultats, journée par journée, et les moyennes sont calculées sur 150 journées.
